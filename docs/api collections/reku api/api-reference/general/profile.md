---
title: Get User Profile
description: Returns the profile information for the authenticated user
---


# Get User Profile

Returns the profile information for the authenticated user.

## Endpoint

```
GET /v3/profile
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
curl -X GET "https://api.reku.id/v3/profile" \
  -H "API-Key: your_api_key"
```
### JavaScript
```javascript
const response = await fetch('https://api.reku.id/v3/profile', {
  headers: {
    'API-Key': 'your_api_key'
  }
});
const profile = await response.json();
```
### Python
```python
import requests

response = requests.get(
    'https://api.reku.id/v3/profile',
    headers={'API-Key': 'your_api_key'}
)
profile = response.json()
```

## Response

### Success Response (200)

```json
{
  "message": "success",
  "code": 200,
  "status": true,
  "result": {
    "id": "68f411a56080ee503fc2c8804b400609",
    "uid": 123456,
    "datetime": "2023-01-15 10:30:00",
    "first_name": "John",
    "last_name": "Doe",
    "fullname": "John Doe",
    "email": "user@example.com",
    "date_of_birth": "1990-01-15",
    "dob": "1990-01-15",
    "alias": "johndoe",
    "street_address1": "Jl. Sudirman No. 1",
    "street_address_2": "",
    "gender": 1,
    "country": "ID",
    "city": "Jakarta",
    "postal_code": "12345",
    "jenisid": 1,
    "no_identitas": "320101********0001",
    "citizen": 0,
    "authtype": 1,
    "hash": "a1b2c3d4e5f6g7h8",
    "status": 1,
    "statususer": 7,
    "level": 3,
    "lastaccess": "2024-01-15 10:30:00",
    "ipaddress": "192.168.1.1",
    "bannedexpired": 0,
    "lang": "id",
    "mode": 1,
    "is_allow_change_password": true,
    "is_vip": false,
    "phone_number": "+62812****5678",
    "risk_level_name": "Aggressive",
    "risk_level": "3",
    "risk_level_type": 3,
    "risk_level_quiz_taken_at": "2024-01-10T08:00:00Z",
    "kyc_status_bappebti": true,
    "kyc_status_uss": false,
    "is_corporate": false,
    "kyc_last_submission_date": {
      "submitted_date": "2023-01-10T00:00:00Z",
      "approved_date": "2023-01-12T00:00:00Z",
      "rejected_date": null
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Response status message |
| `code` | integer | HTTP status code (200) |
| `status` | boolean | Response status flag |
| `result` | object | User profile data |

### Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique user identifier (hashed string) |
| `uid` | number | Numeric user identifier |
| `datetime` | string | Account creation timestamp |
| `first_name` | string | User's first name |
| `last_name` | string | User's last name |
| `fullname` | string | User's full name |
| `email` | string | User's email address |
| `date_of_birth` | string | Date of birth |
| `dob` | string | Date of birth (same as date_of_birth) |
| `alias` | string | User alias |
| `street_address1` | string | Primary street address |
| `street_address_2` | string | Secondary street address |
| `gender` | integer | Gender: `1` = male, `2` = female |
| `country` | string | Country code |
| `city` | string | City name |
| `postal_code` | string | Postal code |
| `jenisid` | integer | ID document type: `1` = KTP, `2` = Passport |
| `no_identitas` | string | ID document number (masked) |
| `citizen` | integer | Citizenship: `0` = Indonesian, `1` = Foreign |
| `authtype` | integer | 2FA type: `0` = none, `1` = Authenticator, `2` = SMS |
| `hash` | string | User hash identifier |
| `status` | integer | Account status |
| `statususer` | integer | User verification status (`7` = verified) |
| `level` | integer | Account verification level |
| `lastaccess` | string | Last access timestamp |
| `ipaddress` | string | Last access IP address |
| `bannedexpired` | integer | Ban status (`0` = not banned) |
| `lang` | string | Preferred language |
| `mode` | number | Trading mode preference |
| `is_allow_change_password` | boolean | Whether password change is allowed |
| `is_vip` | boolean | VIP status |
| `phone_number` | string | Phone number (partially masked) |
| `risk_level_name` | string | Risk level label (e.g., "Conservative", "Aggressive") |
| `risk_level` | string | Risk level value |
| `risk_level_type` | integer | Risk level type identifier |
| `risk_level_quiz_taken_at` | string | Timestamp of risk assessment quiz (date-time) |
| `kyc_status_bappebti` | boolean | KYC status for Bappebti (crypto) |
| `kyc_status_uss` | boolean | KYC status for US Stocks |
| `is_corporate` | boolean | Whether this is a corporate account |
| `kyc_last_submission_date` | object | KYC submission dates |
| `kyc_last_submission_date.submitted_date` | string\|null | KYC submission date (date-time) |
| `kyc_last_submission_date.approved_date` | string\|null | KYC approval date (date-time) |
| `kyc_last_submission_date.rejected_date` | string\|null | KYC rejection date (date-time) |

### Error Response (401)

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```
