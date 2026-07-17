---
title: API Overview
description: Introduction to the Reku Trading API endpoints
---

# API Overview

The Reku Trading API provides programmatic access to Indonesia's leading cryptocurrency marketplace. All endpoints are REST-based and return JSON responses.

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.reku.id` |

## API Categories

User profile and authentication status endpoints

Public market data, prices, and order book information

Real-time streaming for market data, order books, and trades

Order placement and management endpoints

Balance and wallet operation endpoints

Transaction and balance history endpoints

## Authentication

Most endpoints require authentication via API key. Pass your API key in the `API-Key` header:

```bash
curl -H "API-Key: your_api_key" https://api.reku.id/v3/profile
```

Public endpoints like market data and coin listings do not require authentication.

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "errno": 0,
  "error": "success",
  "data": { ... }
}
```

### Error Response

```json
{
  "errno": 1001,
  "error": "Unauthorized - Invalid or missing API key"
}
```

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Public endpoints | 120 requests/minute |
| Trading endpoints | 30 requests/minute |
| History endpoints | 10 requests/minute |

Rate limits are applied per API key to ensure fair usage.
