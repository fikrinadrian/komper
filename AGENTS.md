# Project agent guide

This repository uses four project-scoped custom agent types:

- `product_manager`: owns discovery, product requirements, acceptance criteria, prioritization, and release readiness.
- `cto`: owns technical strategy, architecture, ADRs, engineering standards, and cross-cutting technical risk.
- `senior_frontend_engineer`: owns frontend implementation and review using React, TypeScript, TanStack, Tailwind CSS, and Motion.
- `senior_qa_engineer`: owns risk-based quality strategy, Playwright browser coverage, API testing, exploratory testing, and release-quality evidence across all applications.

## Delegation workflow

For a substantial feature, delegate independent work to the custom agents when multi-agent tools are available:

1. Ask `product_manager` to establish or update the PRD, scope, non-goals, success measures, and acceptance criteria.
2. Ask `cto` to review feasibility and create or update the relevant architecture documentation and ADRs.
3. Ask `senior_qa_engineer` to make acceptance criteria testable, identify risks, and establish the test strategy and coverage matrix.
4. Ask one or more `senior_frontend_engineer` agents to implement independent, non-overlapping workstreams after requirements and architecture are sufficiently clear.
5. Ask `senior_qa_engineer` to test the affected applications and APIs, record defects and residual risks, and produce release-quality evidence.
6. Return product discoveries to the product manager, and cross-cutting technical decisions to the CTO. Keep those decisions in repository documents.
7. Before completion, reconcile implementation with the acceptance criteria and architecture, run the available quality gates, and report evidence.

Do not delegate tiny or tightly coupled tasks merely to use every role. Parallel agents must have explicit, non-overlapping ownership. The primary agent integrates results and remains accountable for the final answer.

## Source-of-truth documents

- Product requirements: `docs/product/`
- Architecture overview and technical plans: `docs/architecture/`
- Architecture decisions: `docs/architecture/adr/`
- Quality strategy and coverage: `docs/quality/`

Use the templates in those directories. Update an existing document instead of creating competing versions of the same decision.

## Frontend baseline

- Use React and strict TypeScript.
- Prefer TanStack Router, Query, Table, and Form for the problems each library is designed to solve; do not introduce one without a concrete need.
- Use Tailwind CSS and the repository's tokens/components for visual styling.
- Use Motion for React for purposeful animation, with reduced-motion support.
- Treat accessibility, responsive behavior, loading/empty/error states, security, and performance as acceptance concerns, not optional polish.
- Follow existing package-manager scripts once the application is scaffolded. Before handoff, run all available format, type-check, lint, test, and build checks relevant to changed files.

## Testing baseline

- Use Playwright Test for browser end-to-end coverage and Playwright `APIRequestContext` for black-box functional API flows by default.
- Use resilient user-facing locators, web-first assertions, isolated test data, and CI traces. Do not use arbitrary sleeps or brittle implementation selectors.
- Add Schemathesis for schema-driven OpenAPI/GraphQL edge cases, Pact for genuine consumer/provider contract risk, and k6 for load and performance testing when each is justified.
- Test every affected application and service. Maintain a coverage matrix that maps critical journeys and risks to the appropriate test layer.
- Quality reports must state the environment, tested scope, commands, results, known defects, missing coverage, and residual risk. A green command without this context is not release evidence.

## Decision boundaries

- The product manager decides user value, priority, scope, and acceptance intent.
- The CTO decides architecture and engineering standards after considering product constraints.
- Engineers decide local implementation details within accepted requirements and architecture.
- The senior QA engineer owns test strategy and quality evidence, and recommends release readiness based on observed risk; the product owner makes the release decision.
- Any agent may challenge a decision with evidence, but must document the resolution with the appropriate owner.
- Never represent assumptions as approved decisions or claim tests, research, approvals, or metrics that were not observed.
