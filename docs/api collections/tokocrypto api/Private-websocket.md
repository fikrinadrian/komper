# User Data WebSocket Documentation

Listen-key and listen-token lifecycle, WebSocket API commands, and private account and order payloads.

## Table of Contents

- [General WSS information](#general-wss-information)
  - [Create a listenKey](#create-a-listenkey)
  - [Ping/Keep-alive a listenKey](#pingkeep-alive-a-listenkey)
  - [Close a listenKey](#close-a-listenkey)
  - [Create a listenToken (Signed)](#create-a-listentoken-signed)
- [WebSocket API](#websocket-api)
  - [General Information](#general-information)
  - [Subscribe with listenToken](#subscribe-with-listentoken)
  - [Unsubscribe](#unsubscribe)
  - [Event: Stream Terminated](#event-stream-terminated)
- [Web Socket Payloads](#web-socket-payloads)
  - [Account Update](#account-update)
  - [Order Update](#order-update)

## General WSS information

-   The base API endpoint is: **[https://www.tokocrypto.com](https://www.tokocrypto.com/)**
-   A User Data Stream `listenKey` is valid for 60 minutes after creation.
-   Doing a `PUT` on a `listenKey` will extend its validity for 60 minutes.
-   Doing a `DELETE` on a `listenKey` will close the stream.
-   The base websocket endpoint is: **stream-cloud.tokocrypto.site/stream** (when symbol type is 1)
-   User Data Streams are accessed at **/ws/\\<listenKey>**
-   A single connection to **stream-cloud.tokocrypto.site/stream** is only valid for 24 hours; expect to be disconnected at the 24 hour mark
-   User data stream payloads are **not guaranteed** to be in order during heavy periods; **make sure to order your updates using E**
-   User Data Streams does not support symbols with symbol type 2 now

### Create a listenKey

```http
POST /open/v1/user-data-stream (when symbolType is 1, MBX symbol)
```

```http
POST /open/v1/private-n/user-data-stream (when symbolType is 3, Nextme Symbol(New Symbol) )
```

**Notice:** For symbolType 1 (MBX symbol), this interface will be deprecated soon. Please switch to `POST /open/v1/user-listen-token`. For symbolType 3, no change is required.

Start a new user data stream. The stream will close after 60 minutes unless a keepalive is sent.

**Weight:** 1

**Parameters:** NONE

**Response:**

```json
{
  "code": 0,
  "data": "pqia91ma19a5s61cv6a81va65sdf19v8a65a1a5s61cv6a81va65sdf19v8a65a1"
}
```

### Ping/Keep-alive a listenKey

```http
PUT /open/v1/user-data-stream (when symbolType is 1, MBX symbol)
```

```http
PUT /open/v1/private-n/user-data-stream (when symbolType is 3, Nextme Symbol(New Symbol) )
```

**Notice:** For symbolType 1 (MBX symbol), this interface will be deprecated soon. Please switch to `POST /open/v1/user-listen-token`. For symbolType 3, no change is required.

Keepalive a user data stream to prevent a time out. User data streams will close after 60 minutes. It's recommended to send a ping about every 30 minutes.

**Weight:** 1

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| listenKey | STRING | YES | 64 |  |

**Response:**

```
{}
```

### Close a listenKey

```http
DELETE /open/v1/user-data-stream (when symbolType is 1, MBX symbol)
```

```http
DELETE /open/v1/private-n/user-data-stream (when symbolType is 3, Nextme Symbol(New Symbol) )
```

**Notice:** For symbolType 1 (MBX symbol), this interface will be deprecated soon. Please switch to `POST /open/v1/user-listen-token`. For symbolType 3, no change is required.

Close out a user data stream.

**Weight:** 1

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| listenKey | STRING | YES | 64 |  |

**Response:**

```
{}
```

### Create a listenToken (Signed)

```http
POST /open/v1/user-listen-token
```

Create a new listen token for user data stream subscription via WebSocket API.

**Weight:** 1

**Parameters:**

| Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| validity | Integer | NO | The number of milliseconds the token should be valid. Defaults to 1 day. If the validity provided is greater than the max, an error will be thrown. |
| recvWindow | Long | NO | The value cannot be greater than 60000 |
| timestamp | Long | YES |  |

**Response:**

**Notes:**

-   The token validity is determined by the validity parameter; default is 24 hours, maximum 24 hours. expirationTime = current time + validity.
-   The response returns the token and expirationTime.

```json
{
  "code": 0,
  "data": {
    "token": "6xXxePXwZRjVSHKhzUCCGnmN3fkvMTXru+pYJS8RwijXk9Vcyr3rkwfVOTcP2OkONqciYA",
    "expirationTime": 1758792204196  // Token expiration timestamp in milliseconds
  }
}
```

## WebSocket API

### General Information

-   The WebSocket API base endpoint is: **wss://ws-api.tokocrypto.site:443/ws-api/v3**
-   The endpoint can also be obtained from `/v1/common/system-config` (field: `binanceWssApiBaseUrl` or `binanceWssApiBaseUrlList`)
-   Use the `listenToken` obtained from `POST /open/v1/user-listen-token` to subscribe to user data streams
-   `listenToken` subscription does not require an authenticated session
-   Tokens will NOT auto-renew; you must obtain a new token and re-subscribe before expiration
-   Renewal flow: `POST /open/v1/user-listen-token` for new token → `subscribe.listenToken` with new token
-   Maximum 1,000 active subscriptions per WebSocket session
-   websocket-api only for symbolType is 1, MBX symbol

### Subscribe with listenToken

Subscribe to user data stream using a `listenToken`.

**Method:** `userDataStream.subscribe.listenToken`

**Weight:** 2

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| listenToken | STRING | YES |  | The listen token obtained from POST /open/v1/user-listen-token |

**Request:**

**Response:**

**Notes:**

-   Non-authenticated sessions are allowed to use this feature.
-   The subscription is not automatically renewed by the WebSocket API.
-   To extend the validity of your subscription, you must call `POST /open/v1/user-listen-token` before the expiration of your current subscription, obtain a new listenToken with an updated expirationTime, and call `userDataStream.subscribe.listenToken` again passing the new listenToken. This will seamlessly extend your subscription to the new expirationDate.
-   If the subscription is not extended, it will expire and you will receive a `eventStreamTerminated` event (see example below).

```json
{
  "id": "f3a8f7a29f2e54df796db582f3d",
  "method": "userDataStream.subscribe.listenToken",
  "params": {
    "listenToken": "6xXxePXwZRjVSHKhzUCCGnmN3fkvMTXru+pYJS8RwijXk9Vcyr3rkwfVOTcP2OkONqciYA"
  }
}
```

```json
{
  "subscriptionId": 1,
  "expirationTime": 1749094553955907  // Subscription expiration timestamp
}
```

### Unsubscribe

Unsubscribe from user data stream.

**Method:** `userDataStream.unsubscribe`

**Weight:** 2

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| subscriptionId | INT | NO |  | If omitted, all subscriptions will be closed |

**Request:**

**Response:**

```json
{
  "id": "d3df8a21-98ea-4fe0-8f4e-0fcea5d418b7",
  "method": "userDataStream.unsubscribe"
}
```

```json
{
  "result": null,
  "id": "d3df8a21-98ea-4fe0-8f4e-0fcea5d418b7"
}
```

### Event: Stream Terminated

When a subscription expires without renewal, the server will push an `eventStreamTerminated` event.

**Payload:**

```json
{
  "subscriptionId": 0,
  "event": {
    "e": "eventStreamTerminated",   // Event type
    "E": 1759089357377              // Event time (milliseconds)
  }
}
```

## Web Socket Payloads

### Account Update

Account state is updated with the `outboundAccountPosition` event.

**Payload:**

```json
{
  "e": "outboundAccountPosition",   // Event type
  "E": 1499405658849,           // Event time
  "m": 0,                       // Maker commission rate (bips)
  "t": 0,                       // Taker commission rate (bips)
  "b": 0,                       // Buyer commission rate (bips)
  "s": 0,                       // Seller commission rate (bips)
  "T": true,                    // Can trade?
  "W": true,                    // Can withdraw?
  "D": true,                    // Can deposit?
  "u": 1499405658848,           // Time of last account update
  "B": [                        // Balances array
    {
      "a": "LTC",               // Asset
      "f": "17366.18538083",    // Free amount
      "l": "0.00000000"         // Locked amount
    },
    {
      "a": "BTC",
      "f": "10537.85314051",
      "l": "2.19464093"
    },
    {
      "a": "ETH",
      "f": "17902.35190619",
      "l": "0.00000000"
    },
    {
      "a": "BNC",
      "f": "1114503.29769312",
      "l": "0.00000000"
    },
    {
      "a": "NEO",
      "f": "0.00000000",
      "l": "0.00000000"
    }
  ]
}
```

### Order Update

Orders are updated with the `executionReport` event. Check the API documentation and below for relevant enum definitions. Average price can be found by doing `Z` divided by `z`.

**Payload:**

**Execution types:**

-   NEW
-   CANCELED
-   REPLACED (currently unused)
-   REJECTED
-   TRADE
-   EXPIRED

```json
{
  "e": "executionReport",        // Event type
  "E": 1499405658658,            // Event time
  "s": "ETHBTC",                 // Symbol
  "c": "mUvoqJxFIILMdfAW5iGSOW", // order ID
  "S": "BUY",                    // Side
  "o": "LIMIT",                  // Order type
  "f": "GTC",                    // Time in force
  "q": "1.00000000",             // Order quantity
  "p": "0.10264410",             // Order price
  "P": "0.00000000",             // Stop price
  "F": "0.00000000",             // Iceberg quantity
  "g": -1,                       // Ignore
  "C": "null",                   // Original client order ID; This is the ID of the order being canceled
  "x": "NEW",                    // Current execution type
  "X": "NEW",                    // Current order status
  "r": "NONE",                   // Order reject reason; will be an error code.
  "i": 4293153,                  // Match Engine Order ID
  "l": "0.00000000",             // Last executed quantity
  "z": "0.00000000",             // Cumulative filled quantity
  "L": "0.00000000",             // Last executed price
  "n": "0",                      // Commission amount
  "N": null,                     // Commission asset
  "T": 1499405658657,            // Transaction time
  "t": -1,                       // Trade ID
  "I": 8641984,                  // Ignore
  "w": true,                     // Is the order working? Stops will have
  "m": false,                    // Is this trade the maker side?
  "M": false,                    // Ignore
  "O": 1499405658657,            // Order creation time
  "Z": "0.00000000",             // Cumulative quote asset transacted quantity
  "Y": "0.00000000"              // Last quote asset transacted quantity (i.e. lastPrice * lastQty)
}
```
