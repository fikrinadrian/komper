import WebSocket from 'ws';
import type { LiveBookKey, LiveClock, LiveScheduler } from './types.js';
import { systemClock, systemScheduler } from './types.js';
import type { LiveBookStore } from './store.js';
import type { MarketTransport } from '@shared/contracts.js';

export interface SocketLike {
  readyState: number;
  on(event: 'open', listener: () => void): this;
  on(event: 'message', listener: (data: WebSocket.RawData, isBinary?: boolean) => void): this;
  on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'ping' | 'pong', listener: (data: Buffer) => void): this;
  send(data: string): void;
  pong?(data?: Buffer): void;
  close(code?: number, reason?: string): void;
  terminate?(): void;
}

export type SocketFactory = (url: string) => SocketLike;

export type SupervisorOptions = {
  store: LiveBookStore;
  key: LiveBookKey;
  transport: MarketTransport;
  url: string;
  socketFactory?: SocketFactory;
  clock?: LiveClock;
  scheduler?: LiveScheduler;
  jitter?: () => number;
  silenceMs?: number;
  maxBackoffMs?: number;
  maxFrameBytes?: number;
};

export abstract class ConnectionSupervisor {
  protected readonly store: LiveBookStore;
  protected readonly key: LiveBookKey;
  protected readonly clock: LiveClock;
  protected readonly scheduler: LiveScheduler;
  protected epoch = 0;
  protected socket?: SocketLike;
  private readonly transport: MarketTransport;
  private readonly url: string;
  private readonly socketFactory: SocketFactory;
  private readonly jitter: () => number;
  private readonly silenceMs: number;
  private readonly maxBackoffMs: number;
  private readonly maxFrameBytes: number;
  private cancels: Array<() => void> = [];
  private reconnectCancel?: () => void;
  private failures = 0;
  private lastTransportAt = 0;
  private lastMarketDataAt = 0;
  private running = false;
  private protocolReady = false;

  constructor(options: SupervisorOptions) {
    this.store = options.store;
    this.key = options.key;
    this.transport = options.transport;
    this.url = options.url;
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
    this.clock = options.clock ?? systemClock;
    this.scheduler = options.scheduler ?? systemScheduler;
    this.jitter = options.jitter ?? Math.random;
    this.silenceMs = options.silenceMs ?? 20_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    this.maxFrameBytes = options.maxFrameBytes ?? 2_000_000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.reconnectCancel?.();
    this.reconnectCancel = undefined;
    this.clearTimers();
    this.beforeClose();
    this.socket?.close(1000, 'worker_stop');
    this.socket = undefined;
    if (this.epoch) {
      this.store.invalidate(this.key, this.epoch, 'STOPPED', 'Worker dihentikan.', this.transport);
    }
  }

  protected send(value: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(value));
  }

  protected markProtocolReady(): void {
    this.protocolReady = true;
  }

  protected markTransportActivity(): void {
    this.lastTransportAt = this.clock.monotonicNow();
  }

  protected markMarketDataFrame(): void {
    const now = this.clock.monotonicNow();
    this.lastTransportAt = now;
    this.lastMarketDataAt = now;
    if (this.protocolReady) this.failures = 0;
  }

  protected scheduleInterval(callback: () => void, intervalMs: number): void {
    this.cancels.push(this.scheduler.setInterval(callback, intervalMs));
  }

  protected scheduleTimeout(callback: () => void, delayMs: number): void {
    this.cancels.push(this.scheduler.setTimeout(callback, delayMs));
  }

  protected fail(
    reason: string,
    synchronization: 'GAPPED' | 'RECONNECTING' = 'RECONNECTING',
  ): void {
    if (!this.running) return;
    this.store.invalidate(this.key, this.epoch, synchronization, reason, this.transport);
    const socket = this.socket;
    this.socket = undefined;
    socket?.terminate?.();
    socket?.close();
    this.scheduleReconnect();
  }

  protected abstract onOpen(): void;
  protected abstract onMessage(text: string): void | Promise<void>;
  protected onPing(data: Buffer): void {
    void data;
    // `ws` automatically emits a pong for protocol ping frames.
    this.markTransportActivity();
  }
  protected beforeClose(): void {}

  private connect(): void {
    if (!this.running) return;
    this.clearTimers();
    this.protocolReady = false;
    this.lastTransportAt = this.clock.monotonicNow();
    this.lastMarketDataAt = this.lastTransportAt;
    this.epoch = this.store.beginEpoch(this.key);
    this.store.invalidate(
      this.key,
      this.epoch,
      'RECONNECTING',
      'Menyambungkan feed market.',
      this.transport,
    );
    let socket: SocketLike;
    try {
      socket = this.socketFactory(this.url);
    } catch {
      this.store.invalidate(
        this.key,
        this.epoch,
        'RECONNECTING',
        'Koneksi WebSocket gagal dibuat.',
        this.transport,
      );
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.on('open', () => {
      if (socket !== this.socket || !this.running) return;
      try {
        this.onOpen();
      } catch {
        this.fail('Handshake WebSocket gagal.');
        return;
      }
      this.scheduleInterval(
        () => {
          if (this.clock.monotonicNow() - this.lastMarketDataAt > this.silenceMs) {
            this.fail('Feed tidak mengirim payload market dalam ambang silence.');
          }
        },
        Math.max(1_000, Math.floor(this.silenceMs / 2)),
      );
    });
    socket.on('message', (data, isBinary) => {
      if (socket !== this.socket || !this.running) return;
      if (isBinary || (typeof data !== 'string' && !Buffer.isBuffer(data))) {
        this.fail('Frame biner atau terfragmentasi tidak didukung.');
        return;
      }
      const frameBytes = typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength;
      if (frameBytes > this.maxFrameBytes) {
        this.fail('Frame market melewati batas ukuran.', 'GAPPED');
        return;
      }
      this.lastTransportAt = this.clock.monotonicNow();
      Promise.resolve(this.onMessage(data.toString())).catch(() => {
        this.fail('Frame market gagal validasi.', 'GAPPED');
      });
    });
    socket.on('ping', (data) => this.onPing(data));
    socket.on('pong', () => this.markTransportActivity());
    socket.on('error', () => this.fail('Koneksi WebSocket mengalami error.'));
    socket.on('close', () => {
      if (socket !== this.socket || !this.running) return;
      this.socket = undefined;
      this.store.invalidate(
        this.key,
        this.epoch,
        'RECONNECTING',
        'Koneksi WebSocket tertutup.',
        this.transport,
      );
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectCancel) return;
    this.clearTimers();
    this.failures += 1;
    const base = Math.min(this.maxBackoffMs, 500 * 2 ** Math.min(this.failures - 1, 8));
    const delay = Math.round(base * (0.75 + this.jitter() * 0.5));
    this.reconnectCancel = this.scheduler.setTimeout(() => {
      this.reconnectCancel = undefined;
      this.connect();
    }, delay);
  }

  private clearTimers(): void {
    for (const cancel of this.cancels.splice(0)) cancel();
  }
}
