---
title: List Available Coins
description: Returns a list of all cryptocurrencies available for trading
---


# List Available Coins

Returns a list of all cryptocurrencies available for trading.

## Endpoint

```
GET /v2/coins
```

## Authentication

> **Note:**
> This is a public endpoint. No authentication required.

## Request

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v2/coins"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v2/coins');
const coins = await response.json();

// Response is a direct array
coins.forEach(coin => {
  console.log(`${coin.accountcode}: ${coin.accountname}`);
});
```
### Python
```python
import requests

response = requests.get('https://api.reku.id/v2/coins')
coins = response.json()

# Response is a direct array
for coin in coins:
    print(f"{coin['accountcode']}: {coin['accountname']}")
```

## Response

### Success Response (200)

The response is a direct JSON array (no wrapper object).

```json
[
  {
    "accountcode": "BTC",
    "accountname": "Bitcoin",
    "id": 1
  },
  {
    "accountcode": "ETH",
    "accountname": "Ethereum",
    "id": 2
  },
  {
    "accountcode": "USDT",
    "accountname": "Tether",
    "id": 3
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `accountcode` | string | Coin ticker symbol (e.g., BTC, ETH) |
| `accountname` | string | Full name of the cryptocurrency |
| `id` | integer | Unique coin identifier |

> **Note:**
> The `id` field is required when placing orders via [Place Order](/docs/api-reference/trading/place-order).
