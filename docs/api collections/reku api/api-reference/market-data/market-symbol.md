---
title: Get Market Data by Symbol
description: Get market data for a specific cryptocurrency trading pair
---


# Get Market Data by Symbol

Get market data for a specific cryptocurrency trading pair.

## Endpoint

```
GET /v3/market/{symbol}
```

## Authentication

> **Note:**
> This is a public endpoint. No authentication required.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | Yes | Trading pair symbol in dash format (e.g., `BTC-IDR`, `ETH-IDR`). Pattern: `^[A-Z0-9]+-[A-Z]+$` |

> **Warning:**
> The symbol uses a **dash** separator (e.g., `BTC-IDR`), not an underscore.

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v3/market/BTC-IDR"
```
### JavaScript
```javascript
const symbol = 'BTC-IDR';
const response = await fetch(`https://api.reku.id/v3/market/${symbol}`);
const market = await response.json();
```
### Python
```python
import requests

symbol = 'BTC-IDR'
response = requests.get(f'https://api.reku.id/v3/market/{symbol}')
market = response.json()
```

## Response

### Success Response (200)

Returns a single MarketData object (same schema as [GET /v3/market](/docs/api-reference/market-data/market) but a single object, not an array).

```json
{
  "id": 1,
  "n": "Bitcoin",
  "cd": "BTC",
  "logo": "https://images.reku.id/accounts/btc.png?v=5",
  "logo_svg": "https://images.reku.id/accounts/btc.svg?v=5",
  "status": 1,
  "h": 1192810000,
  "l": 1136020000,
  "o": 1139830000,
  "c": 1181950000,
  "v": 24660743512,
  "cp": 3.7,
  "u": 1,
  "otc_id": 1,
  "bp": 1180990000,
  "sp": 1168330000,
  "mp": 1174660000,
  "cp5m": -0.51,
  "cp10m": -0.82,
  "cp1h": -1.31,
  "cp4h": 1.32,
  "cp24h": 2.93,
  "cp1w": 0,
  "cp1m": 0,
  "cp1y": 0,
  "cs": 19999268,
  "ms": 21000000,
  "ts": 19999268,
  "market_cap": 23638134812600000,
  "sorting": 1,
  "is_pro": true,
  "is_new": false,
  "is_stakable": false,
  "is_lite": true,
  "digits": 10000
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique coin identifier |
| `n` | string | Full name of the cryptocurrency |
| `cd` | string | Coin ticker symbol (code) |
| `logo` | string | URL to coin logo (PNG) |
| `logo_svg` | string | URL to coin logo (SVG) |
| `status` | integer | Trading status (`1` = active) |
| `h` | number | 24-hour high price in IDR |
| `l` | number | 24-hour low price in IDR |
| `o` | number | 24-hour open price in IDR |
| `c` | number | Current/close price in IDR |
| `v` | number | 24-hour trading volume in IDR |
| `cp` | number | Price change percentage (current period) |
| `cp5m` | number | 5-minute price change percentage |
| `cp10m` | number | 10-minute price change percentage |
| `cp1h` | number | 1-hour price change percentage |
| `cp4h` | number | 4-hour price change percentage |
| `cp24h` | number | 24-hour price change percentage |
| `cp1w` | number | 1-week price change percentage |
| `cp1m` | number | 1-month price change percentage |
| `cp1y` | number | 1-year price change percentage |
| `bp` | number | Best bid (buy) price in IDR |
| `sp` | number | Best ask (sell) price in IDR |
| `mp` | number | Mid price in IDR |
| `cs` | number | Circulating supply |
| `ms` | number | Max supply |
| `ts` | number | Total supply |
| `market_cap` | number | Market capitalization in IDR |
| `sorting` | integer | Display sort order |
| `is_pro` | boolean | Available in Pro mode |
| `is_new` | boolean | Recently listed coin |
| `is_stakable` | boolean | Available for staking |
| `is_lite` | boolean | Available in Lite mode |
| `digits` | integer | Display precision factor |

### Error Response (404)

```json
{
  "error": "Coin not found"
}
```
