---
title: Get Candlestick Data
description: Returns historical OHLCV candlestick data for charting
---


# Get Candlestick Data

Returns historical OHLCV candlestick data for charting and technical analysis.

## Endpoint

```
GET /v2/chart
```

## Authentication

> **Note:**
> This is a public endpoint. No authentication required.

## Request

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Coin ID (from `/v2/coins` response) |
| `f` | integer | Yes | Frequency/interval in minutes |
| `startTime` | integer | No | Start time as Unix timestamp (seconds) |
| `endTime` | integer | No | End time as Unix timestamp (seconds) |

### Supported Intervals

| Value | Interval |
|-------|----------|
| `1` | 1 minute |
| `5` | 5 minutes |
| `15` | 15 minutes |
| `30` | 30 minutes |
| `60` | 1 hour |
| `240` | 4 hours |
| `1440` | 1 day |
| `10080` | 1 week |

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v2/chart?id=1&f=60"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v2/chart?id=1&f=60');
const candles = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v2/chart',
    params={'id': 1, 'f': 60}
)
candles = response.json()
```

## Response

### Success Response (200)

The response is an array of OHLCV candles. Each candle is an array with 7 values:

```json
[
  [1705312200000, 1445580000, 1445580000, 1445580000, 1455430000, 1.45, 2105825939.34],
  [1705315800000, 1455430000, 1460880000, 1453280000, 1460550000, 0.17, 257001070.12],
  [1705319400000, 1460880000, 1462500000, 1458000000, 1465000000, 0.85, 1243125000.00]
]
```

### Candle Format

Each candle array contains values in this order:

| Index | Field | Description |
|-------|-------|-------------|
| 0 | `timeMillis` | Unix timestamp in **milliseconds** |
| 1 | `open` | Open price in IDR |
| 2 | `close` | Close price in IDR |
| 3 | `low` | Low price in IDR |
| 4 | `high` | High price in IDR |
| 5 | `quantity` | Trading volume in crypto (base quantity) |
| 6 | `quoteQuantity` | Trading volume in IDR (quote quantity) |

> **Warning:**
> Note: The field order is **open, close, low, high** — not the typical OHLC order. The timestamp is in **milliseconds**, not seconds.

### Example: Parsing Candle Data

```javascript
const candles = await response.json();

candles.forEach(candle => {
  const [timeMillis, open, close, low, high, quantity, quoteQuantity] = candle;
  console.log({
    time: new Date(timeMillis),
    open,
    high,
    low,
    close,
    volume: quantity,
    valueIDR: quoteQuantity
  });
});
```

> **Note:**
> The coin `id` can be obtained from the [List Coins endpoint](/docs/api-reference/market-data/coins). For example, Bitcoin has `id: 1`.
