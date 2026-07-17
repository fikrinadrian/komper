---
title: Quickstart
description: Get started with the Reku API in 5 minutes
---

## Overview

This guide walks you through making your first API calls to fetch market data, check your balance, and place an order.

## Prerequisites

* Reku account with completed KYC verification
* API key generated from your dashboard
* Basic knowledge of REST APIs

### Test Your API Key

First, verify your API key works by fetching your profile:

```bash
curl -X GET "https://api.reku.id/v3/profile" \
  -H "API-Key: YOUR_API_KEY"
```

```python
import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "https://api.reku.id"

headers = {"API-Key": API_KEY}

response = requests.get(f"{BASE_URL}/v3/profile", headers=headers)
print(response.json())
```

```javascript
const axios = require('axios');

const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'https://api.reku.id';

const headers = { "API-Key": API_KEY };

axios.get(`${BASE_URL}/v3/profile`, { headers })
  .then(res => console.log(res.data));
```

**Expected Response:**

```json
{
  "message": "success",
  "result": {
    "id": "123456",
    "uid": 123456,
    "first_name": "John",
    "last_name": "Doe",
    "fullname": "John Doe",
    "email": "user@example.com",
    "phone_number": "+62812****5678",
    "level": 3,
    "status": 1
  }
}
```

The actual response contains more fields — see the [Profile endpoint](/docs/api-reference/general/profile) for full details.

### Get Market Data

Fetch current market prices for all trading pairs:

```bash
curl -X GET "https://api.reku.id/v3/market"
```

```python
response = requests.get(f"{BASE_URL}/v3/market")
market_data = response.json()

# Find BTC price
btc = next(c for c in market_data if c['cd'] == 'BTC')
print(f"BTC Price: Rp {btc['c']:,.0f}")
```

```javascript
axios.get(`${BASE_URL}/v3/market`)
  .then(res => {
    const btc = res.data.find(c => c.cd === 'BTC');
    console.log(`BTC Price: Rp ${btc.c.toLocaleString()}`);
  });
```

**Expected Response:**

```json
[
  {
    "id": 1,
    "n": "Bitcoin",
    "cd": "BTC",
    "logo": "https://images.reku.id/accounts/btc.png?v=5",
    "status": 1,
    "h": 1680000000,
    "l": 1620000000,
    "o": 1640000000,
    "c": 1650000000,
    "v": 15000000000,
    "cp24h": 2.5,
    "bp": 1649000000,
    "sp": 1651000000,
    "mp": 1650000000
  },
  {
    "id": 2,
    "n": "Ethereum",
    "cd": "ETH",
    "logo": "https://images.reku.id/accounts/eth.png?v=5",
    "status": 1,
    "h": 53000000,
    "l": 51000000,
    "o": 51500000,
    "c": 52000000,
    "v": 8000000000,
    "cp24h": 1.8,
    "bp": 51900000,
    "sp": 52100000,
    "mp": 52000000
  }
]
```

Field meanings: `cd` = code, `n` = name, `c` = current/close price, `h` = 24h high, `l` = 24h low, `o` = open, `v` = volume, `cp24h` = 24h change %, `bp` = best bid, `sp` = best ask, `mp` = mid price.

### Check Your Balance

View your wallet balances:

```bash
curl -X GET "https://api.reku.id/v3/balance" \
  -H "API-Key: YOUR_API_KEY"
```

```python
response = requests.get(f"{BASE_URL}/v3/balance", headers=headers)
balances = response.json()

print(f"IDR Balance: Rp {balances.get('rp', 0):,.0f}")
print(f"BTC Balance: {balances.get('BTC', 0):.8f}")
```

```javascript
axios.get(`${BASE_URL}/v3/balance`, { headers })
  .then(res => {
    console.log(`IDR Balance: Rp ${res.data.rp?.toLocaleString() || 0}`);
    console.log(`BTC Balance: ${res.data.BTC || 0}`);
  });
```

**Expected Response:**

```json
{
  "rp": 10000000,
  "BTC": 0.00150000,
  "ETH": 0.25000000,
  "rp_P": 0,
  "rp_R": 0
}
```

`rp` is your IDR balance. `rp_P` is pending, `rp_R` is reserved for open orders.

### View Order Book

Check the order book for a trading pair before placing an order:

```bash
curl -X GET "https://api.reku.id/v2/orderbook?symbol=BTC_IDR"
```

```python
response = requests.get(f"{BASE_URL}/v2/orderbook", params={"symbol": "BTC_IDR"})
orderbook = response.json()

# Each entry is [total_idr, price, amount]
print("Top 3 Buy Orders (Bids):")
for total_idr, price, amount in orderbook['b'][:3]:
    print(f"  Price: {price:,.0f}, Amount: {amount:.8f}")

print("\nTop 3 Sell Orders (Asks):")
for total_idr, price, amount in orderbook['s'][:3]:
    print(f"  Price: {price:,.0f}, Amount: {amount:.8f}")
```

```javascript
axios.get(`${BASE_URL}/v2/orderbook`, { params: { symbol: 'BTC_IDR' } })
  .then(res => {
    // Each entry is [total_idr, price, amount]
    console.log('Top Buy Orders:', res.data.b.slice(0, 3));
    console.log('Top Sell Orders:', res.data.s.slice(0, 3));
  });
```

