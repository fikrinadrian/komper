# Test strategy: <initiative or system>

## Status and ownership

- Status: Draft
- QA owner:
- Product owner:
- Technical owner:
- Last updated: YYYY-MM-DD
- Related PRDs/architecture/ADRs:

## Quality objectives

Describe the user outcomes and system qualities that testing must protect.

## Scope

### In scope

-

### Out of scope

-

## Applications and environments

| Application/service | Environment | Browser/device or protocol | Test data approach | Owner |
| ------------------- | ----------- | -------------------------- | ------------------ | ----- |
|                     |             |                            |                    |       |

## Risk assessment

| Risk or critical journey | Impact | Likelihood | Test layer and coverage | Owner |
| ------------------------ | ------ | ---------- | ----------------------- | ----- |
|                          |        |            |                         |       |

## Coverage matrix

| Requirement/journey | Unit/component | Integration/API | Contract/schema | Playwright E2E | Exploratory/accessibility | Status |
| ------------------- | -------------- | --------------- | --------------- | -------------- | ------------------------- | ------ |
|                     |                |                 |                 |                |                           |        |

## Frontend test approach

Define Playwright projects, supported browsers/viewports, authentication setup, test fixtures, critical journeys, accessibility checks, failure artifacts, and flake policy.

## API test approach

Document the selected layers and why they are appropriate:

- Playwright `APIRequestContext` for functional black-box flows and browser/API scenarios.
- Framework-native integration tests for fast in-process behavior.
- Schemathesis for OpenAPI/GraphQL property and edge-case coverage when applicable.
- Pact for consumer-driven contracts between independently deployed systems when applicable.
- k6 for explicit load profiles and performance thresholds when applicable.

Cover contracts, authentication, authorization, validation, errors, idempotency, pagination, filtering, rate limits, concurrency, and side effects as relevant.

## Test data and isolation

Describe deterministic data creation, cleanup, tenant/user isolation, secrets handling, and prohibited production-data usage.

## Quality gates

| Gate | Command/evidence | Required threshold | Owner | When it runs |
| ---- | ---------------- | ------------------ | ----- | ------------ |
|      |                  |                    |       |              |

## Defect management

Define severity, triage ownership, evidence requirements, fix verification, and release-exception handling.

## Entry and exit criteria

### Entry

-

### Exit

-

## Results and release recommendation

- Environment and version tested:
- Commands/runs and observed results:
- Passed/failed/blocked scope:
- Open defects:
- Missing coverage:
- Residual risks:
- QA recommendation with rationale:
