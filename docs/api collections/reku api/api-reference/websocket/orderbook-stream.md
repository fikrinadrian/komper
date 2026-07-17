---
title: Order Book Stream
description: Real-time order book updates for specific trading pairs
---


# Order Book Stream

Subscribe to real-time order book updates for a specific trading pair. This channel provides live bid/ask data as orders are placed, filled, or cancelled.

## Channel

```
order:{coinId}
```

Replace `{coinId}` with the numeric coin identifier (e.g., `order:1` for Bitcoin).

> **Note:**
> You can find coin IDs from the [Get Market Data](/docs/api-reference/market-data/market) endpoint (the `id` field).

## Authentication

> **Note:**
> This is a public channel. No authentication required.

## Subscription

### JavaScript/TypeScript
```typescript
import { Socket } from 'phoenix';

const socket = new Socket('wss://ws.reku.id/socket');
socket.connect();

// Subscribe to BTC order book (coin ID: 1)
const coinId = 1;
const channel = socket.channel(`order:${coinId}`, {});

channel.join()
  .receive('ok', () => console.log('Subscribed to order book'))
  .receive('error', (resp) => console.error('Subscription failed:', resp));

channel.on('data', (payload) => {
  console.log('Order book update:', payload);
});
```
### Python
```python
from phoenixchannels import Socket

socket = Socket("wss://ws.reku.id/socket")
socket.connect()

# Subscribe to BTC order book (coin ID: 1)
coin_id = 1
channel = socket.channel(f"order:{coin_id}")
channel.join()

@channel.on("data")
def on_orderbook_update(payload):
    print(f"Order book update: {payload}")
```

## Message Payload

### Example Message (BTC - Coin ID: 1)

```json
{
  "i": 1,
  "bs": {
    "b": [
      [82250000, 1645000000, 0.05],
      [197340000, 1644500000, 0.12],
      [131520000, 1644000000, 0.08],
      [410875000, 1643500000, 0.25],
      [246450000, 1643000000, 0.15]
    ],
    "s": [
      [57610000, 1646000000, 0.035],
      [164650000, 1646500000, 0.10],
      [115290000, 1647000000, 0.07],
      [296550000, 1647500000, 0.18],
      [362560000, 1648000000, 0.22]
    ]
  }
}
```

### Example Message (ETH - Coin ID: 2)

```json
{
  "i": 2,
  "bs": {
    "b": [
      [26250000, 52500000, 0.5],
      [62940000, 52450000, 1.2],
      [41920000, 52400000, 0.8]
    ],
    "s": [
      [18410000, 52600000, 0.35],
      [39487500, 52650000, 0.75],
      [79050000, 52700000, 1.5]
    ]
  }
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `i` | integer | Coin identifier |
| `bs` | object | Order book snapshot |
| `bs.b` | array | Bid (buy) orders |
| `bs.s` | array | Ask (sell) orders |

### Order Entry Format

Each order entry is an array with 3 elements:

```
[total_idr, price, amount]
```

| Index | Type | Description |
|-------|------|-------------|
| 0 | number | Total value in IDR (price * amount) |
| 1 | number | Order price in IDR |
| 2 | number | Order amount in crypto |

## Usage Example

### Order Book Display

```typescript
interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface OrderBookPayload {
  i: number;
  bs: {
    b: [number, number, number][];  // [total, price, amount]
    s: [number, number, number][];
  };
}

function parseOrderBook(payload: OrderBookPayload): OrderBook {
  const parseSide = (entries: [number, number, number][]) =>
    entries.map(([total, price, amount]) => ({
      price,
      amount,
      total
    }));

  return {
    // Bids sorted by price descending (highest first)
    bids: parseSide(payload.bs.b).sort((a, b) => b.price - a.price),
    // Asks sorted by price ascending (lowest first)
    asks: parseSide(payload.bs.s).sort((a, b) => a.price - b.price)
  };
}

