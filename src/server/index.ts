import { createApp } from './app.js';
import { createServices } from './services/market-data.js';

const mode = process.env.MARKET_DATA_MODE === 'fixture' ? 'fixture' : 'live';
const port = Number(process.env.PORT ?? 3000);
const services = createServices(mode);
const app = createApp(services);

const server = app.listen(port, () => {
  console.log(`Komper BFF listening on http://localhost:${port} (${mode})`);
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  services.live.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
