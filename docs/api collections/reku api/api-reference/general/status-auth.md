---
title: Get Auth Status
description: Retrieve the user two-factor authentication (2FA) status and masked phone number
---


# Get Auth Status

Retrieve the user two-factor authentication (2FA) status and masked phone number.

## Endpoint

```
GET /v3/user/status-auth
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
curl -X GET "https://api.reku.id/v3/user/status-auth" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v3/user/status-auth', {
  headers: {
    'API-Key': 'your_api_key'
  }
});
const data = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v3/user/status-auth',
    headers={'API-Key': 'your_api_key'}
)
data = response.json()
```

## Response

### Success Response (200)

```json
{
  "message": "success get user authtype and phone number",
  "data": {
    "authtype": 1,
    "phone_number": "+62812****5678"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Response status message |
| `data` | object | Authentication status data |
| `data.authtype` | number | 2FA type: `0` = no 2FA, `1` = Authenticator App, `2` = SMS Token |
| `data.phone_number` | string | User's phone number (partially masked) |

### Auth Type Values

| Value | Description |
|-------|-------------|
| `0` | No two-factor authentication |
| `1` | Authenticator App (e.g., Google Authenticator) |
| `2` | SMS Token |

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```
