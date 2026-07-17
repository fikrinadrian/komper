# Price Range Execution Rules

Frequently asked questions about Tokocrypto price-range execution rules.

## Table of Contents

- [FAQs - Price Range Execution Rules](#faqs-price-range-execution-rules)
  - [What are execution rules?](#what-are-execution-rules)
  - [What does the Price Range Execution Rule do?](#what-does-the-price-range-execution-rule-do)
  - [How can I query the execution price range allowed for a symbol?](#how-can-i-query-the-execution-price-range-allowed-for-a-symbol)
  - [How can I query the reference price?](#how-can-i-query-the-reference-price)
  - [How does the Price Range Execution Rule work?](#how-does-the-price-range-execution-rule-work)
  - [What happens if a symbol has no execution rule of type `PRICE_RANGE` and no reference price?](#what-happens-if-a-symbol-has-no-execution-rule-of-type-price_range-and-no-reference-price)
  - [What happens if a symbol has no execution rule of type `PRICE_RANGE` but does have a reference price?](#what-happens-if-a-symbol-has-no-execution-rule-of-type-price_range-but-does-have-a-reference-price)
  - [What happens if a symbol has an execution rule of type `PRICE_RANGE` but does not have a reference price?](#what-happens-if-a-symbol-has-an-execution-rule-of-type-price_range-but-does-not-have-a-reference-price)
  - [What happens if a symbol has an execution rule of type `PRICE_RANGE` that does not have all four multipliers?](#what-happens-if-a-symbol-has-an-execution-rule-of-type-price_range-that-does-not-have-all-four-multipliers)
  - [What happens if the symbol's reference price is `null`?](#what-happens-if-the-symbols-reference-price-is-null)
  - [When are the execution price limits for an order set?](#when-are-the-execution-price-limits-for-an-order-set)
  - [What happens if an order attempts to execute at a price outside of the allowed price range?](#what-happens-if-an-order-attempts-to-execute-at-a-price-outside-of-the-allowed-price-range)
  - [How is the reference price calculated?](#how-is-the-reference-price-calculated)
  - [How does the Matching Engine calculate the reference price?](#how-does-the-matching-engine-calculate-the-reference-price)
  - [How are reference prices calculated outside the matching engine?](#how-are-reference-prices-calculated-outside-the-matching-engine)
  - [External Reference Price Calculation Method 0](#external-reference-price-calculation-method-0)

## FAQs - Price Range Execution Rules

**Disclaimer:**

-   The symbols and values used here are fictional and do not imply anything about the actual configuration of the live exchange.

**Note:** The Price Range Execution Rule only applies to trading pairs with `symbolType=1`.

### What are execution rules?

Execution rules are trading rules that are enforced at the time of order execution. The only execution rule currently available is the Price Range rule.

### What does the Price Range Execution Rule do?

This rule ensures that trades may only be executed at prices within and equal to a price range around a reference price.

### How can I query the execution price range allowed for a symbol?

Refer to the following endpoints/methods:

| API | Request |
| --- | --- |
| REST API | `GET /api/v3/executionRules` |
| WebSocket API | `executionRules` |

### How can I query the reference price?

Refer to the following endpoints/methods:

| API | Request |
| --- | --- |
| REST API | `GET /api/v3/referencePrice` |
| WebSocket API | `referencePrice` |
| WebSocket Streams | `<symbol>@referencePrice` |

Note that the **reference price is continually changing**, so it is recommended to monitor the reference price via WebSocket Streams.

### How does the Price Range Execution Rule work?

As an example, given the hypothetical execution rule for this symbol:

```json
{
    "symbolRules": [
        {
            "symbol": "BAZUSD",
            "rules": [
                {
                    "ruleType": "PRICE_RANGE",
                    "bidLimitMultUp": "2.0000",
                    "bidLimitMultDown": "0.5000",
                    "askLimitMultUp": "2.0000",
                    "askLimitMultDown": "0.5000"
                }
            ]
        }
    ]
}
```

If the reference price for the symbol is:

```json
{
    "symbol": "BAZUSD",
    "referencePrice": "10.00",
    "timestamp": 1770736694138
}
```

This means that at time `1770736694138`:

1.  an order to `BUY` may not execute at a price more than twice the reference price or less than half the reference price and
2.  an order to `SELL` may not execute at a price more than twice the reference price or less than half the reference price.

### What happens if a symbol has no execution rule of type `PRICE_RANGE` and no reference price?

The Price Range Execution Rule is not enforced on the symbol.

### What happens if a symbol has no execution rule of type `PRICE_RANGE` but does have a reference price?

The Price Range Execution Rule is not enforced on the symbol.

### What happens if a symbol has an execution rule of type `PRICE_RANGE` but does not have a reference price?

The Price Range Execution Rule is not enforced on the symbol.

### What happens if a symbol has an execution rule of type `PRICE_RANGE` that does not have all four multipliers?

When a multiplier is not set, then Price Range Execution Rule is not enforced on the symbol for that order side and price direction. For example, if `bidLimitMultDown` was not present in the hypothetical execution rule above, then an order to `BUY` could execute at any price at or below twice the reference price.

### What happens if the symbol's reference price is `null`?

The Price Range Execution Rule is not enforced on the symbol.

### When are the execution price limits for an order set?

When an order enters its taker phase, the reference price is recalculated to set the execution price limits for the order's entire taker phase. Note that a single taker order may match with many maker orders during its taker phase.

### What happens if an order attempts to execute at a price outside of the allowed price range?

If a taker order attempts to execute at a price outside of the allowed price range, it will be expired (i.e. status: `EXPIRED`) with the expiry reason `EXECUTION_RULE_PRICE_RANGE_EXCEEDED`.

| Service | Reference |
| --- | --- |
| APIs | `expiryReason` |
| User Data Stream | `"eR"` |

### How is the reference price calculated?

If calculated by the Matching Engine, a query returns `"calculationType": "ARITHMETIC_MEAN"`.

If calculated outside the matching engine, a query returns `"calculationType": "EXTERNAL"`. See below for more details.

### How does the Matching Engine calculate the reference price?

The matching engine calculates the reference price as a simple moving average of trade prices over a time window. It is configured with a bucket width in milliseconds (`bucketWidthMs`) and number of buckets (`bucketCount`). The bucket width multiplied by the number of buckets defines the size of the time window.

When a trade occurs, the engine captures the trade price and adds it to the current bucket. Each bucket has:

-   an open time, which is aligned to engine time modulo the bucket width
-   a trade count, which is a fixed-point integer with four decimal places of precision
-   a sum of all the trade prices represented in that bucket, which is a fixed-point integer with an extra four decimal places of precision over the quote asset precision.

The engine calculates the average of a particular bucket by dividing sum by trade count. The first trade for a given open time creates a bucket, and the engine gradually accumulates buckets as trades happen. The engine drops a bucket when its close time is outside the time window. This means that:

-   The oldest bucket at any given time likely has an open time outside of the time window and a close time inside of the time window.
-   The maximum number of buckets tracked by the engine is actually 1 more than the configured `bucketCount`.

The remainder of the explanation refers to the oldest time in the window as the "cutoff time".

When the oldest bucket straddles the cutoff time, its contents are *prorated*:

-   The fraction of the bucket outside the moving window is: (cutoff time - bucket's open time) / bucket width. Call this the "expired fraction."
-   The bucket's trade count is reduced by the expired fraction.
-   The bucket's sum is reduced by the expired fraction.
-   The open time is set to the cutoff time.

The reference price is the total of the sum in each bucket divided by the total of the trade count in each bucket. Division is truncating integer division.

### How are reference prices calculated outside the matching engine?

If calculated outside the matching engine, a query returns `"externalCalculationId":` followed by an integer number. Each of these numbers indicates a different calculation method.

### External Reference Price Calculation Method 0

The reference price was set manually by a human operator. This calculation method will only be used in situations when algorithmic calculation of the reference price has been deemed unsuitable.
