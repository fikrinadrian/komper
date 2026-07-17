---
title: Authentication
description: Learn how to authenticate your API requests
---

## Overview

The Reku API uses API Key authentication. Every request to authenticated endpoints must include your API key in the request headers.

## Getting Your API Key

The API Keys feature is not enabled for all users by default. To request access, please send an email to **dev@reku.id** with your account details and use case. Once approved, you will be able to generate API keys from your dashboard.

### Request API Access

Send an email to **dev@reku.id** to request the API Keys feature to be enabled for your account. Include your registered email and intended use case.

### Log in to Reku

Once approved, visit [reku.id](https://reku.id) and log in to your account.

### Navigate to API Settings

Go to **Settings** > **API Keys** in your dashboard.

### Generate New Key

Click "Generate API Key" and securely store both your API Key and Secret.

Your API Secret is only shown once during creation. Store it securely - you cannot retrieve it later.

## Authentication Headers

Include your API key in the `API-Key` header for all authenticated requests:

```bash
curl -X GET "https://api.reku.id/v3/profile" \
  -H "API-Key: your-api-key-here" \
  -H "Content-Type: application/json"
```

### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `API-Key` | Your API key | Yes (for authenticated endpoints) |
| `Content-Type` | `application/json` | Yes (for POST requests) |

## Code Examples

```bash
curl -X GET "https://api.reku.id/v3/balance" \
  -H "API-Key: your-api-key-here"
```

```python
import requests

headers = {
    "API-Key": "your-api-key-here",
    "Content-Type": "application/json"
}

response = requests.get(
    "https://api.reku.id/v3/balance",
    headers=headers
)

print(response.json())
```

```javascript
const axios = require('axios');

const config = {
  headers: {
    'API-Key': 'your-api-key-here',
    'Content-Type': 'application/json'
  }
};

axios.get('https://api.reku.id/v3/balance', config)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
```

```go
package main

import (
    "fmt"
    "io"
    "net/http"
)

func main() {
    req, _ := http.NewRequest("GET", "https://api.reku.id/v3/balance", nil)
    req.Header.Set("API-Key", "your-api-key-here")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```

## Public vs Authenticated Endpoints

### Public Endpoints (No Authentication Required)

These endpoints can be accessed without an API key:

| Endpoint | Description |
|----------|-------------|
| `GET /v2/coins` | List available cryptocurrencies |
| `GET /v3/market` | Get market data and prices |
| `GET /v2/orderbook` | Get order book for a trading pair |

### Authenticated Endpoints

These endpoints require a valid API key:

| Endpoint | Description |
|----------|-------------|
| `GET /v3/profile` | Get user profile information |
| `GET /v3/balance` | Get wallet balances |
| `POST /v2/order` | Place a new order |
| `POST /v2/cancelorder` | Cancel an existing order |
| `GET /v2/pendingorderall` | List pending orders |
| `GET /v3/wallet/asset/history` | Get asset transaction history |

## Security Best Practices

## Environment Variables Example

```bash title=".env"
# Never commit this file to version control
REKU_API_KEY=your-api-key-here
REKU_API_URL=https://api.reku.id
```

```python
import os
import requests

api_key = os.environ.get('REKU_API_KEY')
api_url = os.environ.get('REKU_API_URL', 'https://api.reku.id')

headers = {"API-Key": api_key}
response = requests.get(f"{api_url}/v3/balance", headers=headers)
```

## Error Responses

When authentication fails, the API returns an error response:

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

| Error Code | Description | Solution |
|------------|-------------|----------|
| 1001 | Invalid API key | Check that your API key is correct |
| 1002 | API key expired | Generate a new API key |
| 1003 | API key revoked | Contact support or generate a new key |
| 1004 | Insufficient permissions | Check your API key permissions |
| 1005 | IP not whitelisted | Add your IP to the whitelist in your dashboard |

See the error table above for common authentication error responses.
