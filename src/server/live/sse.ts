import type { Request, Response } from 'express';
import type { ComparisonResponse, Side } from '@shared/contracts.js';
import type { ComparisonService } from '@server/services/comparison-service.js';
import type { LiveMarketCoordinator } from './coordinator.js';
import type { LiveScheduler } from './types.js';
import { systemScheduler } from './types.js';

type Input = { asset: string; side: Side; amount: string };

type SseTarget = { write(payload: string): boolean };

export class SseBackpressureWriter {
  private blocked = false;
  private closed = false;
  private pendingComparison?: string;
  private slowConsumerCancel?: () => void;

  constructor(
    private readonly target: SseTarget,
    private readonly disconnect: () => void,
    private readonly slowConsumerMs: number,
    private readonly scheduler: Pick<LiveScheduler, 'setTimeout'> = systemScheduler,
  ) {}

  writeComparison(payload: string): void {
    if (this.closed) return;
    if (this.blocked) {
      this.pendingComparison = payload;
      return;
    }
    this.blocked = !this.target.write(payload);
    if (this.blocked) this.armSlowConsumerTimeout();
  }

  writeControl(payload: string): void {
    if (this.closed || this.blocked) return;
    this.blocked = !this.target.write(payload);
    if (this.blocked) this.armSlowConsumerTimeout();
  }

  onDrain(): void {
    if (this.closed) return;
    this.slowConsumerCancel?.();
    this.slowConsumerCancel = undefined;
    this.blocked = false;
    const latest = this.pendingComparison;
    this.pendingComparison = undefined;
    if (latest) this.writeComparison(latest);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pendingComparison = undefined;
    this.slowConsumerCancel?.();
    this.slowConsumerCancel = undefined;
  }

  private armSlowConsumerTimeout(): void {
    if (this.slowConsumerCancel) return;
    this.slowConsumerCancel = this.scheduler.setTimeout(() => {
      this.slowConsumerCancel = undefined;
      if (!this.blocked || this.closed) return;
      this.closed = true;
      this.pendingComparison = undefined;
      this.disconnect();
    }, this.slowConsumerMs);
  }
}

export async function serveComparisonSse(
  request: Request,
  response: Response,
  input: Input,
  comparison: ComparisonService,
  live: LiveMarketCoordinator,
): Promise<void> {
  if (!live.config.sseEnabled) {
    response.status(404).json({
      error: { code: 'LIVE_DISABLED', message: 'Live delivery belum diaktifkan.' },
    });
    return;
  }

  const releaseAsset = await live.retainAsset(input.asset);

  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  let closed = false;
  let scheduled: NodeJS.Timeout | undefined;
  let computing = false;
  let dirty = false;
  const writer = new SseBackpressureWriter(
    response,
    () => response.end(),
    live.config.sseSlowConsumerMs,
  );

  const emitCurrent = async () => {
    if (closed) return;
    if (computing) {
      dirty = true;
      return;
    }
    computing = true;
    try {
      const result: ComparisonResponse = await comparison.compare(
        input.asset,
        input.side,
        input.amount,
      );
      result.streamRevision = live.store.currentRevision();
      writer.writeComparison(
        `id: ${result.streamRevision}\nevent: comparison\ndata: ${JSON.stringify(result)}\n\n`,
      );
    } catch {
      writer.writeControl(
        'event: live-error\ndata: {"message":"Live comparison belum tersedia."}\n\n',
      );
    } finally {
      computing = false;
      if (dirty) {
        dirty = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (closed || scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = undefined;
      void emitCurrent();
    }, live.config.sseCadenceMs);
  };

  const unsubscribe = live.store.subscribe((record) => {
    if (record.key.venueSymbol.toUpperCase().includes(input.asset.toUpperCase())) schedule();
  });
  const heartbeat = setInterval(() => writer.writeControl(': heartbeat\n\n'), 15_000);
  response.on('drain', () => writer.onDrain());

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (scheduled) clearTimeout(scheduled);
    clearInterval(heartbeat);
    writer.close();
    unsubscribe();
    releaseAsset();
  };
  request.once('close', cleanup);
  response.once('close', cleanup);
  response.once('finish', cleanup);

  await emitCurrent();
}
