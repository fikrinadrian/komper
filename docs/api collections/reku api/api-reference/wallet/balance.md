---
title: Get Balance
description: Returns the current balance of all assets in the user's wallet
---


# Get Balance

Returns the current balance of all assets in the user's wallet.

## Endpoint

```
GET /v3/balance
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
curl -X GET "https://api.reku.id/v3/balance" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v3/balance', {
  headers: {
    'API-Key': 'your_api_key'
  }
});
const balance = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v3/balance',
    headers={'API-Key': 'your_api_key'}
)
balance = response.json()
```

## Response

### Success Response (200)

```json
{
  "rp": 10000000,
  "rp_P": 0,
  "rp_R": 500000,
  "rp_RP": 0,
  "1": 0.0015,
  "BTC": 0.0015,
  "BTC_P": 0,
  "BTC_L": 0,
  "2": 0.25,
  "ETH": 0.25,
  "ETH_P": 0.05,
  "ETH_L": 0
}
```

### Response Fields

The response is a flat object with dynamic keys based on the user's assets.

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `rp` | number | IDR balance |
| `rp_P` | number | IDR balance on pending order |
| `rp_R` | number | Reward IDR balance |
| `rp_RP` | number | Reward IDR balance on pending order |
| `1`, `2`, ... | number | Available coin balance by coin ID |
| `BTC`, `ETH`, ... | number | Available coin balance by code |
| `BTC_P`, `ETH_P`, ... | number | Coin balance on pending order |
| `BTC_L`, `ETH_L`, ... | number | Locked/staking coin balance |

> **Note:**
> Coin balances appear as dynamic keys using both the coin code (e.g., `BTC`) and numeric coin ID (e.g., `1`). The `_P` suffix indicates balance locked in pending orders, and the `_L` suffix indicates balance locked in staking.

### Example: Parsing Balance

```javascript
const balance = await response.json();

// Get IDR balances
const idrAvailable = balance.rp;
const idrPending = balance.rp_P;
const idrReward = balance.rp_R;

// Get BTC balance (by code or by ID)
const btcAvailable = balance.BTC || balance['1'] || 0;
const btcPending = balance.BTC_P || 0;
const btcLocked = balance.BTC_L || 0;

console.log(`IDR Available: Rp ${idrAvailable.toLocaleString()}`);
console.log(`BTC Available: ${btcAvailable} BTC`);
```

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```
