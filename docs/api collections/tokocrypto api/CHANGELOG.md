# Tokocrypto API Change Log

Chronological changes recorded in the supplied Tokocrypto API documentation.

## Table of Contents

- [2026-06-05](#2026-06-05)
- [2026-04-10](#2026-04-10)
- [2026-03-30](#2026-03-30)
- [2025-12-30](#2025-12-30)
- [2024-08-15](#2024-08-15)
- [2024-07-10](#2024-07-10)
- [2024-05-10](#2024-05-10)
- [2024-04-22](#2024-04-22)
- [2024-03-04](#2024-03-04)
- [2023-11-13](#2023-11-13)
- [2023-09-06](#2023-09-06)
- [2023-08-16](#2023-08-16)

### 2026-06-05

Rest API changed.

**Updated Endpoint — New Order (SIGNED)**

```http
POST /open/v1/orders
```

-   Add `selfTradePreventionMode` (INT, optional) — `0` EXPIRE\_MAKER, `1` EXPIRE\_TAKER, `2` EXPIRE\_BOTH, `4` DECREMENT, `5` TRANSFER

**Updated Endpoint — Get all Supported Trading Symbol**

```http
GET /open/v1/common/symbols
```

-   Add `defaultSelfTradePreventionMode` to symbol response
-   Add `allowedSelfTradePreventionModes` to symbol response

**Updated Documentation — FAQs**

-   Add Self Trade Prevention (STP) FAQ section

### 2026-04-10

-   Add new endpoint **`GET /api/v3/executionRules`**

    -   Query execution rules (Price Range) for trading symbols
-   Add new FAQ section: **Price Range Execution Rules**

    -   Execution rule mechanics and worked examples
    -   Edge cases and order expiry behavior
    -   Reference price calculation methods

### 2026-03-30

-   Add deprecation notice to **`POST /open/v1/user-data-stream`**, **`PUT /open/v1/user-data-stream`**, **`DELETE /open/v1/user-data-stream`**

    -   Please switch to `POST /open/v1/user-listen-token`
    -   These endpoints are scheduled to be decommissioned on April 30, 2026
-   Add new endpoint **`POST /open/v1/user-listen-token`**

    -   Create a listen token for WebSocket API user data stream subscription
-   Add **WebSocket API** documentation for user data stream

    -   Subscribe with listenToken
    -   Unsubscribe
    -   Event: Stream Terminated

### 2025-12-30

-   Market Data endpoints params add **`Length`**

    -   Order book
    -   Recent trades list
    -   Compressed/Aggregate trades list
    -   Kline/Candlestick data
-   Wallet Endpoints params add **`Length`**

    -   Withdraw (SIGNED)
    -   Withdraw History (SIGNED)
    -   Deposit History (SIGNED)
    -   Deposit Address (SIGNED)
-   User Data Streams params add **`Length`**

    -   Ping/Keep-alive a listenKey
    -   Close a listenKey

### 2024-08-15

-   Support **`clientId`** to cancel the order with POST /open/v1/orders/cancel (HMAC SHA256)

### 2024-07-10

-   Update the new order response of POST /open/v1/orders
-   Add matchId to the response of GET /open/v1/orders/trades

### 2024-05-10

-   `/open/v1/orders` add new parameter `selfTradePreventionMode`.

    -   The parameter type is an `ENUM`.
    -   This parameter is NOT required.
    -   When selfTradePreventionMode is 3, self-dealing can be supported.
    -   `0 - EXPIRE_MAKER`; `1 - EXPIRE_TAKER`; `2- EXPIRE_BOTH`; `3 - NONE`

### 2024-04-22

-   New filter NOTIONAL has been added.

    -   Defines the allowed notional value (`price * quantity`) based on a configured `minNotional` and `maxNotional`

### 2024-03-04

-   `GET /open/v1/market/depth (when symbol type is not 1)`
    change to
    `GET https://cloudme-toko.2meta.app/api/v1/depth (when symbol type is 3)`

-   `GET /open/v1/market/agg-trades (when symbol type is not 1)`
    change to
    `GET https://cloudme-toko.2meta.app/api/v1/aggTrades (when symbol type is 3)`

-   `GET /open/v1/market/klines (when symbol type is not 1)`
    change to
    `GET https://cloudme-toko.2meta.app/api/v1/klines(when symbol type is 3)`

### 2023-11-13

Account endpoints\[**New order(SIGNED)**\] changed.

Add the **timeInForce** parameter to this api:

```http
POST /open/v1/orders  (HMAC SHA256)
```

When make a new order, user can request the parameter "timeInForce" with the value 1/2/3/4

| **timeInForce Value** | **Content** |
| --- | --- |
| 1 | GTC-Good Till Cancel |
| 2 | IOC-Immediate or Cancel |
| 3 | FOK-Fill or Kill |
| 4 | GTX-Good Till Crossing |

### 2023-09-06

User Data Streams changed.

**Create a listenKey:**

```http
POST /open/v1/user-data-stream (when symbolType is 1, MBX symbol)
```

```http
POST /open/v1/private-n/user-data-stream (when symbolType is 3, Nextme Symbol(New Symbol) )
```

**Ping/Keep-alive a listenKey:**

```http
PUT /open/v1/user-data-stream (when symbolType is 1, MBX symbol)
```

```http
PUT /open/v1/private-n/user-data-stream (when symbolType is 3, Nextme Symbol(New Symbol) )
```

**Close a listenKey:**

```http
DELETE /open/v1/user-data-stream (when symbolType is 1, MBX symbol)
```

```http
DELETE /open/v1/private-n/user-data-stream (when symbolType is 3, Nextme Symbol(New Symbol) )
```

### 2023-08-16

General WSS information changed.

Changes ws link:

-   **wss://www.tokocrypto.com**(when symbol type is 2)
-   **wss://stream-toko.2meta.app**(when symbol type is 3)
