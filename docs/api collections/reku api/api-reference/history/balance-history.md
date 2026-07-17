---
title: Get Balance History
description: Retrieve the balance history (deposit/withdraw) for IDR or other fiat currencies
---


# Get Balance History

Retrieve the balance history (deposit/withdraw) for IDR or other fiat currencies.

## Endpoint

```
GET /v3/wallet/balance/history
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
| `code` | string | No | - | Currency code filter (e.g., `IDR`) |

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v3/wallet/balance/history?code=IDR&limit=10" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const params = new URLSearchParams({
  code: 'IDR',
  limit: 10
});

const response = await fetch(`https://api.reku.id/v3/wallet/balance/history?${params}`, {
  headers: { 'API-Key': 'your_api_key' }
});
const history = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v3/wallet/balance/history',
    headers={'API-Key': 'your_api_key'},
    params={'code': 'IDR', 'limit': 10}
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
      "id": "220102026031512345",
      "created": 1773820800000,
      "updated": 1773820860000,
      "code": "IDR",
      "logo": "https://images.reku.id/accounts/idr.png?v=5",
      "trans_type": "deposit",
      "status": "success",
      "method": "bank_transfer",
      "amount": 5000000,
      "qty": 0,
      "gross_qty": 0,
      "filled_qty": 0,
      "gross_filled_qty": 0,
      "quote_qty": 0,
      "gross_quote_qty": 0,
      "filled_quote_qty": 0,
      "gross_filled_quote_qty": 0,
      "fee": 0,
      "sms_fee": 0,
      "price": 0,
      "payment": "BCA",
      "payment_account": "123****789",
      "payment_account_name": "John Doe",
      "payment_logo": "https://images.reku.id/payments/bca.png",
      "payment_recommendation_id": 0,
      "ewallet_data": {},
      "notes": {
        "en": "Deposit via bank transfer",
        "id": "Deposit melalui transfer bank"
      },
      "metadata": {}
    },
    {
      "id": "220102026031098765",
      "created": 1773734400000,
      "updated": 1773734460000,
      "code": "IDR",
      "logo": "https://images.reku.id/accounts/idr.png?v=5",
      "trans_type": "withdraw",
      "status": "success",
      "method": "bank_transfer",
      "amount": 1000000,
      "qty": 0,
      "gross_qty": 0,
      "filled_qty": 0,
      "gross_filled_qty": 0,
      "quote_qty": 0,
      "gross_quote_qty": 0,
      "filled_quote_qty": 0,
      "gross_filled_quote_qty": 0,
      "fee": 6500,
      "sms_fee": 750,
      "price": 0,
      "payment": "BCA",
      "payment_account": "123****789",
      "payment_account_name": "John Doe",
      "payment_logo": "https://images.reku.id/payments/bca.png",
      "payment_recommendation_id": 0,
      "ewallet_data": {},
      "notes": {
        "en": "Withdrawal to bank account",
        "id": "Penarikan ke rekening bank"
      },
      "metadata": {}
    }
  ]
}
```

### Response Fields

The response is wrapped in `{message, data}`. Each transaction in the `data` array has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique transaction identifier |
| `created` | integer | Transaction timestamp (Unix milliseconds, int64) |
| `updated` | integer | Last updated timestamp (Unix milliseconds, int64) |
| `code` | string | Currency code (e.g., "IDR") |
| `logo` | string | URL to currency logo |
| `trans_type` | string | Transaction type: `deposit`, `withdraw`, `buy`, `sell`, `dividend` |
| `status` | string | Status: `success`, `failed`, `expired`, `pending`, `canceled`, `waiting_payment` |
| `method` | string | Payment method: `""`, `bank_transfer`, `ewallet`, `internal_transfer` |
| `amount` | number | Transaction amount (decimal) |
| `qty` | number | Quantity |
| `gross_qty` | number | Gross quantity |
| `filled_qty` | number | Filled quantity |
| `gross_filled_qty` | number | Gross filled quantity |
| `quote_qty` | number | Quote quantity |
| `gross_quote_qty` | number | Gross quote quantity |
| `filled_quote_qty` | number | Filled quote quantity |
| `gross_filled_quote_qty` | number | Gross filled quote quantity |
| `fee` | number | Transaction fee |
| `sms_fee` | number | SMS notification fee |
| `price` | number | Price |
| `payment` | string | Payment provider name |
| `payment_account` | string | Payment account number (masked) |
| `payment_account_name` | string | Payment account holder name |
| `payment_logo` | string | URL to payment provider logo |
| `payment_recommendation_id` | integer | Payment recommendation identifier |
| `ewallet_data` | object | E-wallet specific data |
| `notes` | object | Transaction notes with `en` (English) and `id` (Indonesian) keys |
| `metadata` | object | Additional metadata |

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

> **Note:**
> The `created` and `updated` timestamps are in Unix milliseconds (int64). Divide by 1000 to convert to standard Unix seconds.
