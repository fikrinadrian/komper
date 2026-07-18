import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '@server/app.js';
import { createServices } from '@server/services/market-data.js';
import type { LiveFeatureConfig } from '@server/live/coordinator.js';

const openServers: Array<{ close(callback: () => void): void }> = [];

afterEach(async () => {
  await Promise.all(
    openServers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('comparison SSE delivery', () => {
  it('sends a complete same-origin replacement with bounded live metadata', async () => {
    const config: LiveFeatureConfig = {
      ingestEnabled: false,
      rankingEnabled: false,
      sseEnabled: true,
      assets: new Set(),
      venues: new Set(),
      staleAfterMs: 15_000,
      sseCadenceMs: 1,
      sseSlowConsumerMs: 5_000,
      restPollMs: 10_000,
      rekuMaxConnections: 8,
    };
    const services = createServices('fixture', config);
    const server = createApp(services).listen(0);
    openServers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    const controller = new AbortController();

    const response = await fetch(
      `http://127.0.0.1:${port}/api/live/comparisons?asset=BTC&side=buy&amount=5000000`,
      { signal: controller.signal },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (!text.includes('\n\n')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    controller.abort();
    services.live.stop();

    expect(text).toContain('event: comparison');
    const data = text
      .split('\n')
      .find((line) => line.startsWith('data: '))!
      .slice(6);
    const comparison = JSON.parse(data) as { results: unknown[]; streamRevision: number };
    expect(comparison.results).toHaveLength(3);
    expect(comparison.streamRevision).toBe(0);
    expect(text).not.toContain('ws3.indodax.com');
    expect(text).not.toContain('ws.reku.id');
    expect(text).not.toContain('stream-cloud.tokocrypto.site');
  });
});
