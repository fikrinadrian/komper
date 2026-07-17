---
title: Cancel Order
description: Cancels an existing pending order
---


# Cancel Order

Cancels an existing pending order.

## Endpoint

```
POST /v2/cancelorder
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
| `id` | integer | Yes | The order ID to cancel (from `/v2/pendingorderall`) |

### Example Request

### cURL
```bash
curl -X POST "https://api.reku.id/v2/cancelorder" \
  -H "API-Key: your_api_key" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=987654321"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v2/cancelorder', {
  method: 'POST',
  headers: {
    'API-Key': 'your_api_key',
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    id: '987654321'
  })
});
const result = await response.json();
```
### Python
```python
import requests

response = requests.post(
    'https://api.reku.id/v2/cancelorder',
    headers={'API-Key': 'your_api_key'},
    data={'id': 987654321}
)
result = response.json()
```

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
| `success` | integer | `1` indicates the order was cancelled successfully |

### Error Responses

#### Unauthorized (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

#### Order Not Found

```json
{
  "errno": 2010,
  "error": "Order not found"
}
```

> **Note:**
> If an order is partially filled, only the unfilled portion will be cancelled.
