# Self Trade Prevention (STP)

Frequently asked questions about Tokocrypto Self Trade Prevention behavior and modes.

## Table of Contents

- [FAQs - Self Trade Prevention (STP)](#faqs-self-trade-prevention-stp)
  - [What is Self Trade Prevention?](#what-is-self-trade-prevention)
  - [What defines a self-trade?](#what-defines-a-self-trade)
  - [What happens when STP is triggered?](#what-happens-when-stp-is-triggered)

## FAQs - Self Trade Prevention (STP)

**Disclaimer:** The commissions and prices used here are fictional and do not imply anything about the actual setup on the live exchange.

### What is Self Trade Prevention?

Self Trade Prevention (or STP) prevents orders of users to match against their own.

### What defines a self-trade?

A self-trade can occur in either scenario:

-   The order traded against the same account.

### What happens when STP is triggered?

There are several possible modes for what the system does when an order would create a self-trade.

`EXPIRE_TAKER` - This mode prevents a trade by immediately expiring the taker order's remaining quantity.

`EXPIRE_MAKER` - This mode prevents a trade by immediately expiring the potential maker order's remaining quantity.

`EXPIRE_BOTH` - This mode prevents a trade by immediately expiring both the taker and the potential maker orders' remaining quantities.

`DECREMENT` - This mode increases the `prevented quantity` of *both* orders by the amount of the prevented match. The smaller of the two orders will expire, or both if they have the same quantity.

`TRANSFER` - If orders are from the same account, then the behavior is the same as `DECREMENT`. If orders are from different accounts with the same `tradeGroupId`, then in addition to the behavior of `DECREMENT`, the `last prevented quantity` and its notional are transferred between the two accounts.

STP behavior is typically determined by the STP mode of the **taker order** only. The exception is that for STP `TRANSFER` to occur, both the maker and taker orders must specify STP mode `TRANSFER`. If the taker order specifies STP mode `TRANSFER`, but the maker order specifies a different STP mode, then the STP behavior is `DECREMENT`.

In summary:

| Taker Order STP Mode | Maker Order STP Mode | Effective STP Mode |
| --- | --- | --- |
| `TRANSFER` | `TRANSFER` | `TRANSFER` |
| `TRANSFER` | `EXPIRE_MAKER`, `EXPIRE_TAKER`, `EXPIRE_BOTH`, `DECREMENT` | `DECREMENT` |
| `EXPIRE_MAKER`, `EXPIRE_TAKER`, `EXPIRE_BOTH`, `DECREMENT` | ANY STP MODE | STP mode of the Taker Order |
