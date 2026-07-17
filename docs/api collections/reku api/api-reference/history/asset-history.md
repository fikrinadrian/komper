---
title: Get Asset History
description: Returns a paginated list of all asset transactions
---


# Get Asset History

Returns a paginated list of all asset transactions including trades, deposits, and withdrawals.

## Endpoint

```
GET /v3/wallet/asset/history
```

## Authentication

> **Warning:**
> This endpoint requires authentication. Include your API key in the `API-Key` header.

## Request

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `API-Key` | string | Yes | Your API key |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `offset` | integer | No | 0 | Offset for pagination |
| `limit` | integer | No | 25 | Items per page |
| `type` | string | No | - | Asset type filter: `crypto`, `us_stock`, `crypto_pocket`, `us_stock_pocket` |
| `code` | string | No | - | Asset code filter (e.g., `BTC`) |

### Example Request

### cURL
```bash
# Filter by crypto asset type, BTC only
curl -X GET "https://api.reku.id/v3/wallet/asset/history?offset=0&limit=10&type=crypto&code=BTC" \
  -H "API-Key: your_api_key"

# Filter US stocks
curl -X GET "https://api.reku.id/v3/wallet/asset/history?offset=0&limit=10&type=us_stock" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const params = new URLSearchParams({
  code: 'BTC',
  type: 'crypto',
  limit: 10
});

const response = await fetch(`https://api.reku.id/v3/wallet/asset/history?${params}`, {
  headers: { 'API-Key': 'your_api_key' }
});
const history = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v3/wallet/asset/history',
    headers={'API-Key': 'your_api_key'},
    params={'code': 'BTC', 'type': 'crypto', 'limit': 10}
)
history = response.json()
```

## Response

### Success Response (200)

```json
{
  "message": "success",
  "data": [
    {
      "id": "108022026117972676",
      "created": 1770553669000,
      "updated": 1770553669000,
      "code": "TRX",
      "logo": "https://images.reku.id/accounts/trx.png?v=5",
      "name": "Tron",
      "type": "crypto",
      "trans_type": "sell",
      "order_type": "market",
      "status": "success",
      "qty": 1.08655848,
      "filled_qty": 1.08655848,
      "quote_qty": 4988.39,
      "quote_asset_code": "IDR",
      "price": 4591
    }
  ]
}
```

### Response Fields

The response is wrapped in `{message, data}`. Each transaction in the `data` array has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique transaction identifier |
| `created` | integer | Transaction timestamp (Unix milliseconds) |
| `code` | string | Asset code (e.g., BTC, ETH, TRX) |
| `logo` | string | URL to asset logo |
| `name` | string | Asset full name |
| `type` | string | Asset type (e.g., "crypto") |
| `trans_type` | string | Transaction type: `buy` or `sell` |
| `order_type` | string | Order type: `market` or `limit` |
| `status` | string | Status: `success`, `pending`, `failed` |
| `qty` | number | Order quantity |
| `filled_qty` | number | Filled quantity |
| `quote_qty` | number | Quote amount in IDR |
| `quote_asset_code` | string | Quote asset code (typically "IDR") |
| `price` | number | Execution price in IDR |

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

> **Note:**
> The `created` timestamp is in Unix milliseconds. Divide by 1000 to convert to standard Unix seconds.
