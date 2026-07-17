# Private REST API

Authentication, signed-request rules, account trading endpoints, and wallet endpoints.

## Table of Contents

- [Authentication and Signed Requests](#authentication-and-signed-requests)
  - [Endpoint security type](#endpoint-security-type)
  - [SIGNED Endpoint security](#signed-endpoint-security)
    - [Timing security](#timing-security)
    - [SIGNED Endpoint Examples for POST /open/v1/orders](#signed-endpoint-examples-for-post-openv1orders)
      - [Example 1: As a request body](#example-1-as-a-request-body)
      - [Example 2: As a query string](#example-2-as-a-query-string)
      - [Example 3: Mixed query string and request body](#example-3-mixed-query-string-and-request-body)
- [Account endpoints](#account-endpoints)
  - [New order (SIGNED)](#new-order-signed)
  - [Query order (SIGNED)](#query-order-signed)
  - [Cancel order (SIGNED)](#cancel-order-signed)
  - [All orders (SIGNED)](#all-orders-signed)
  - [New OCO (SIGNED)](#new-oco-signed)
  - [Account information (SIGNED)](#account-information-signed)
  - [Account Asset information (SIGNED)](#account-asset-information-signed)
  - [Account trade list (SIGNED)](#account-trade-list-signed)
- [Wallet Endpoints](#wallet-endpoints)
  - [Withdraw (SIGNED)](#withdraw-signed)
  - [Withdraw History (SIGNED)](#withdraw-history-signed)
  - [Deposit History (SIGNED)](#deposit-history-signed)
  - [Deposit Address (SIGNED)](#deposit-address-signed)

## Authentication and Signed Requests

### Endpoint security type

-   Each endpoint has a security type that determines the how you will interact with it. This is stated next to the NAME of the endpoint.

    -   If no security type is stated, assume the security type is NONE.
-   API-keys are passed into the Rest API via the `X-MBX-APIKEY` header.
-   API-keys and secret-keys **are case sensitive**.
-   API-keys can be configured to only access certain types of secure endpoints. For example, one API-key could be used for SIGNED only, while another API-key can access everything except for SIGNED routes.
-   By default, API-keys can access all secure routes.

| Security Type | Description |
| --- | --- |
| NONE | Endpoint can be accessed freely. |
| SIGNED | Endpoint requires sending a valid API-Key and signature. |
| API\_KEY | Endpoint requires sending a valid API-Key. |

### SIGNED Endpoint security

-   `SIGNED` endpoints require an additional parameter, `signature`, to be sent in the `query string` or `request body`.

-   Endpoints use `HMAC SHA256` signatures. The `HMAC SHA256 signature` is a keyed `HMAC SHA256` operation. Use your `secretKey` as the key and `totalParams` as the value for the HMAC operation.

-   The `signature` is **not case sensitive**.

-   `totalParams` is defined as the `query string` concatenated with the `request body`.

#### Timing security

-   A `SIGNED` endpoint also requires a parameter, `timestamp`, to be sent which should be the millisecond timestamp of when the request was created and sent.

-   An additional parameter, `recvWindow`, may be sent to specify the number of milliseconds after `timestamp` the request is valid for. If `recvWindow` is not sent, **it defaults to 5000**.

-   The logic is as follows:

    ```
    if (timestamp < (serverTime + 1000) && (serverTime - timestamp) <= recvWindow)
     {
       // process request
     } 
     else 
     {
       // reject request
     }
    ```

    **Serious trading is about timing.** Networks can be unstable and unreliable, which can lead to requests taking varying amounts of time to reach the servers. With `recvWindow`, you can specify that the request must be processed within a certain number of milliseconds or be rejected by the server.

**It is recommended to use a small recvWindow of 5000 or less! The max cannot go beyond 60,000!**

#### SIGNED Endpoint Examples for POST /open/v1/orders

Here is a step-by-step example of how to send a vaild signed payload from the Linux command line using `echo`, `openssl`, and `curl`.

| Key | Value |
| --- | --- |
| apiKey | cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV |
| secretKey | f9AbA6a8AD6bC2a97294a212244dda04ETfl0kc4BSUGOtL7m7rNELpt3Jh25SiP |

| Parameter | Value |
| --- | --- |
| symbol | BTC\_USDT |
| side | 0 |
| type | 1 |
| quantity | '0.16' |
| price | '7500' |
| recvWindow | 5000 |
| timestamp | 1581720670624 |

##### Example 1: As a request body

-   **requestBody:** symbol=BTC\_USDT&side=0&type=1&quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000

-   **HMAC SHA256 signature:**

    ```
    [linux]$ echo -n "symbol=BTC_USDT&side=0&type=1&quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000" | openssl dgst -sha256 -hmac "cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV"
    (stdin)= 33824b5160daefc34257ab9cd3c3db7a0158a446674f896c9fc3b122ae656bfa
    ```

-   **curl command:**

    ```
    (HMAC SHA256)
    [linux]$  curl -H "X-MBX-APIKEY: cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV" -X POST 'https://www.tokocrypto.com/open/v1/orders' -d 'symbol=BTC_USDT&side=0&type=1&quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000&signature=33824b5160daefc34257ab9cd3c3db7a0158a446674f896c9fc3b122ae656bfa'
    ```

##### Example 2: As a query string

-   **queryString:** symbol=BTC\_USDT&side=0&type=1&quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000

-   **HMAC SHA256 signature:**

    ```
    [linux]$ echo -n "symbol=BTC_USDT&side=0&type=1&quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000" | openssl dgst -sha256 -hmac "cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV"
    (stdin)= 33824b5160daefc34257ab9cd3c3db7a0158a446674f896c9fc3b122ae656bfa
    ```

-   **curl command:**

    ```
    (HMAC SHA256)
    [linux]$ curl -H "X-MBX-APIKEY: cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV" -X POST 'https://www.tokocrypto.com/open/v1/orders?symbol=BTC_USDT&side=0&type=1&quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000&signature=33824b5160daefc34257ab9cd3c3db7a0158a446674f896c9fc3b122ae656bfa'
    ```

##### Example 3: Mixed query string and request body

-   **queryString:** symbol=BTC\_USDT&side=0&type=1

-   **requestBody:** quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559

-   **requestBody:** symbol=BTC\_USDT&side=0&type=1quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000

-   **HMAC SHA256 signature:**

    ```
    [linux]$ echo -n "symbol=BTC_USDT&side=0&type=1quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000" | openssl dgst -sha256 -hmac "cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV"
    (stdin)= 27dbb813ab6ee7ef61902f88f1a0a6cd4daca0503a5195dbdd3174f49a61ad79
    ```

-   **curl command:**

    ```
    (HMAC SHA256)
    [linux]$ curl -H "X-MBX-APIKEY: cfDC92B191b9B3Ca3D842Ae0e01108CBKI6BqEW6xr4NrPus3hoZ9Ze9YrmWwPFV" -X POST 'https://www.tokocrypto.com/open/v1/orders?symbol=BTC_USDT&side=0&type=1' -d 'quantity=0.16&price=7500&timestamp=1581720670624&recvWindow=5000&signature=27dbb813ab6ee7ef61902f88f1a0a6cd4daca0503a5195dbdd3174f49a61ad79'
    ```

Note that the signature is different in example 3. There is no & between "1" and "quantity=1".

## Account endpoints

### New order (SIGNED)

```http
POST /open/v1/orders  (HMAC SHA256)
```

Send in a new order.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| symbol | STRING | YES |  |
| side | ENUM | YES | 0,1 |
| type | ENUM | YES | 1,2,4,6 |
| timeInForce | ENUM | NO | 1 GTC-Good Till Cancel; 2 IOC-Immediate or Cancel; 3 FOK-Fill or Kill; 4 GTX-Good Till Crossing |
| quantity | STRING | NO |  |
| quoteOrderQty | STRING | NO |  |
| price | STRING | NO |  |
| clientId | STRING | NO | Client's custom ID for the order, Server does not check it's uniqueness. Automatically generated if not sent. |
| stopPrice | STRING | NO | Used with `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, and `TAKE_PROFIT_LIMIT` orders. |
| icebergQty | STRING | NO | Used with `LIMIT`, `STOP_LOSS_LIMIT`, and `TAKE_PROFIT_LIMIT` to create an iceberg order. |
| selfTradePreventionMode | ENUM | NO | The allowed enums is dependent on what is configured on the symbol.  <br>The possible supported values are `0 - EXPIRE_MAKER`, `1 - EXPIRE_TAKER`, `2 - EXPIRE_BOTH`, `4 - DECREMENT`, `5 - TRANSFER`. |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

Additional mandatory parameters based on `type`:

| Type | Additional mandatory parameters |
| --- | --- |
| `1` | `quantity`, `price` |
| `2` | `quantity` (sell) or `quoteOrderQty` (buy) |
| `3` | `quantity`, `stopPrice` |
| `4` | `quantity`, `price`, `stopPrice` |
| `5` | `quantity`, `stopPrice` |
| `6` | `quantity`, `price`, `stopPrice` |
| `7` | `quantity`, `price` |

Other info:

-   `LIMIT_MAKER` are `LIMIT` orders that will be rejected if they would immediately match and trade as a taker.
-   `STOP_LOSS` and `TAKE_PROFIT` will execute a `MARKET` order when the `stopPrice` is reached.
-   Any `LIMIT` or `LIMIT_MAKER` type order can be made an iceberg order by sending an `icebergQty`.
-   Any order with an `icebergQty` MUST have `timeInForce` set to `GTC`.
-   `MARKET` orders using `quantity` specifies how much a user wants to buy or sell based on the market price.
-   `MARKET` orders using `quoteOrderQty` specifies the amount the user wants to spend (when buying) of the quote asset; the correct `quantity` will be determined based on the market liquidity and `quoteOrderQty`.
-   `MARKET` orders using `quoteOrderQty` will not break `LOT_SIZE` filter rules; the order will execute a `quantity` that will have the notional value as close as possible to `quoteOrderQty`.

Trigger order price rules against market price for both MARKET and LIMIT versions:

-   Price above market price: `STOP_LOSS` `BUY`, `TAKE_PROFIT` `SELL`
-   Price below market price: `STOP_LOSS` `SELL`, `TAKE_PROFIT` `BUY`

**Response:**

```json
{
    "code": 0,
    "message": "Success",
    "messageDetail": null,
    "data": {
        "orderId": 305549804,
        "clientId": "398035221307693184",
        "symbol": "TKO_IDR",
        "symbolType": 3,
        "side": 0,
        "type": 1,
        "price": "5653",
        "origQty": "4",
        "origQuoteQty": "22612",
        "executedQty": "0",
        "executedPrice": "0",
        "executedQuoteQty": "0",
        "timeInForce": 1,
        "stopPrice": "0",
        "icebergQty": "0",
        "status": 0,
        "isWorking": 1,
        "createTime": 1719980695955,
        "borderId": "5614043",
        "borderListId": 0
    },
    "timestamp": 1719980696090,
    "success": true
} 
```

### Query order (SIGNED)

```http
GET /open/v1/orders/detail (HMAC SHA256)
```

Check an order's status.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| orderId | LONG | YES |  |
| clientId | String | NO |  |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

**Response:**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "orderId": "4", // order id
        "bOrderId": "100001", // match engine order id
        "bOrderListId": -1, // Unless part of an OCO, the value will always be -1.
        "clientId": "1aa4f99ad7bc4fab903395afd25d0597", // client custom order id
        "symbol": "BTC_USDT",
        "side": 1,
        "type": 1,
        "price": 1,
        "status": 0,
        "origQty": 10.88,
        "origQuoteQty": 0,
        "executedQty": 0,
        "executedPrice": 0,
        "executedQuoteQty": 0,
        "taxFee": "0.12052382",
        "taxFeeAsset": "USDT",
        "createTime": 1550130502000
    },
    "timestamp": 1550130554182
}
```

### Cancel order (SIGNED)

```http
POST /open/v1/orders/cancel  (HMAC SHA256)
```

Cancel an active order.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| orderId | LONG | NO | Either **`orderId`** or **`clientId`** must be provided |
| clientId | String | NO | Either **`orderId`** or **`clientId`** must be provided |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

**Response:**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "orderId": "4", // order id
        "bOrderId": "100001", // match engine order id
        "bOrderListId": -1, // Unless part of an OCO, the value will always be -1.
        "clientId": "1aa4f99ad7bc4fab903395afd25d0597", // client custom order id
        "symbol": "BTC_USDT",
        "side": 1,
        "type": 1,
        "price": 1,
        "status": 0,
        "origQty": 10.88,
        "origQuoteQty": 0,
        "executedQty": 0,
        "executedPrice": 0,
        "executedQuoteQty": 0,
        "createTime": 1550130502000
    },
    "timestamp": 1550130554182
}
```

### All orders (SIGNED)

```http
GET /open/v1/orders (HMAC SHA256)
```

Get all account orders; active, canceled, or filled.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| symbol | STRING | YES |  |
| type | ENUM | NO | 1-open, 2-history, -1-all |
| side | ENUM | NO |  |
| startTime | LONG | NO |  |
| endTime | LONG | NO |  |
| fromId | String | NO | start order ID the searching to begin with. |
| direct | ENUM | NO | searching direction: prev - in ascending order from the start order ID; next - in descending order from the start order ID |
| limit | INT | NO | Default 500; max 1000. |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

**Notes:**

-   if field "fromId" is defined, this field "direct" becomes mandatory.

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "list": [
            {
                "orderId": "4", // order id
                "bOrderId": "100001", // match engine order id
                "bOrderListId": -1, // Unless part of an OCO, the value will always be -1.
                "clientId": "1aa4f99ad7bc4fab903395afd25d0597", // client custom order id
                "symbol": "ADA_USDT",
                "symbolType": 1,
                "side": 1,
                "type": 1,
                "price": "0.1",
                "origQty": "10",
                "origQuoteQty": "1",
                "executedQty": "0",
                "executedPrice": "0",
                "executedQuoteQty": "0",
                "timeInForce": 1,
                "stopPrice": "0.0000000000000000",
                "icebergQty": "0.0000000000000000",
                "status": 0,
                "isWorking": 0,
                "createTime": 1572692016811
            }
        ]
    },
    "timestamp": 1572860756458
}
```

### New OCO (SIGNED)

```http
POST /open/v1/orders/oco (HMAC SHA256)
```

Send in a new OCO

**Parameters**:

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| symbol | STRING | YES |  |
| listClientId | STRING | NO | Client's custom ID for the entire orderList, Server does not check it's uniqueness. Automatically generated if not sent. |
| side | ENUM | YES |  |
| quantity | STRING | YES |  |
| limitClientId | STRING | NO | Client's custom ID for the limit order, Server does not check it's uniqueness. Automatically generated if not sent. |
| price | STRING | YES |  |
| stopClientId | STRING | NO | Client's custom ID for the stop loss/stop loss limit order, Server does not check it's uniqueness. Automatically generated if not sent. |
| stopPrice | STRING | YES | Stop price |
| stopLimitPrice | STRING | YES | Stop limit price. |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

Additional Info:

-   Price Restrictions:

    -   `SELL`: Limit Price > Last Price > Stop Price
    -   `BUY`: Limit Price < Last Price < Stop Price

**Response:**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "bOrderListId": "100001", // oco master order id
        "listClientId": "2aa4f99ad7bc4fab903395afd25d0598", // client custom master order id
        "symbol": "BTC_USDT",
        "symbolType": 1,
        "contingencyType": "OCO",
        "listStatusType": "EXEC_STARTED",
        "listOrderStatus": "EXECUTING",
        "createTime": 1572692016811,
        "orders": [{
            "orderId": "1001", // order id
            "bOrderId": "10001", // match engine order id
            "bOrderListId": "100001", // Unless part of an OCO, the value will always be -1.
            "clientId": "1aa4f99ad7bc4fab903395afd25d0597", // client custom order id
            "symbol": "BTC_USDT",
            "symbolType": 1,
            "side": 1,
            "type": 1,
            "price": "0.1",
            "origQty": "10",
            "origQuoteQty": "1",
            "executedQty": "0",
            "executedPrice": "0",
            "executedQuoteQty": "0",
            "timeInForce": 1,
            "stopPrice": "0.0000000000000000",
            "icebergQty": "0.0000000000000000",
            "status": 0,
            "isWorking": 0,
            "createTime": 1572692016811
        }, {
            "orderId": "1002", // order id
            "bOrderId": "10002", // match engine order id
            "bOrderListId": "100001", // Unless part of an OCO, the value will always be -1.
            "clientId": "1aa4f99ad7bc4fab903395afd25d0598", // client custom order id
            "symbol": "BTC_USDT",
            "symbolType": 1,
            "side": 1,
            "type": 1,
            "price": "0.2",
            "origQty": "10",
            "origQuoteQty": "1",
            "executedQty": "0",
            "executedPrice": "0",
            "executedQuoteQty": "0",
            "timeInForce": 1,
            "stopPrice": "0.0000000000000000",
            "icebergQty": "0.0000000000000000",
            "status": 0,
            "isWorking": 0,
            "createTime": 1572692016811
        }]
    },
    "timestamp": 1550130502489
}
```

### Account information (SIGNED)

```http
GET /open/v1/account/spot (HMAC SHA256)
```

Get current account information.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "makerCommission": "10.00000000",
        "takerCommission": "10.00000000",
        "buyerCommission": "0.00000000",
        "sellerCommission": "0.00000000",
        "canTrade": 1,
        "canWithdraw": 1,
        "canDeposit": 1,
        "accountAssets": [
            {
                "asset": "ADA",
                "free": "272.5550000000000000",
                "locked": "3.0000000000000000"
            }
        ]
    },
    "timestamp": 1572514387348
}
```

### Account Asset information (SIGNED)

```http
GET /open/v1/account/spot/asset (HMAC SHA256)
```

Get current account information for a specific asset.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| asset | STRING | YES |  |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": {
          "asset": "ADA",
          "free": "272.5550000000000000",
          "locked": "3.0000000000000000",
    },
    "timestamp": 1572514387348
}
```

### Account trade list (SIGNED)

```http
GET /open/v1/orders/trades  (HMAC SHA256)
```

Get trades for a specific account and symbol.

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| symbol | STRING | YES |  |
| orderId | String | NO |  |
| startTime | LONG | NO |  |
| endTime | LONG | NO |  |
| fromId | LONG | NO | TradeId to fetch from. Default gets most recent trades. |
| direct | ENUM | NO | searching direction: prev - in ascending order from the start order ID; next - in descending order from the start order ID |
| limit | INT | NO | Default 500; max 1000. |
| recvWindow | LONG | NO | The value cannot be greater than `60000` |
| timestamp | LONG | YES |  |
| rebateStatus | INT | NO | When return 10, means system completed the trading fee calculation |

**Notes:**

-   if field "fromId" is defined, this field "direct" becomes mandatory.

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "list": [
            {
                "tradeId": "3",
                "orderId": "2",
                "symbol": "ADA_USDT",
                "price": "0.04398",
                "qty": "250",
                "matchId": "12345",
                "quoteQty": "10.995",
                "commission": "0.25",
                "commissionAsset": "ADA",
                "isBuyer": 1,
                "isMaker": 0,
                "isBestMatch": 1,
                "taxAmount": "0.0942900000000000",
                "taxRate": "0.0021000000000000",
                "time": "1572920872276"
            }
        ]
    },
    "timestamp": 1573723498893
}
```

**Notes:**

-   The matchId is same with the "t" in the response of the Trade Streams.([https://www.tokocrypto.com/apidocs/#trade-streams](./Marketdata-websocket.md#trade-streams))

## Wallet Endpoints

### Withdraw (SIGNED)

```http
POST /open/v1/withdraws (HMAC SHA256)
```

Submit a withdraw request.

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| asset | STRING | YES | 50 |  |
| clientId | STRING | NO | 50 | Client's custom ID for withdraw order, Server does not check it's uniqueness. Automatically generated if not sent. |
| network | STRING | NO | 50 |  |
| address | STRING | YES | 128 |  |
| addressTag | STRING | NO | 64 | Secondary address identifier for coins like XRP,XMR etc. |
| amount | STRING | YES | 32 |  |
| recvWindow | LONG | NO | 5 |  |
| timestamp | LONG | YES | 20 |  |

**Response:**

```json
{
    "code": 0,
    "msg": "成功",
    "data": {
        "withdrawId":"12"
    },
    "timestamp": 1571745049095
}
```

### Withdraw History (SIGNED)

```http
GET /open/v1/withdraws (HMAC SHA256)
```

Fetch withdraw history.

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| asset | STRING | NO | 50 |  |
| status | INT | NO | 2 | 0(0:Email Sent,1:Cancelled 2:Awaiting Approval 3:Rejected 4:Processing 5:Failure 10:Completed) |
| fromId | LONG | NO | 20 | ID to fetch from. Default gets most recent records. |
| startTime | LONG | NO | 20 |  |
| endTime | LONG | NO | 20 |  |
| recvWindow | LONG | NO | 5 |  |
| timestamp | LONG | YES | 20 |  |

**Response:**

```json
{
    "code": 0,
    "msg": "成功",
    "data": {
        "list": [
            {
                "id": 1,
                "clientId": "1",
                "asset": "BTC",
                "network": "BTC",
                "address": "1G58aoKLVd1vHkv7wi6R2rKUrjuk4ZRtY3",
                "amount": "0.001",
                "fee": "0.0005",
                "txId": "",
                "status": 4,
                "createTime": 1572359825000,
            }
        ]
    },
    "timestamp": 1572402980747
}
```

### Deposit History (SIGNED)

```http
GET /open/v1/deposits (HMAC SHA256)
```

Fetch deposit history.

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| asset | STRING | NO | 50 |  |
| status | INT | NO | 2 | 0(0:pending, 1:success) |
| fromId | LONG | NO | 20 | ID to fetch from. Default gets most recent records. |
| startTime | LONG | NO | 20 |  |
| endTime | LONG | NO | 20 |  |
| recvWindow | LONG | NO | 5 |  |
| timestamp | LONG | YES | 20 |  |

**Response:**

```json
{
    "code": 0,
    "msg": "成功",
    "data": {
        "list": [
            {
                "id": 1,
                "asset": "BTC",
                "network": "BTC",
                "address": "2",
                "addressTag": "2",
                "txId": "1",
                "amount": "1.000000000000000000000000000000",
                "status": 1,
                "insertTime": "0"
            }
        ]
    },
    "timestamp": 1572317515063
}
```

### Deposit Address (SIGNED)

```http
GET  /open/v1/deposits/address (HMAC SHA256)
```

Fetch deposit address.

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| asset | STRING | YES | 50 |  |
| network | STRING | YES | 50 |  |
| recvWindow | LONG | NO | 5 |  |
| timestamp | LONG | YES | 20 |  |

**Response:**

```json
{
    "code": 0,
    "msg": "成功",
    "data": {
        "address": "0x6915f16f8791d0a1cc2bf47c13a6b2a92000504b",
        "addressTag": "1231212",
        "asset": "BNB"
    },
    "timestamp": 1571745049095
}
```
