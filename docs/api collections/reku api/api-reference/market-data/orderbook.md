---
title: Get Order Book
description: Returns the current order book for a trading pair
---


# Get Order Book

Returns the current order book (buy and sell orders) for a trading pair.

## Endpoint

```
GET /v2/orderbook
```

## Authentication

> **Note:**
> This is a public endpoint. No authentication required.

## Request

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | Yes | Trading pair symbol (e.g., `BTC_IDR`, `ETH_IDR`) |

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v2/orderbook?symbol=BTC_IDR"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v2/orderbook?symbol=BTC_IDR');
const orderbook = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v2/orderbook',
    params={'symbol': 'BTC_IDR'}
)
orderbook = response.json()
```

## Response

### Success Response (200)

```json
{
  "b": [
    [82250000, "1645000000", 0.05],
    [197340000, "1644500000", 0.12],
    [131520000, "1644000000", 0.08],
    [410875000, "1643500000", 0.25],
    [246450000, "1643000000", 0.15]
  ],
  "s": [
    [57610000, "1646000000", 0.035],
    [164650000, "1646500000", 0.1],
    [115290000, "1647000000", 0.07],
    [296550000, "1647500000", 0.18],
    [362560000, "1648000000", 0.22]
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `b` | array | List of buy orders (bids) |
| `s` | array | List of sell orders (asks) |

### Order Entry Format

Each order entry is an array with 3 elements:

```
[quote_quantity, price, base_quantity]
```

| Index | Type | Description |
|-------|------|-------------|
| 0 | number | Quote quantity — total value in IDR |
| 1 | string | Price in IDR (**note: serialized as a string**) |
| 2 | number | Base quantity — amount in crypto |

> **Warning:**
> The price (index 1) is returned as a **string**, not a number. Make sure to parse it when doing calculations.

### Error Response (404)

The 404 response is returned as `text/plain`:

```
File not found.
```

### Error Response (400)

```json
{
  "errno": 2001,
  "error": "Invalid parameter"
}
```

## Understanding the Order Book

> **Note:**
> The order book shows aggregated orders at each price level. Buy orders (bids) are sorted highest price first, while sell orders (asks) are sorted lowest price first.

### Spread Calculation

```javascript
// Parse prices from strings
const bestBid = parseFloat(orderbook.b[0][1]);   // "1645000000" → 1645000000
const bestAsk = parseFloat(orderbook.s[0][1]);   // "1646000000" → 1646000000
const spread = bestAsk - bestBid;                // 1,000,000 IDR
const spreadPercent = (spread / bestAsk) * 100;  // 0.0607%
```