### Place an Order

Place a limit buy order:

Use the coin ID from `/v2/coins` response (e.g., `1` for BTC, `2` for ETH). Note: `transtype` is `0` for buy, `1` for sell. The `amount` parameter is the **price**, and `total` is the **quantity**.

```bash
curl -X POST "https://api.reku.id/v2/order" \
  -H "API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "coin=1&transtype=0&amount=1600000000&total=160000"
```

```python
order_data = {
    "coin": 1,                # Coin ID (1=BTC, 2=ETH, etc.)
    "transtype": 0,           # 0=buy, 1=sell
    "amount": "1600000000",   # Price in IDR
    "total": "160000"         # IDR amount to spend (for buy)
}

response = requests.post(
    f"{BASE_URL}/v2/order",
    headers=headers,
    data=order_data  # Use 'data' for form-urlencoded
)
result = response.json()

if result.get('success') == 1:
    print("Order placed successfully!")
else:
    print(f"Error: {result.get('error')}")
```

```javascript
const orderData = new URLSearchParams({
  coin: '1',              // Coin ID (1=BTC, 2=ETH, etc.)
  transtype: '0',         // 0=buy, 1=sell
  amount: '1600000000',   // Price in IDR
  total: '160000'         // IDR amount to spend (for buy)
});

axios.post(`${BASE_URL}/v2/order`, orderData, { headers })
  .then(res => {
    if (res.data.success === 1) {
      console.log('Order placed successfully!');
    } else {
      console.log(`Error: ${res.data.error}`);
    }
  });
```

**Expected Response:**

```json
{
  "success": 1
}
```

On error, the response contains `errno` and `error` fields, e.g. `{"errno":111,"error":"Saldo Rupiah tidak cukup."}` (insufficient balance).

### Check Pending Orders

View your open orders:

```bash
curl -X GET "https://api.reku.id/v2/pendingorderall" \
  -H "API-Key: YOUR_API_KEY"
```

```python
response = requests.get(f"{BASE_URL}/v2/pendingorderall", headers=headers)
data = response.json()

# Response has 'order' array with abbreviated field names
for order in data.get('order', []):
    order_type = "buy" if order['tt'] == 0 else "sell"
    print(f"Order {order['id']}: {order_type} {order['oa']} {order['c']} @ {order['a']}")
```

The response wraps orders in an `order` array. Field meanings: `c` = coin code, `tt` = type (0=buy, 1=sell), `a` = price, `oa` = unfilled base quantity, `t` = unfilled quote quantity, `ta` = total quote quantity, `ot` = order time.

### Cancel an Order

Cancel a pending order if needed:

```bash
curl -X POST "https://api.reku.id/v2/cancelorder" \
  -H "API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=987654321"
```

```python
response = requests.post(
    f"{BASE_URL}/v2/cancelorder",
    headers=headers,
    data={"id": 987654321}
)
result = response.json()
if result.get('success') == 1:
    print("Order cancelled successfully")
else:
    print(f"Error: {result.get('error')}")
```

## Complete Example

Here's a complete Python script that demonstrates a trading workflow:

```python title="trading_example.py"
import os
import requests

# Configuration
API_KEY = os.environ.get('REKU_API_KEY')
BASE_URL = 'https://api.reku.id'

headers = {'API-Key': API_KEY}

def get_balance():
    """Fetch current wallet balances"""
    response = requests.get(f"{BASE_URL}/v3/balance", headers=headers)
    return response.json()

def get_market_price(coin_code):
    """Get current market price for a coin by code (e.g., 'BTC')"""
    response = requests.get(f"{BASE_URL}/v3/market")
    market = response.json()
    return next((c for c in market if c['cd'] == coin_code), None)

def place_order(coin_id, transtype, price, total):
    """Place a limit order using coin ID
    
    Args:
        coin_id: Coin ID (1=BTC, 2=ETH, etc.)
        transtype: 0=buy, 1=sell
        price: Price in IDR
        total: IDR amount for buy, crypto amount for sell
    """
    data = {
        'coin': coin_id,
        'transtype': transtype,
        'amount': price,      # 'amount' param = price
        'total': total         # 'total' param = quantity
    }
    response = requests.post(f"{BASE_URL}/v2/order", headers=headers, data=data)
    return response.json()

def main():
    # Check balance
    balance = get_balance()
    print(f"IDR Balance: Rp {balance.get('rp', 0):,.0f}")

    # Get BTC price (cd = code, c = current price)
    btc = get_market_price('BTC')
    if btc:
        print(f"BTC Price: Rp {btc['c']:,.0f}")

        # Place a buy order 5% below market price
        buy_price = int(btc['c'] * 0.95)
        idr_to_spend = 160000  # Spend 160,000 IDR
        result = place_order(btc['id'], 0, buy_price, idr_to_spend)

        if result.get('success') == 1:
            print("Order placed successfully!")
        else:
            print(f"Order failed: {result.get('error')}")

if __name__ == '__main__':
    main()
```

## Next Steps

Explore all available endpoints

Security best practices
