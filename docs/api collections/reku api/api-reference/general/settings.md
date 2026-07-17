---
title: Get System Settings
description: Returns platform configuration including fees, limits, and system status
---


# Get System Settings

Returns platform configuration including deposit/withdrawal limits, fees, and system status.

## Endpoint

```
GET /v2/settings
```

## Authentication

> **Note:**
> This is a public endpoint. No authentication required.

## Request

### Example Request

### cURL
```bash
curl -X GET "https://api.reku.id/v2/settings"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v2/settings');
const settings = await response.json();
```
### Python
```python
import requests

response = requests.get('https://api.reku.id/v2/settings')
settings = response.json()
```

## Response

### Success Response (200)

```json
{
  "usercolor": 1,
  "recaptcha": 1,
  "levelstatus": 0,
  "internaltransfer_fee": 0,
  "withdraw_fee": [0],
  "periodfiat": ["1 days"],
  "min_withdraw": 30000,
  "min_withdraw_fee": 6500,
  "max_withdraw": [500000000],
  "min_deposit": 10000,
  "deposit_fee": 0,
  "matic_send": 0,
  "smsfee": 750,
  "min_deposit_fee": 0,
  "maintenance": 0,
  "maintenance_note": "",
  "pctmarketpricebuy": 50,
  "pctmarketpricesell": 200,
  "minprice": 30000,
  "version": "3.0.03",
  "min_withdraw_refferal": 0,
  "max_withdraw_refferal": 100000,
  "vatbuy": 0.0111,
  "vatsell": 0.2211,
  "vatwdcoin": 0,
  "vatwdidr": 0,
  "vatdepocoin": 0,
  "vatdepoidr": 0,
  "vatinternalwdcoin": 0,
  "vatinternaldepocoin": 0,
  "vatinternalwdidr": 0,
  "vatinternaldepoidr": 0,
  "vatevent": 0,
  "vatwdrefferal": 0,
  "notes": [
    "Minimal Penarikan Rp30.000",
    "Maksimal Penarikan Rp500.000.000 per 1 hari"
  ],
  "verification_message": "Permohonan verifikasi anda telah kami terima. Proses verifikasi akan memakan waktu 1x24 jam.",
  "expired_deposit_bank": 10800000
}
```

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `usercolor` | integer | User color theme setting |
| `recaptcha` | integer | Recaptcha enabled flag (1=enabled) |
| `levelstatus` | integer | Level status flag |
| `internaltransfer_fee` | number | Fee for internal transfers |
| `withdraw_fee` | array | Withdrawal fee tiers |
| `periodfiat` | array | Fiat withdrawal period limits |
| `min_withdraw` | number | Minimum withdrawal amount in IDR |
| `min_withdraw_fee` | number | Minimum withdrawal fee in IDR |
| `max_withdraw` | array | Maximum withdrawal limits per tier |
| `min_deposit` | number | Minimum deposit amount in IDR |
| `deposit_fee` | number | Deposit fee |
| `smsfee` | number | SMS notification fee in IDR |
| `maintenance` | integer | Maintenance mode flag (0=normal, 1=maintenance) |
| `maintenance_note` | string | Maintenance message text |
| `pctmarketpricebuy` | number | Max % deviation allowed for buy price from market |
| `pctmarketpricesell` | number | Max % deviation allowed for sell price from market |
| `minprice` | number | Minimum order price in IDR |
| `version` | string | API version |
| `vatbuy` | number | VAT rate for buy transactions |
| `vatsell` | number | VAT rate for sell transactions |
| `notes` | array | User-facing withdrawal notes (Indonesian) |
| `expired_deposit_bank` | integer | Bank deposit expiry time in milliseconds |
