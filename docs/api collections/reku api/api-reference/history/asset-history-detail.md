---
title: Get Asset Transaction Detail
description: Retrieve detailed information about a specific asset transaction
---


# Get Asset Transaction Detail

Retrieve detailed information about a specific asset transaction.

## Endpoint

```
GET /v3/wallet/asset/history/{transaction_id}/{type}
```

## Authentication

> **Warning:**
> This endpoint requires authentication. Include your API key in the `API-Key` header.

## Request

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `API-Key` | string | Yes | Your API key |

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transaction_id` | string | Yes | Transaction identifier (numeric string). Pattern: `^\d+$`. Example: `114102025121230805` |
| `type` | string | Yes | Asset type: `crypto` or `fiat` |

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v3/wallet/asset/history/114102025121230805/crypto" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const transactionId = '114102025121230805';
const type = 'crypto';

const response = await fetch(
  `https://api.reku.id/v3/wallet/asset/history/${transactionId}/${type}`,
  { headers: { 'API-Key': 'your_api_key' } }
);
const detail = await response.json();
```
### Python
```python
import requests

transaction_id = '114102025121230805'
asset_type = 'crypto'

response = requests.get(
    f'https://api.reku.id/v3/wallet/asset/history/{transaction_id}/{asset_type}',
    headers={'API-Key': 'your_api_key'}
)
detail = response.json()
```

## Response

### Success Response (200)

The response uses the same AssetTransaction schema as [Get Asset History](/docs/api-reference/history/asset-history).

```json
{
  "message": "success",
  "data": [
    {
      "id": "114102025121230805",
      "created": 1770553669000,
      "updated": 1770553669000,
      "code": "BTC",
      "logo": "https://images.reku.id/accounts/btc.png?v=5",
      "name": "Bitcoin",
      "type": "crypto",
      "trans_type": "buy",
      "order_type": "limit",
      "status": "success",
      "qty": 0.0001,
      "filled_qty": 0.0001,
      "quote_qty": 160000,
      "quote_asset_code": "IDR",
      "price": 1600000000
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
| `updated` | integer | Last updated timestamp (Unix milliseconds) |
| `code` | string | Asset code (e.g., BTC, ETH) |
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

### Error Response (404)

```json
{
  "message": "transaction not found"
}
```

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```
