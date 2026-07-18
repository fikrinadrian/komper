import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError, z } from 'zod';
import { comparisonRequestSchema } from '@shared/contracts.js';
import { createServices } from './services/market-data.js';
import { serveComparisonSse } from './live/sse.js';

type Services = ReturnType<typeof createServices>;

const eventSchema = z.object({
  event: z.enum([
    'comparison_requested',
    'comparison_succeeded',
    'comparison_failed',
    'exchange_link_opened',
  ]),
  pair: z.string().regex(/^[A-Z0-9]{2,12}-IDR$/),
  side: z.enum(['buy', 'sell']),
  sizeBucket: z.enum(['small', 'medium', 'large']),
  venue: z.enum(['INDODAX', 'REKU', 'TOKOCRYPTO']).optional(),
  eligibleVenueCount: z.number().int().min(0).max(3).optional(),
});

const marketPairSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,12}-IDR$/);

export function createApp(services: Services = createServices('live')) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb', strict: true }));
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', mode: process.env.MARKET_DATA_MODE ?? 'live' });
  });

  app.get('/api/catalog', async (request, response, next) => {
    try {
      const catalog = await services.catalog.getCatalog(request.query.refresh === 'true');
      response.setHeader('Cache-Control', 'private, max-age=30');
      response.json(catalog);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/comparisons', async (request, response, next) => {
    try {
      const input = comparisonRequestSchema.parse({
        asset: request.query.asset,
        side: request.query.side,
        amount: request.query.amount,
      });
      const result = await services.comparison.compare(input.asset, input.side, input.amount);
      response.setHeader('Cache-Control', 'no-store');
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/live/comparisons', async (request, response, next) => {
    try {
      const input = comparisonRequestSchema.parse({
        asset: request.query.asset,
        side: request.query.side,
        amount: request.query.amount,
      });
      await serveComparisonSse(request, response, input, services.comparison, services.live);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/markets', async (_request, response, next) => {
    try {
      const result = await services.markets.getOverview();
      response.setHeader('Cache-Control', 'private, max-age=15');
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/markets/:pair', async (request, response, next) => {
    try {
      const pair = marketPairSchema.parse(request.params.pair);
      const result = await services.markets.getDetail(pair.slice(0, -4));
      response.setHeader('Cache-Control', 'no-store');
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/events', (request, response, next) => {
    try {
      const event = eventSchema.parse(request.body);
      console.info('product_event', event);
      response.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  });

  const clientPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client');
  app.use(express.static(clientPath, { index: false, maxAge: '1h' }));
  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) return next();
    response.sendFile(path.join(clientPath, 'index.html'));
  });

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route tidak ditemukan.' } });
  });

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    void next;
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Permintaan tidak valid.',
          details: error.flatten(),
        },
      });
      return;
    }
    if (error instanceof Error && error.message === 'unsupported_instrument') {
      response.status(422).json({
        error: {
          code: 'UNSUPPORTED_INSTRUMENT',
          message: 'Pair IDR ini belum aktif dan tervalidasi di ketiga exchange.',
        },
      });
      return;
    }
    if (error instanceof Error && error.message === 'unsupported_market') {
      response.status(404).json({
        error: { code: 'MARKET_NOT_FOUND', message: 'Pair market ini belum tersedia.' },
      });
      return;
    }
    console.error('request_failed', { category: 'internal' });
    response.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Layanan data belum tersedia. Coba lagi.' },
    });
  });

  return app;
}