channel.on('data', (payload: OrderBookPayload) => {
  const orderbook = parseOrderBook(payload);

  console.log('=== BIDS (Buy Orders) ===');
  orderbook.bids.slice(0, 5).forEach(bid => {
    console.log(`${bid.price} IDR - ${bid.amount} BTC`);
  });

  console.log('=== ASKS (Sell Orders) ===');
  orderbook.asks.slice(0, 5).forEach(ask => {
    console.log(`${ask.price} IDR - ${ask.amount} BTC`);
  });
});
```

### Calculate Spread

```typescript
channel.on('data', (payload: OrderBookPayload) => {
  const orderbook = parseOrderBook(payload);

  if (orderbook.bids.length && orderbook.asks.length) {
    const bestBid = orderbook.bids[0].price;
    const bestAsk = orderbook.asks[0].price;
    const spread = bestAsk - bestBid;
    const spreadPercent = (spread / bestAsk) * 100;

    console.log(`Spread: ${spread} IDR (${spreadPercent.toFixed(4)}%)`);
  }
});
```

### Depth Calculation with Running Totals

```typescript
interface OrderBookEntryWithDepth extends OrderBookEntry {
  cumulativeAmount: number;
  cumulativeTotal: number;
  priceAverage: number;
  barPercentage: number;
}

function calculateDepth(
  entries: OrderBookEntry[],
  isBid: boolean
): OrderBookEntryWithDepth[] {
  // Sort appropriately
  const sorted = [...entries].sort((a, b) =>
    isBid ? b.price - a.price : a.price - b.price
  );

  // Find max total for percentage calculation
  const maxTotal = Math.max(...sorted.map(e => e.total));

  let cumulativeAmount = 0;
  let cumulativeTotal = 0;
  let totalPriceWeighted = 0;

  return sorted.map((entry, index) => {
    cumulativeAmount += entry.amount;
    cumulativeTotal += entry.total;
    totalPriceWeighted += entry.price * entry.amount;

    return {
      ...entry,
      cumulativeAmount,
      cumulativeTotal,
      priceAverage: index === 0 ? entry.price : totalPriceWeighted / cumulativeAmount,
      barPercentage: Math.max((entry.total / maxTotal) * 100, 1)
    };
  });
}
```

## Switching Trading Pairs

When switching between trading pairs, unsubscribe from the old channel before subscribing to the new one:

```typescript
let currentChannel: Channel | null = null;

function subscribeToOrderBook(coinId: number) {
  // Unsubscribe from previous channel
  if (currentChannel) {
    currentChannel.leave();
  }

  // Subscribe to new channel
  currentChannel = socket.channel(`order:${coinId}`, {});
  currentChannel.join();
  currentChannel.on('data', handleOrderBookUpdate);
}
```

## Combining with REST API

For best user experience, fetch initial order book data via REST API, then use WebSocket for updates:

```typescript
async function initializeOrderBook(coinCode: string, coinId: number) {
  // Fetch initial snapshot via REST
  const response = await fetch(
    `https://api.reku.id/v2/orderbook?pair=${coinCode}&limit=50`
  );
  const initialData = await response.json();

  // Display initial data
  updateOrderBookDisplay(initialData);

  // Subscribe to real-time updates
  const channel = socket.channel(`order:${coinId}`, {});
  channel.join();
  channel.on('data', (payload) => {
    const orderbook = parseOrderBook(payload);
    updateOrderBookDisplay(orderbook);
  });

  // Handle reconnection - refetch full snapshot
  socket.onClose(() => {
    setTimeout(async () => {
      const refreshData = await fetch(
        `https://api.reku.id/v2/orderbook?pair=${coinCode}&limit=50`
      );
      updateOrderBookDisplay(await refreshData.json());
    }, 1000);
  });
}
```

## Update Frequency

- Order book updates are broadcast in real-time as orders change
- Typical update frequency: 50-200ms during active trading
- Updates contain the full order book snapshot, not deltas

> **Warning:**
> Each message contains the complete order book, not incremental changes. This simplifies client implementation but increases bandwidth usage.

## Best Practices

1. **Validate coin ID** - Ensure the coin ID matches before updating display
2. **Handle reconnection** - Refetch REST data after socket reconnection
3. **Clean up subscriptions** - Leave channel when switching pairs or unmounting
4. **Throttle rendering** - Order book updates can be very frequent
