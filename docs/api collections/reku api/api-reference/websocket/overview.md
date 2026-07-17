---
title: WebSocket Overview
description: Real-time data streaming via WebSocket connections
---


# WebSocket Streaming

The Reku Trading API provides real-time data streaming via WebSocket connections using the [Phoenix Channels](https://hexdocs.pm/phoenix/channels.html) protocol.

## Connection URL

| Environment | WebSocket URL |
|-------------|---------------|
| Production | `wss://ws.reku.id/socket` |

## Protocol

The WebSocket API uses **Phoenix Channels** protocol, which provides:

- Automatic reconnection with configurable backoff
- Channel-based pub/sub messaging
- Heartbeat mechanism for connection health
- Reference tracking for message acknowledgment

> **Note:**
> Phoenix Channels is a real-time communication protocol built on top of WebSocket. You'll need a Phoenix-compatible client library to connect.

## Available Channels

### [Market Stream](/docs/api-reference/websocket/market-stream)
Real-time price updates for all trading pairs
### [Order Book Stream](/docs/api-reference/websocket/orderbook-stream)
Live order book updates for specific trading pairs
### [Trade Stream](/docs/api-reference/websocket/trade-stream)
Real-time trade execution feed

## Quick Start

### Installation

### JavaScript/TypeScript
```bash
npm install phoenix
# or
yarn add phoenix
```
### Python
```bash
pip install phoenix-channels
```

### Connection Example

### JavaScript/TypeScript
```typescript
import { Socket } from 'phoenix';

// Create socket connection
const socket = new Socket('wss://ws.reku.id/socket', {
  reconnectAfterMs: () => 1000  // Reconnect after 1 second
});

// Connect to the server
socket.connect();

// Handle connection events
socket.onOpen(() => console.log('Connected to WebSocket'));
socket.onClose(() => console.log('Disconnected from WebSocket'));
socket.onError((error) => console.error('WebSocket error:', error));

// Subscribe to a channel
const channel = socket.channel('market', {});

channel.join()
  .receive('ok', () => console.log('Joined market channel'))
  .receive('error', (resp) => console.error('Failed to join:', resp));

// Listen for data events
channel.on('data', (payload) => {
  console.log('Market update:', payload);
});
```
### Python
```python
from phoenixchannels import Socket

# Create socket connection
socket = Socket("wss://ws.reku.id/socket")
socket.connect()

# Join market channel
channel = socket.channel("market")
channel.join()

# Listen for data events
@channel.on("data")
def on_market_data(payload):
    print(f"Market update: {payload}")

# Keep connection alive
socket.wait()
```

## Message Format

All WebSocket messages follow the Phoenix Channels protocol format:

### Incoming Messages (Server to Client)

```json
{
  "topic": "market",
  "event": "data",
  "payload": { ... },
  "ref": null
}
```

| Field | Description |
|-------|-------------|
| `topic` | Channel name (e.g., "market", "order:1") |
| `event` | Event type (typically "data" for market updates) |
| `payload` | The actual data payload |
| `ref` | Message reference for acknowledgment |

## Authentication

> **Note:**
> WebSocket channels for market data are **public** and do not require authentication. Simply connect and subscribe to channels.

## Connection Best Practices

### Reconnection Handling

```typescript
const socket = new Socket('wss://ws.reku.id/socket', {
  reconnectAfterMs: (tries) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, tries), 30000);
  }
});

socket.onClose((event) => {
  if (event.code === 1000) {
    // Normal closure, reconnect
    socket.disconnect();
    socket.connect();
  }
});
```

### Multiple Subscriptions

You can subscribe to multiple channels on the same socket connection:

```typescript
// Subscribe to market prices
const marketChannel = socket.channel('market', {});
marketChannel.join();
marketChannel.on('data', handleMarketUpdate);

// Subscribe to BTC order book (coin ID: 1)
const orderbookChannel = socket.channel('order:1', {});
orderbookChannel.join();
orderbookChannel.on('data', handleOrderbookUpdate);

// Subscribe to trade feed
const tradeChannel = socket.channel('trade', {});
tradeChannel.join();
tradeChannel.on('data', handleTradeUpdate);
```

### Cleanup

Always unsubscribe when components unmount or when switching views:

```typescript
// Leave channel
channel.leave();

// Or turn off specific event listener
channel.off('data', handlerRef);
```

## Rate Limits

| Limit Type | Value |
|------------|-------|
| Connections per IP | 10 |
| Channels per connection | 50 |
| Messages per second | 100 |

> **Warning:**
> Exceeding rate limits may result in temporary disconnection. Implement proper throttling in your application.
