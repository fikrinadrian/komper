import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { ConnectionSupervisor, type SocketLike } from '@server/live/supervisor.js';
import { LiveBookStore } from '@server/live/store.js';
import type { LiveScheduler } from '@server/live/types.js';

class FakeTime implements LiveScheduler {
  now = 0;
  private id = 0;
  private jobs = new Map<number, { at: number; interval?: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number) {
    return this.add(callback, delayMs);
  }

  setInterval(callback: () => void, intervalMs: number) {
    return this.add(callback, intervalMs, intervalMs);
  }

  advance(milliseconds: number): void {
    const target = this.now + milliseconds;
    while (true) {
      const due = [...this.jobs.entries()]
        .filter(([, job]) => job.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0];
      if (!due) break;
      const [id, job] = due;
      this.now = job.at;
      if (job.interval) job.at += job.interval;
      else this.jobs.delete(id);
      job.callback();
    }
    this.now = target;
  }

  count(): number {
    return this.jobs.size;
  }

  private add(callback: () => void, delay: number, interval?: number) {
    const id = ++this.id;
    this.jobs.set(id, { at: this.now + delay, interval, callback });
    return () => this.jobs.delete(id);
  }
}

class FakeSocket extends EventEmitter implements SocketLike {
  readyState = 0;
  sent: string[] = [];

  open(): void {
    this.readyState = 1;
    this.emit('open');
  }

  message(text: string): void {
    this.emit('message', Buffer.from(text));
  }

  send(data: string): void {
    this.sent.push(data);
  }

  pong(): void {}

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', code, Buffer.from(reason));
  }

  terminate(): void {
    this.close(1006, 'terminated');
  }
}

const key = { venue: 'INDODAX', marketSegment: 'spot', venueSymbol: 'btcidr' } as const;

class HarnessSupervisor extends ConnectionSupervisor {
  protected onOpen(): void {
    this.markProtocolReady();
  }

  protected onMessage(text: string): void {
    if (text === 'heartbeat') {
      this.markTransportActivity();
      return;
    }
    const now = new Date(this.clock.now()).toISOString();
    this.store.publish(this.key, this.epoch, {
      transport: 'WS_FULL_SNAPSHOT',
      synchronization: 'SYNCHRONIZED',
      health: 'LIVE',
      book: {
        schemaVersion: '1',
        venue: 'INDODAX',
        marketSegment: 'spot',
        venueSymbol: 'btcidr',
        canonicalInstrument: { baseAsset: 'BTC', quoteAsset: 'IDR' },
        bids: [{ price: '999', quantity: '1' }],
        asks: [{ price: '1001', quantity: '1' }],
        receivedAt: now,
        processedAt: now,
        freshnessIndependentlyVerified: false,
        synchronization: 'SNAPSHOT',
      },
    });
    this.markMarketDataFrame();
  }
}

describe('ConnectionSupervisor', () => {
  it('invalidates market silence even while transport heartbeats continue', () => {
    const time = new FakeTime();
    const socket = new FakeSocket();
    const store = new LiveBookStore({ now: () => time.now, monotonicNow: () => time.now });
    const worker = new HarnessSupervisor({
      store,
      key,
      transport: 'WS_FULL_SNAPSHOT',
      url: 'wss://example.invalid/ws',
      socketFactory: () => socket,
      scheduler: time,
      clock: { now: () => time.now, monotonicNow: () => time.now },
      jitter: () => 0,
      silenceMs: 1_000,
    });

    worker.start();
    socket.open();
    socket.message('market');
    expect(store.get(key)?.health).toBe('LIVE');
    time.advance(900);
    socket.message('heartbeat');
    time.advance(900);
    socket.message('heartbeat');
    time.advance(201);

    expect(store.get(key)).toMatchObject({
      health: 'UNSYNCED',
      healthReason: 'Feed tidak mengirim payload market dalam ambang silence.',
    });
    worker.stop();
  });

  it('uses deterministic silence, backoff, new epochs and complete cleanup without sleeps', () => {
    const time = new FakeTime();
    const sockets: FakeSocket[] = [];
    const store = new LiveBookStore({ now: () => time.now, monotonicNow: () => time.now });
    const worker = new HarnessSupervisor({
      store,
      key,
      transport: 'WS_FULL_SNAPSHOT',
      url: 'wss://example.invalid/ws',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      scheduler: time,
      clock: { now: () => time.now, monotonicNow: () => time.now },
      jitter: () => 0,
      silenceMs: 1_000,
    });

    worker.start();
    sockets[0].open();
    sockets[0].message('{}');
    expect(store.get(key)).toMatchObject({ health: 'LIVE', connectionEpoch: 1 });

    time.advance(2_001);
    expect(store.get(key)).toMatchObject({ health: 'UNSYNCED', connectionEpoch: 1 });
    time.advance(375);
    expect(sockets).toHaveLength(2);
    expect(store.get(key)).toMatchObject({ health: 'UNSYNCED', connectionEpoch: 2 });

    sockets[0].message('{}');
    expect(store.get(key)?.connectionEpoch).toBe(2);
    worker.stop();
    expect(store.get(key)).toMatchObject({ health: 'UNAVAILABLE', synchronization: 'STOPPED' });
    expect(time.count()).toBe(0);
    worker.stop();
  });
});
