---
title: Place Order
description: Places a new limit order to buy or sell cryptocurrency
---


# Place Order

Places a new limit order to buy or sell cryptocurrency.

## Endpoint

```
POST /v2/order
```

## Authentication

> **Warning:**
> This endpoint requires authentication. Include your API key in the `API-Key` header.

## Request

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `API-Key` | string | Yes | Your API key |
| `Content-Type` | string | Yes | `application/x-www-form-urlencoded` or `application/json` |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coin` | integer | Yes | Coin ID from `/v2/coins` response (e.g., 1 for BTC) |
| `transtype` | integer | Yes | Order type: `0` = buy (bid), `1` = sell (ask) |
| `amount` | string | Yes | Limit price in IDR |
| `total` | string | Yes | Order quantity — IDR amount for buy orders, crypto amount for sell orders |

> **Warning:**
> Note the parameter naming: `amount` is the **price**, and `total` is the **quantity**. For buy orders, `total` is the IDR amount to spend. For sell orders, `total` is the crypto amount to sell.

### Example Request

### cURL
```bash
# Buy order: spend 160,000 IDR on BTC at price 1,600,000,000 IDR/BTC
curl -X POST "https://api.reku.id/v2/order" \
  -H "API-Key: your_api_key" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "coin=1&transtype=0&amount=1600000000&total=160000"

# Sell order: sell 0.0001 BTC at price 1,650,000,000 IDR/BTC
curl -X POST "https://api.reku.id/v2/order" \
  -H "API-Key: your_api_key" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "coin=1&transtype=1&amount=1650000000&total=0.0001"
```
### JavaScript
```javascript
// Buy order
const response = await fetch('https://api.reku.id/v2/order', {
  method: 'POST',
  headers: {
    'API-Key': 'your_api_key',
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    coin: '1',
    transtype: '0',    // 0 = buy
    amount: '1600000000', // price in IDR
    total: '160000'       // IDR amount to spend
  })
});
const result = await response.json();
```
### Python
```python
import requests

# Buy order
response = requests.post(
    'https://api.reku.id/v2/order',
    headers={'API-Key': 'your_api_key'},
    data={
        'coin': 1,
        'transtype': 0,         # 0 = buy, 1 = sell
        'amount': '1600000000', # price in IDR
        'total': '160000'       # IDR amount to spend
    }
)
result = response.json()
```

### Transaction Type Values

| Value | Description |
|-------|-------------|
| `0` | Buy / Bid |
| `1` | Sell / Ask |

## Response

### Success Response (200)

```json
{
  "success": 1
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | integer | `1` indicates the order was placed successfully |

### Error Responses

#### Unauthorized (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

#### Insufficient Balance

```json
{
  "errno": 111,
  "error": "Saldo Rupiah tidak cukup."
}
```

> **Note:**
> Orders are limit orders. The order will remain open until filled, partially filled, or cancelled. Use `/v2/pendingorderall` to check your open orders.
