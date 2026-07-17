# Public REST API

Public market-data endpoints and shared Tokocrypto REST API rules, limits, definitions, and filters.

## Table of Contents

- [API Document Description](#api-document-description)
  - [General API Information](#general-api-information)
    - [HTTP Return Codes](#http-return-codes)
    - [Response fields description](#response-fields-description)
    - [General Information on Endpoints](#general-information-on-endpoints)
  - [LIMITS](#limits)
    - [General Info on Limits](#general-info-on-limits)
    - [IP Limits](#ip-limits)
    - [Order Rate Limits](#order-rate-limits)
  - [Public API Definitions](#public-api-definitions)
    - [Terminology](#terminology)
    - [ENUM definitions](#enum-definitions)
  - [Filters](#filters)
    - [Symbol Filters](#symbol-filters)
      - [PRICE\_FILTER](#price_filter)
      - [PERCENT\_PRICE](#percent_price)
      - [LOT\_SIZE](#lot_size)
      - [NOTIONAL](#notional)
      - [ICEBERG\_PARTS](#iceberg_parts)
      - [MARKET\_LOT\_SIZE](#market_lot_size)
      - [MAX\_NUM\_ORDERS](#max_num_orders)
      - [MAX\_NUM\_ALGO\_ORDERS](#max_num_algo_orders)
      - [MAX\_NUM\_ICEBERG\_ORDERS](#max_num_iceberg_orders)
    - [Exchange Filters](#exchange-filters)
      - [EXCHANGE\_MAX\_NUM\_ORDERS](#exchange_max_num_orders)
      - [EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS](#exchange_max_num_algo_orders)
- [General endpoints](#general-endpoints)
  - [Check server time](#check-server-time)
  - [Get all Supported Trading Symbol](#get-all-supported-trading-symbol)
  - [Query Execution Rules](#query-execution-rules)
- [Market Data endpoints](#market-data-endpoints)
  - [Order book](#order-book)
  - [Recent trades list](#recent-trades-list)
  - [Compressed/Aggregate trades list](#compressedaggregate-trades-list)
  - [Kline/Candlestick data](#klinecandlestick-data)

## API Document Description

CCXT is our authorized SDK provider and you may access the Tokocrypto API through CCXT. For more information, please visit: **[https://ccxt.trade](https://ccxt.trade/)**

### General API Information

-   Some endpoints will require an API Key.
-   The base endpoint is: **[https://www.tokocrypto.com](https://www.tokocrypto.com/)**
-   Some specified APIs base endpoint are: **[https://www.tokocrypto.site](https://www.tokocrypto.site/)**
-   All endpoints return a JSON object.
-   Data is returned in **ascending** order. Oldest first, newest last.
-   All time and timestamp related fields are in **milliseconds**.

#### HTTP Return Codes

-   HTTP `4XX` return codes are used for malformed requests; the issue is on the sender's side.

-   HTTP `403` return code is used when the WAF Limit (Web Application Firewall) has been violated.

-   HTTP `429` return code is used when breaking a request rate limit.

-   HTTP `418` return code is used when an IP has been auto-banned for continuing to send requests after receiving `429` codes.

-   HTTP `5XX` return codes are used for internal errors; the issue is on Server's side. It is important to **NOT** treat this as a failure operation; the execution status is **UNKNOWN** and could have been a success.

#### Response fields description

| Name | Type | Mandatory | Description |
| :-: | :-: | :-- | :-- |
| code | Number | Yes | Error Code，0 is success，else is fail |
| msg | String | Yes | error message |
| timestamp | Number | Yes | server timestamp |
| data | Object | No | response data |

#### General Information on Endpoints

-   For `GET` endpoints, parameters must be sent as a `query string`.
-   For `POST` endpoints, the parameters may be sent as a `query string` or in the `request body` with content type `application/x-www-form-urlencoded`. You may mix parameters between both the `query string` and `request body` if you wish to do so.
-   Parameters may be sent in any order.
-   If a parameter sent in both the `query string` and `request body`, the `body string` parameter will be used.

### LIMITS

#### General Info on Limits

-   The following `intervalLetter` values for headers:

    -   SECOND => S
    -   MINUTE => M
    -   HOUR => H
    -   DAY => D
-   `intervalNum` describes the amount of the interval. For example, `intervalNum` 5 with `intervalLetter` M means "Every 5 minutes".
-   A 429 will be returned when either rate limit is violated.

#### IP Limits

-   Every request will contain `X-MBX-USED-WEIGHT-(intervalNum)(intervalLetter)` in the response headers which has the current used weight for the IP for all request rate limiters defined.
-   Each route has a `weight` which determines for the number of requests each endpoint counts for. Heavier endpoints and endpoints that do operations on multiple symbols will have a heavier `weight`.
-   When a 429 is received, it's your obligation as an API to back off and not spam the API.
-   **Repeatedly violating rate limits and/or failing to back off after receiving 429s will result in an automated IP ban (HTTP status 418).**
-   IP bans are tracked and **scale in duration** for repeat offenders, **from 2 minutes to 3 days**.
-   A `Retry-After` header is sent with a 418 or 429 responses and will give the **number of seconds** required to wait, in the case of a 418, to prevent a ban, or, in the case of a 429, until the ban is over.
-   **The limits on the API are based on the IPs, not the API keys.**

 We recommend using the websocket for getting data as much as possible, as this will not count to the request rate limit.

#### Order Rate Limits

-   Every successful order response will contain a `X-MBX-ORDER-COUNT-(intervalNum)(intervalLetter)` header which has the current order count for the account for all order rate limiters defined.
-   Rejected/unsuccessful orders are not guaranteed to have `X-MBX-ORDER-COUNT-**` headers in the response.
-   **The order rate limit is counted against each account**.

### Public API Definitions

#### Terminology

-   `base asset` refers to the asset that is the `quantity` of a symbol.
-   `quote asset` refers to the asset that is the `price` of a symbol.

#### ENUM definitions

**Symbol type:**

-   1 MAIN
-   2 NEXT

**Order status (status):**

-   \-2 SYSTEM\_PROCESSING
-   0 NEW
-   1 PARTIALLY\_FILLED
-   2 FILLED
-   3 CANCELED
-   4 PENDING\_CANCEL (currently unused)
-   5 REJECTED
-   6 EXPIRED

**Order types (orderTypes, type):**

-   1 LIMIT
-   2 MARKET
-   3 STOP\_LOSS
-   4 STOP\_LOSS\_LIMIT
-   5 TAKE\_PROFIT
-   6 TAKE\_PROFIT\_LIMIT
-   7 LIMIT\_MAKER

**Order side (side):**

-   0 BUY
-   1 SELL

**Kline/Candlestick chart intervals:**

m -> minutes; h -> hours; d -> days; w -> weeks; M -> months

-   1m
-   3m
-   5m
-   15m
-   30m
-   1h
-   2h
-   4h
-   6h
-   8h
-   12h
-   1d
-   3d
-   1w
-   1M

### Filters

Filters define trading rules on a symbol or an exchange. Filters come in two forms: `symbol filters` and `exchange filters`.

#### Symbol Filters

##### PRICE\_FILTER

The `PRICE_FILTER` defines the `price` rules for a symbol. There are 3 parts:

-   `minPrice` defines the minimum `price`/`stopPrice` allowed; disabled on `minPrice` == 0.
-   `maxPrice` defines the maximum `price`/`stopPrice` allowed; disabled on `maxPrice` == 0.
-   `tickSize` defines the intervals that a `price`/`stopPrice` can be increased/decreased by; disabled on `tickSize` == 0.

Any of the above variables can be set to 0, which disables that rule in the `price filter`. In order to pass the `price filter`, the following must be true for `price`/`stopPrice` of the enabled rules:

-   `price` >= `minPrice`
-   `price` <= `maxPrice`
-   (`price`\-`minPrice`) % `tickSize` == 0

**/exchangeInfo format:**

```json
{
  "filterType": "PRICE_FILTER",
  "minPrice": "0.00000100",
  "maxPrice": "100000.00000000",
  "tickSize": "0.00000100"
}
```

##### PERCENT\_PRICE

The `PERCENT_PRICE` filter defines valid range for a price based on the average of the previous trades. `avgPriceMins` is the number of minutes the average price is calculated over. 0 means the last price is used.

In order to pass the `percent price`, the following must be true for `price`:

-   `price` <= `weightedAveragePrice` \* `multiplierUp`
-   `price` >= `weightedAveragePrice` \* `multiplierDown`

**/exchangeInfo format:**

```json
{
  "filterType": "PERCENT_PRICE",
  "multiplierUp": "1.3000",
  "multiplierDown": "0.7000",
  "avgPriceMins": 5
}
```

##### LOT\_SIZE

The `LOT_SIZE` filter defines the `quantity` (aka "lots" in auction terms) rules for a symbol. There are 3 parts:

-   `minQty` defines the minimum `quantity`/`icebergQty` allowed.
-   `maxQty` defines the maximum `quantity`/`icebergQty` allowed.
-   `stepSize` defines the intervals that a `quantity`/`icebergQty` can be increased/decreased by.

In order to pass the `lot size`, the following must be true for `quantity`/`icebergQty`:

-   `quantity` >= `minQty`
-   `quantity` <= `maxQty`
-   (`quantity`\-`minQty`) % `stepSize` == 0

**/exchangeInfo format:**

```json
{
  "filterType": "LOT_SIZE",
  "minQty": "0.00100000",
  "maxQty": "100000.00000000",
  "stepSize": "0.00100000"
}
```

##### NOTIONAL

The `NOTIONAL` filter defines the minimum/maximum notional value allowed for an order on a symbol. An order's notional value is the `price` \* `quantity`. `applyToMarket` determines whether or not the `NOTIONAL` filter will also be applied to `MARKET` orders. Since `MARKET` orders have no price, the average price is used over the last `avgPriceMins` minutes. `avgPriceMins` is the number of minutes the average price is calculated over. 0 means the last price is used.

**/exchangeInfo format:**

```json
{
  "filterType": "NOTIONAL",
  "minNotional": "0.00100000",
  "maxNotional": "10000.00000000",
  "applyToMarket": true,
  "avgPriceMins": 5
}
```

##### ICEBERG\_PARTS

The `ICEBERG_PARTS` filter defines the maximum parts an iceberg order can have. The number of `ICEBERG_PARTS` is defined as `CEIL(qty / icebergQty)`.

**/exchangeInfo format:**

```json
{
  "filterType": "ICEBERG_PARTS",
  "limit": 10
}
```

##### MARKET\_LOT\_SIZE

The `MARKET_LOT_SIZE` filter defines the `quantity` (aka "lots" in auction terms) rules for `MARKET` orders on a symbol. There are 3 parts:

-   `minQty` defines the minimum `quantity` allowed.
-   `maxQty` defines the maximum `quantity` allowed.
-   `stepSize` defines the intervals that a `quantity` can be increased/decreased by.

In order to pass the `market lot size`, the following must be true for `quantity`:

-   `quantity` >= `minQty`
-   `quantity` <= `maxQty`
-   (`quantity`\-`minQty`) % `stepSize` == 0

**/exchangeInfo format:**

```json
{
  "filterType": "MARKET_LOT_SIZE",
  "minQty": "0.00100000",
  "maxQty": "100000.00000000",
  "stepSize": "0.00100000"
}
```

##### MAX\_NUM\_ORDERS

The `MAX_NUM_ORDERS` filter defines the maximum number of orders an account is allowed to have open on a symbol. Note that both "algo" orders and normal orders are counted for this filter.

**/exchangeInfo format:**

```json
{
  "filterType": "MAX_NUM_ORDERS",
  "limit": 25
}
```

##### MAX\_NUM\_ALGO\_ORDERS

The `MAX_NUM_ALGO_ORDERS` filter defines the maximum number of "algo" orders an account is allowed to have open on a symbol. "Algo" orders are `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, and `TAKE_PROFIT_LIMIT` orders.

**/exchangeInfo format:**

```json
{
  "filterType": "MAX_NUM_ALGO_ORDERS",
  "maxNumAlgoOrders": 5
}
```

##### MAX\_NUM\_ICEBERG\_ORDERS

The `MAX_NUM_ICEBERG_ORDERS` filter defines the maximum number of `ICEBERG` orders an account is allowed to have open on a symbol. An `ICEBERG` order is any order where the `icebergQty` is > 0.

**/exchangeInfo format:**

```json
{
  "filterType": "MAX_NUM_ICEBERG_ORDERS",
  "maxNumIcebergOrders": 5
}
```

#### Exchange Filters

##### EXCHANGE\_MAX\_NUM\_ORDERS

The `MAX_NUM_ORDERS` filter defines the maximum number of orders an account is allowed to have open on the exchange. Note that both "algo" orders and normal orders are counted for this filter.

**/exchangeInfo format:**

```json
{
  "filterType": "EXCHANGE_MAX_NUM_ORDERS",
  "maxNumOrders": 1000
}
```

##### EXCHANGE\_MAX\_NUM\_ALGO\_ORDERS

The `MAX_ALGO_ORDERS` filter defines the maximum number of "algo" orders an account is allowed to have open on the exchange. "Algo" orders are `STOP_LOSS`, `STOP_LOSS_LIMIT`, `TAKE_PROFIT`, and `TAKE_PROFIT_LIMIT` orders.

**/exchangeInfo format:**

```json
{
  "filterType": "EXCHANGE_MAX_ALGO_ORDERS",
  "maxNumAlgoOrders": 200
}
```

## General endpoints

### Check server time

```http
GET /open/v1/common/time
```

Test connectivity to the Rest API and get the current server time.

**Parameters:** NONE

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "timestamp": 1572265137927
}
```

### Get all Supported Trading Symbol

```http
GET /open/v1/common/symbols
```

This endpoint returns all Exchange's supported trading symbol.

**Parameters:** NONE

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "list": [
            {
                "type": 1, // 1 - Main, 2 - Next.
                "symbol": "ADA_BNB",
                "baseAsset": "ADA",
                "basePrecision": 8,
                "quoteAsset": "BNB",
                "quotePrecision": 8,
                "filters": [
                    {
                        "applyToMarket": false,
                        "filterType": "PRICE_FILTER",
                        "maxPrice": "1000.00000000",
                        "minPrice": "0.00000100",
                        "tickSize": "0.00000100"
                    },
                    {
                        "applyToMarket": false,
                        "avgPriceMins": "5",
                        "filterType": "PERCENT_PRICE",
                        "multiplierDown": 0.2,
                        "multiplierUp": 5
                    },
                    {
                        "applyToMarket": false,
                        "filterType": "LOT_SIZE",
                        "maxQty": "9000000.00000000",
                        "minQty": "1.00000000",
                        "stepSize": "1.00000000"
                    },
                    {
                        "applyToMarket": true,
                        "avgPriceMins": "5",
                        "filterType": "NOTIONAL",
                        "minNotional": "0.10000000"
                    },
                    {
                        "applyToMarket": false,
                        "filterType": "ICEBERG_PARTS",
                        "limit": "10"
                    },
                    {
                        "applyToMarket": false,
                        "filterType": "MARKET_LOT_SIZE",
                        "maxQty": "4526300.00000000",
                        "minQty": "0.00000000",
                        "stepSize": "0.00000000"
                    },
                    {
                        "applyToMarket": false,
                        "filterType": "MAX_NUM_ALGO_ORDERS",
                        "maxNumAlgoOrders": "5"
                    }
                ],
                "orderTypes": [
                    "LIMIT",
                    "LIMIT_MAKER",
                    "MARKET",
                    "STOP_LOSS_LIMIT",
                    "TAKE_PROFIT_LIMIT"
                ],
                "defaultSelfTradePreventionMode": "EXPIRE_MAKER",
                "allowedSelfTradePreventionModes": [
                    "EXPIRE_TAKER",
                    "EXPIRE_MAKER",
                    "EXPIRE_BOTH",
                    "DECREMENT",
                    "TRANSFER"
                ],
                "icebergEnable": 1,
                "ocoEnable": 1,
                "spotTradingEnable": 1,
                "marginTradingEnable": 0
            }
          ]
    },
    "timestamp": 1571921637091
}
```

### Query Execution Rules

```http
GET /api/v3/executionRules
```

Query execution rules for trading symbols. The base endpoint is: **[https://www.tokocrypto.site](https://www.tokocrypto.site/)**

**Weight:**

| Parameter Used | Weight |
| --- | --- |
| `symbol` | 2 |
| `symbols` | 2 for each requested symbol, capped at max weight of 40 |
| `symbolStatus` | 40 |
| None | 40 |

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| symbol | STRING | NO | \- | Query for a single symbol |
| symbols | STRING | NO | \- | Query for multiple symbols |
| symbolStatus | ENUM | NO | \- | Filter by symbol status. Supported values: `TRADING`, `HALT`, `BREAK` |

**Notes:**

-   Only one of `symbol`, `symbols`, or `symbolStatus` can be sent per request. They are mutually exclusive.
-   If no parameter is sent, execution rules for all symbols are returned.

**Data Source:** Memory

**Response:**

**Response fields:**

| Field | Type | Description |
| --- | --- | --- |
| symbolRules | ARRAY | Array of rule objects for each symbol |
| symbol | STRING | Trading pair symbol |
| rules | ARRAY | Array of execution rule objects for this symbol |
| ruleType | STRING | Type of execution rule (e.g., `PRICE_RANGE`) |
| bidLimitMultUp | STRING | Upper multiplier limit for BUY order prices |
| bidLimitMultDown | STRING | Lower multiplier limit for BUY order prices |
| askLimitMultUp | STRING | Upper multiplier limit for SELL order prices |
| askLimitMultDown | STRING | Lower multiplier limit for SELL order prices |

```json
{
    "symbolRules": [
        {
            "symbol": "BAZUSD",
            "rules": [
                {
                    "ruleType": "PRICE_RANGE",
                    "bidLimitMultUp": "1.0001",
                    "bidLimitMultDown": "0.9999",
                    "askLimitMultUp": "1.0001",
                    "askLimitMultDown": "0.9999"
                }
            ]
        }
    ]
}
```

## Market Data endpoints

### Order book

```
GET https://www.tokocrypto.site/api/v3/depth (when symbol type is 1)
GET https://cloudme-toko.2meta.app/api/v1/depth (when symbol type is 3)
```

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| symbol | STRING | YES | 50 | when symbol type is 1, replace \_ of symbol with null string |
| limit | INT | NO | 4 | Default 100; max 5000. Valid limits:\[5, 10, 20, 50, 100, 500\] |

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": {
      "lastUpdateId": 1027024,
      "bids": [
            [
              "4.00000000",     // 价位
              "431.00000000",   // 挂单量
            ]
          ],
          "asks": [
            [
              "4.00000200",
              "12.00000000",
            ]
          ]
    },
    "timestamp": 1571921637091
}
```

### Recent trades list

```http
GET https://www.tokocrypto.site/api/v3/trades (when symbol type is 1)
GET /open/v1/market/trades (when symbol type is not 1)
```

Get recent trades (up to last 500).

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| symbol | STRING | YES | 50 | when symbol type is 1, replace \_ of symbol with null string |
| fromId | LONG | NO | 20 | ID to get trades from INCLUSIVE. |
| limit | INT | NO | 4 | Default 500; max 1000. |

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": [
        {
          "id": 28457,
          "price": "4.00000100",
          "qty": "12.00000000",
          "time": 1499865549590,
          "isBuyerMaker": true,
          "isBestMatch": true
        }
    ],
    "timestamp": 1571921637091
}
```

### Compressed/Aggregate trades list

```
GET https://www.tokocrypto.site/api/v3/aggTrades (when symbol type is 1)
GET https://cloudme-toko.2meta.app/api/v1/aggTrades (when symbol type is 3)
```

Get compressed, aggregate trades. Trades that fill at the time, from the same order, with the same price will have the quantity aggregated.

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| symbol | STRING | YES | 50 | when symbol type is 1, replace \_ of symbol with null string |
| fromId | LONG | NO | 20 | ID to get aggregate trades from INCLUSIVE. |
| startTime | LONG | NO | 20 | Timestamp in ms to get aggregate trades from INCLUSIVE. |
| endTime | LONG | NO | 20 | Timestamp in ms to get aggregate trades until INCLUSIVE. |
| limit | INT | NO | 4 | Default 500; max 1000. |

-   If fromId, startTime, and endTime are not sent, the most recent aggregate trades will be returned.

**Response:**

```json
{
    "code": 0,
    "msg": "success",
    "data": [
        {
            "a": 26129,         // Aggregate tradeId
            "p": "0.01633102",  // Price
            "q": "4.70443515",  // Quantity
            "f": 27781,         // First tradeId
            "l": 27781,         // Last tradeId
            "T": 1498793709153, // Timestamp
            "m": true,          // Was the buyer the maker?
            "M": true           // Was the trade the best price match?
        }
    ],
    "timestamp": 1571921637091
}
```

### Kline/Candlestick data

```
GET https://www.tokocrypto.site/api/v3/klines (when symbol type is 1)
GET https://cloudme-toko.2meta.app/api/v1/klines(when symbol type is 3)
```

Kline/candlestick bars for a symbol. Klines are uniquely identified by their open time.

**Parameters:**

| Name | Type | Mandatory | Length | Description |
| --- | --- | --- | --- | --- |
| symbol | STRING | YES | 50 | when symbol type is 1, replace \_ of symbol with null string |
| interval | ENUM | YES | 4 |  |
| startTime | LONG | NO | 20 |  |
| endTime | LONG | NO | 20 |  |
| limit | INT | NO | 4 | Default 500; max 1000. |

-   If startTime and endTime are not sent, the most recent klines are returned.

**Response:**

```json
 {
    "code": 0,
    "msg": "success",
    "data": [
        [
          1499040000000,      // Open time
          "0.01634790",       // Open
          "0.80000000",       // High
          "0.01575800",       // Low
          "0.01577100",       // Close
          "148976.11427815",  // Volume
          1499644799999,      // Close time
          "2434.19055334",    // Quote asset volume
          308,                // Number of trades
          "1756.87402397",    // Taker buy base asset volume
          "28.46694368",      // Taker buy quote asset volume
          "17928899.62484339" // Ignore.
        ]
    ],
    "timestamp": 1571921637091
}
```
