---
title: Trade Stream
description: Real-time trade execution feed
---


# Trade Stream

Subscribe to real-time trade executions across all trading pairs. This channel broadcasts completed trades as they happen, including price, amount, and trade direction.

## Channel

```
trade
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

const channel = socket.channel('trade', {});

channel.join()
  .receive('ok', () => console.log('Subscribed to trade stream'))
  .receive('error', (resp) => console.error('Subscription failed:', resp));

channel.on('data', (payload) => {
  console.log('New trade:', payload);
});
```
### Python
```python
from phoenixchannels import Socket

socket = Socket("wss://ws.reku.id/socket")
socket.connect()

channel = socket.channel("trade")
channel.join()

@channel.on("data")
def on_trade(payload):
    print(f"New trade: {payload}")
```

## Message Payload

### Example Message

```json
{
  "i": 1,
  "c": "BTC",
  "n": "Bitcoin",
  "category": "pro",
  "o": 1478490000,
  "h": 1500000000,
  "l": 1460110000,
  "cl": 1473760000,
  "v": 8425353094,
  "u": 1706789432,
  "a": 1482300000,
  "b": 1468380000,
  "mk": 1475340000,
  "cp": -0.32,
  "d": 1,
  "t": [
    [1706789430, 1473500000, 0.025, 1],
    [1706789428, 1473600000, 0.015, 0],
    [1706789425, 1473450000, 0.050, 1]
  ]
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `i` | integer | Coin identifier |
| `c` | string | Coin ticker symbol (e.g., "BTC") |
| `n` | string | Full name of the cryptocurrency |
| `category` | string | Trading category ("pro" or "lite") |
| `o` | number | 24-hour open price in IDR |
| `h` | number | 24-hour high price in IDR |
| `l` | number | 24-hour low price in IDR |
| `cl` | number | Current/close price in IDR |
| `v` | number | 24-hour trading volume in IDR |
| `u` | number | Unix timestamp of the update |
| `a` | number | Best ask (sell) price in IDR |
| `b` | number | Best bid (buy) price in IDR |
| `mk` | number | Mid/market price in IDR |
| `cp` | number | Price change percentage |
| `d` | integer | Trade direction (1=buy, 0=sell) |
| `t` | array | Recent trades array |

### Trade Entry Format

Each trade entry in the `t` array is an array with 4 elements:

```
[timestamp, price, amount, direction]
```

| Index | Type | Description |
|-------|------|-------------|
| 0 | number | Unix timestamp of the trade |
| 1 | number | Trade price in IDR |
| 2 | number | Trade amount in crypto |
| 3 | integer | Trade direction (1=buy/taker bought, 0=sell/taker sold) |

## Usage Example

### Trade History Display

```typescript
interface Trade {
  timestamp: number;
  price: number;
  amount: number;
  direction: 'buy' | 'sell';
  total: number;
}

interface TradePayload {
  i: number;
  c: string;
  n: string;
  t: [number, number, number, number][];
}

function parseTrades(payload: TradePayload): Trade[] {
  return payload.t.map(([timestamp, price, amount, direction]) => ({
    timestamp,
    price,
    amount,
    direction: direction === 1 ? 'buy' : 'sell',
    total: price * amount
  }));
}

// Store for recent trades per coin
const recentTrades = new Map<string, Trade[]>();

channel.on('data', (payload: TradePayload) => {
  const trades = parseTrades(payload);

  // Update trade history for this coin
  const existing = recentTrades.get(payload.c) || [];
  const updated = [...trades, ...existing].slice(0, 50); // Keep last 50 trades
  recentTrades.set(payload.c, updated);

  // Display latest trade
  const latest = trades[0];
  if (latest) {
    const time = new Date(latest.timestamp * 1000).toLocaleTimeString();
    const color = latest.direction === 'buy' ? 'green' : 'red';
    console.log(
      `[${time}] ${payload.c}: ${latest.price} IDR x ${latest.amount} (${latest.direction})`
    );
  }
});
```

### Filter by Coin

```typescript
const targetCoin = 'BTC';

channel.on('data', (payload: TradePayload) => {
  if (payload.c !== targetCoin) return;

  const trades = parseTrades(payload);
  updateTradeDisplay(trades);
});
```

### Volume Alert on Large Trades

```typescript
const largeTradeThreshold = 100_000_000; // 100 million IDR

channel.on('data', (payload: TradePayload) => {
  const trades = parseTrades(payload);

  trades.forEach(trade => {
    if (trade.total > largeTradeThreshold) {
      console.log(
        `Large trade alert: ${payload.c} - ${trade.total} IDR (${trade.direction})`
      );
      // Send notification, play sound, etc.
    }
  });
});
```

### Calculate VWAP (Volume Weighted Average Price)

```typescript
function calculateVWAP(trades: Trade[]): number {
  if (trades.length === 0) return 0;

  let totalValue = 0;
  let totalVolume = 0;

  trades.forEach(trade => {
    totalValue += trade.price * trade.amount;
    totalVolume += trade.amount;
  });

  return totalVolume > 0 ? totalValue / totalVolume : 0;
}

channel.on('data', (payload: TradePayload) => {
  const trades = parseTrades(payload);
  const vwap = calculateVWAP(trades);
  console.log(`${payload.c} VWAP: ${vwap} IDR`);
});
```

## Trade Direction Explained

The `direction` field (or `d` in the payload) indicates the **taker's** side:

| Value | Meaning | Description |
|-------|---------|-------------|
| 1 | Buy | Taker bought (market buy order matched against limit sell) |
| 0 | Sell | Taker sold (market sell order matched against limit buy) |

> **Note:**
> Trade direction helps identify market sentiment. A series of buy trades indicates bullish pressure, while sell trades indicate bearish pressure.

## Combining with REST API

Initialize with historical trades, then update via WebSocket:

```typescript
async function initializeTradeHistory(coinCode: string) {
  // Fetch initial trade history via REST
  const response = await fetch(
    `https://api.reku.id/v2/trades?pair=${coinCode}&limit=50`
  );
  const initialTrades = await response.json();

  // Store initial trades
  recentTrades.set(coinCode, initialTrades);
  updateTradeDisplay(initialTrades);

  // Subscribe to real-time updates
  const channel = socket.channel('trade', {});
  channel.join();
  channel.on('data', (payload) => {
    if (payload.c === coinCode) {
      const trades = parseTrades(payload);
      handleNewTrades(coinCode, trades);
    }
  });
}
```

## Update Frequency

- Trade updates are broadcast in real-time as trades execute
- Each message may contain multiple recent trades in the `t` array
- High-volume pairs may receive multiple updates per second

## Best Practices

1. **Deduplicate trades** - Use timestamp + price + amount as a unique key
2. **Limit stored history** - Keep only recent trades (e.g., last 100) to manage memory
3. **Throttle UI updates** - Batch render updates for high-frequency trading pairs
4. **Handle reconnection** - Refetch trade history via REST after reconnection

```typescript
// Deduplication helper
function getTradeKey(trade: Trade): string {
  return `${trade.timestamp}-${trade.price}-${trade.amount}`;
}

const seenTrades = new Set<string>();

channel.on('data', (payload: TradePayload) => {
  const trades = parseTrades(payload);

  const newTrades = trades.filter(trade => {
    const key = getTradeKey(trade);
    if (seenTrades.has(key)) return false;
    seenTrades.add(key);
    return true;
  });

  if (newTrades.length > 0) {
    updateTradeDisplay(newTrades);
  }
});
```
