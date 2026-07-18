import { describe, expect, it, vi } from 'vitest';
import { SseBackpressureWriter } from '@server/live/sse.js';

class FakeTimeouts {
  private callback?: () => void;

  setTimeout(callback: () => void) {
    this.callback = callback;
    return () => {
      if (this.callback === callback) this.callback = undefined;
    };
  }

  fire(): void {
    const callback = this.callback;
    this.callback = undefined;
    callback?.();
  }
}

describe('SseBackpressureWriter', () => {
  it('keeps only the latest comparison and drops heartbeats while blocked', () => {
    let writable = false;
    const writes: string[] = [];
    const timeouts = new FakeTimeouts();
    const writer = new SseBackpressureWriter(
      {
        write(payload) {
          writes.push(payload);
          return writable;
        },
      },
      vi.fn(),
      1_000,
      timeouts,
    );

    writer.writeComparison('comparison-1');
    writer.writeComparison('comparison-2');
    writer.writeControl('heartbeat');
    writer.writeComparison('comparison-3');
    expect(writes).toEqual(['comparison-1']);

    writable = true;
    writer.onDrain();
    expect(writes).toEqual(['comparison-1', 'comparison-3']);
    writer.close();
  });

  it('disconnects a persistently slow consumer and releases pending state', () => {
    const disconnect = vi.fn();
    const timeouts = new FakeTimeouts();
    const writer = new SseBackpressureWriter({ write: () => false }, disconnect, 1_000, timeouts);

    writer.writeComparison('comparison-1');
    writer.writeComparison('comparison-2');
    writer.writeControl('heartbeat');
    timeouts.fire();
    expect(disconnect).toHaveBeenCalledOnce();
    writer.onDrain();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
