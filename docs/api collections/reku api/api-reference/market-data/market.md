---
title: Get Market Data
description: Returns current market data including prices and 24-hour statistics
---


# Get Market Data

Returns current market data including prices, OHLCV, and volumes for all coins.

## Endpoint

```
GET /v3/market
```

## Authentication

> **Note:**
> This is a public endpoint. No authentication required.

## Request

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v3/market"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v3/market');
const market = await response.json();
```
### Python
```python
import requests

response = requests.get('https://api.reku.id/v3/market')
market = response.json()
```

## Response

### Success Response (200)

```json
[
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
    "gv": 268969499568890,
    "market_cap": 23638134812600000,
    "sorting": 1,
    "sorting_new_listing": 0,
    "is_pro": true,
    "is_new": false,
    "is_stakable": false,
    "is_lite": true,
    "digits": 10000,
    "volume_decimals": 0,
    "price_decimals": 0
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique coin identifier |
| `n` | string | Full name of the cryptocurrency |
| `cd` | string | Coin ticker symbol (code) |
| `logo` | string | URL to coin logo (PNG) |
| `logo_svg` | string | URL to coin logo (SVG) |
| `status` | integer | Trading status (1=active) |
| `h` | number | 24-hour high price in IDR |
| `l` | number | 24-hour low price in IDR |
| `o` | number | 24-hour open price in IDR |
| `c` | number | Current/close price in IDR |
| `v` | number | 24-hour trading volume in IDR |
| `cp` | number | Price change percentage (current period) |
| `u` | integer | Update flag |
| `otc_id` | integer | OTC product identifier |
| `bp` | number | Best bid (buy) price in IDR |
| `sp` | number | Best ask (sell) price in IDR |
| `mp` | number | Mid price in IDR |
| `cp5m` | number | 5-minute price change % |
| `cp10m` | number | 10-minute price change % |
| `cp1h` | number | 1-hour price change % |
| `cp4h` | number | 4-hour price change % |
| `cp24h` | number | 24-hour price change % |
| `cp1w` | number | 1-week price change % |
| `cp1m` | number | 1-month price change % |
| `cp1y` | number | 1-year price change % |
| `cs` | number | Circulating supply |
| `ms` | number | Max supply |
| `ts` | number | Total supply |
| `gv` | number | Global volume |
| `market_cap` | number | Market capitalization in IDR |
| `sorting` | integer | Display sort order |
| `sorting_new_listing` | integer | New listing sort order |
| `is_pro` | boolean | Available in Pro mode |
| `is_new` | boolean | New listing flag |
| `is_stakable` | boolean | Staking available |
| `is_lite` | boolean | Available in Lite mode |
| `digits` | integer | Display multiplier |
| `volume_decimals` | integer | Volume decimal places |
| `price_decimals` | integer | Price decimal places |

> **Note:**
> All prices are in IDR (Indonesian Rupiah). The market data is updated in real-time.
