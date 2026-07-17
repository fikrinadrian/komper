import { createApp } from './app.js';
import { createServices } from './services/market-data.js';

const mode = process.env.MARKET_DATA_MODE === 'fixture' ? 'fixture' : 'live';
const port = Number(process.env.PORT ?? 3000);
const app = createApp(createServices(mode));

app.listen(port, () => {
  console.log(`Komper BFF listening on http://localhost:${port} (${mode})`);
});
