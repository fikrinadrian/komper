---
title: Market Stream
description: Real-time price updates for all trading pairs
---


# Market Stream

Subscribe to real-time price updates for all trading pairs. This channel broadcasts price changes, volume updates, and market statistics as they happen.

## Channel

```
market
```

## Authentication

> **Note:**
> This is a public channel. No authentication required.

## Subscription

### JavaScript/TypeScript
```typescript
import { Socket } from 'phoenix';

const socket = new Socket('wss://ws.reku.id/socket');
socket.connect();

const channel = socket.channel('market', {});

channel.join()
  .receive('ok', () => console.log('Subscribed to market stream'))
  .receive('error', (resp) => console.error('Subscription failed:', resp));

channel.on('data', (payload) => {
  console.log(`${payload.c}: ${payload.cl} IDR (${payload.cp}%)`);
});
```
### Python
```python
from phoenixchannels import Socket

socket = Socket("wss://ws.reku.id/socket")
socket.connect()

channel = socket.channel("market")
channel.join()

@channel.on("data")
def on_market_update(payload):
    print(f"{payload['c']}: {payload['cl']} IDR ({payload['cp']}%)")
```

## Message Payload

### Example Message

```json
{
  "i": 1,
  "c": "BTC",
  "n": "Bitcoin",
  "o": 1478490000,
  "h": 1500000000,
  "l": 1460110000,
  "cl": 1473760000,
  "v": 8425353094,
  "u": 1706789432,
  "bp": 1482300000,
  "sp": 1468380000,
  "mp": 1475340000,
  "cp": -0.32,
  "cp24h": -0.20,
  "cp1w": 1.5,
  "cp1m": 5.2,
  "cp1y": 45.8,
  "is_lite": true,
  "is_pro": true,
  "is_new": false,
  "is_stakable": true,
  "t": []
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `i` | integer | Unique coin identifier |
| `c` | string | Coin ticker symbol (e.g., "BTC", "ETH") |
| `n` | string | Full name of the cryptocurrency |
| `o` | number | 24-hour open price in IDR |
| `h` | number | 24-hour high price in IDR |
| `l` | number | 24-hour low price in IDR |
| `cl` | number | Current/close price in IDR |
| `v` | number | 24-hour trading volume in IDR |
| `u` | number | Unix timestamp of the update |
| `bp` | number | Best bid (buy) price in IDR |
| `sp` | number | Best ask (sell) price in IDR |
| `mp` | number | Mid price in IDR |
| `cp` | number | Price change percentage (default period) |
| `cp24h` | number | 24-hour price change percentage |
| `cp1w` | number | 1-week price change percentage |
| `cp1m` | number | 1-month price change percentage |
| `cp1y` | number | 1-year price change percentage |
| `is_lite` | boolean | Available in Lite (simple) trading mode |
| `is_pro` | boolean | Available in Pro (advanced) trading mode |
| `is_new` | boolean | Recently listed coin |
| `is_stakable` | boolean | Supports staking |
| `t` | array | Tags/categories |

## Usage Example

### Price Ticker Display

```typescript
interface MarketUpdate {
  i: number;
  c: string;
  n: string;
  cl: number;
  cp: number;
  cp24h: number;
  bp: number;
  sp: number;
  v: number;
  is_pro: boolean;
  is_lite: boolean;
}

// Store for market data
const markets = new Map<string, MarketUpdate>();

channel.on('data', (payload: MarketUpdate) => {
  // Update market data
  markets.set(payload.c, payload);

  // Format for display
  const priceFormatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(payload.cl);

  const changeClass = payload.cp24h >= 0 ? 'text-green' : 'text-red';
  const changeSign = payload.cp24h >= 0 ? '+' : '';

  console.log(`${payload.c}: ${priceFormatted} (${changeSign}${payload.cp24h}%)`);
});
```

### Filtering by Trading Mode

```typescript
channel.on('data', (payload: MarketUpdate) => {
  // Only process Pro mode coins
  if (payload.is_pro) {
    updateProMarketDisplay(payload);
  }

  // Only process Lite mode coins
  if (payload.is_lite) {
    updateLiteMarketDisplay(payload);
  }
});
```

### Volume Alert

```typescript
const volumeThreshold = 10_000_000_000; // 10 billion IDR

channel.on('data', (payload: MarketUpdate) => {
  if (payload.v > volumeThreshold) {
    console.log(`High volume alert: ${payload.c} - ${payload.v} IDR`);
  }
});
```

## Update Frequency

- Market updates are broadcast in real-time as prices change
- Typical update frequency: 100-500ms during active trading
- Updates are batched and deduplicated server-side

> **Note:**
> Consider throttling UI updates on the client side to prevent excessive re-renders. A 100-250ms throttle is recommended for smooth performance.

## Best Practices

1. **Throttle UI updates** - Use lodash throttle or similar to limit re-renders
2. **Filter by mode** - Only process coins relevant to your current view (Pro/Lite)
3. **Handle reconnection** - Re-fetch full market data via REST API after reconnection
4. **Memory management** - Clean up subscriptions when navigating away

```typescript
import throttle from 'lodash.throttle';

// Throttled update handler
const handleMarketUpdate = throttle((payload: MarketUpdate) => {
  updateUI(payload);
}, 250);

channel.on('data', handleMarketUpdate);

// Cleanup on unmount
return () => {
  handleMarketUpdate.cancel();
  channel.leave();
};
```
