---
title: Get Pending Orders
description: Returns all open (pending) orders for the authenticated user
---


# Get Pending Orders

Returns all open (pending) orders for the authenticated user.

## Endpoint

```
POST /v2/pendingorderall
```

## Authentication

> **Warning:**
> This endpoint requires authentication. Include your API key in the `API-Key` header.

## Request

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `API-Key` | string | Yes | Your API key |

### Example Request

### cURL
```bash
curl -X POST "https://api.reku.id/v2/pendingorderall" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v2/pendingorderall', {
  method: 'POST',
  headers: {
    'API-Key': 'your_api_key'
  }
});
const data = await response.json();
```
### Python
```python
import requests

response = requests.post(
    'https://api.reku.id/v2/pendingorderall',
    headers={'API-Key': 'your_api_key'}
)
data = response.json()
```

## Response

### Success Response (200)

```json
{
  "order": [
    {
      "id": 82249735,
      "a": 1123900000,
      "c": "BTC",
      "oa": 2.6692766260343e-05,
      "ot": "2026-03-16 05:29:50",
      "t": 30000,
      "ta": 30000,
      "tt": 0,
      "order_unix_time_stamp": 1773638990
    },
    {
      "id": 82249797,
      "a": 5400,
      "c": "ADA",
      "oa": 7,
      "ot": "2026-03-16 05:34:53",
      "t": 37800,
      "ta": 37800,
      "tt": 1,
      "order_unix_time_stamp": 1773639293
    }
  ]
}
```

### Response Fields

The response contains an `order` array with the following fields per order:

| Field | Type | Description |
|-------|------|-------------|
| `a` | integer | Amount — coin price in IDR |
| `c` | string | Coin code (e.g., BTC, ETH) |
| `id` | integer | Order ID |
| `oa` | number | Order amount — coin quantity |
| `ot` | string | Order time (datetime string) |
| `t` | integer | Total IDR value of the order |
| `ta` | integer | Total all (original IDR value) |
| `tt` | integer | Transaction type: `0` = buy, `1` = sell |
| `order_unix_time_stamp` | integer | Order creation time as Unix timestamp |

### Order Type Values

| Value | Description |
|-------|-------------|
| `0` | Buy order (bid) |
| `1` | Sell order (ask) |

### Empty Response

When there are no pending orders:

```json
{
  "order": []
}
```

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

> **Note:**
> Only open orders (pending or partially filled) are returned. Fully filled or cancelled orders are not included.
