<!--
  Sync Impact Report
  ==================
  Version change: (none) → 1.0.0
  Modified principles: N/A (initial ratification)
  Added sections:
    - Core Principles (6 principles)
    - Security & Confidentiality Requirements
    - Development Workflow & Quality Gates
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution Check section exists)
    - .specify/templates/spec-template.md ✅ compatible (requirements/success criteria align)
    - .specify/templates/tasks-template.md ✅ compatible (phase structure supports principles)
  Follow-up TODOs: none
-->

# Justime (矩时) Constitution

## Core Principles

### I. Architectural Separation

Every module MUST maintain strict layer boundaries. Frontend business
logic MUST be isolated from presentation components. Backend code MUST
follow the three-layer dependency model: Endpoints → Business → Services.
Dependencies flow in one direction only; reverse dependencies are forbidden.

All client-to-backend API requests MUST route through the Next.js BFF
proxy (`/api/v1/*`). Direct frontend calls to the backend port are
prohibited.

**Rationale**: Clean separation enables independent testing, deployment,
and scaling of each layer without cascading changes.

### II. Zero Placeholders

All code committed to the repository MUST be complete, production-grade
implementations. Placeholder comments (`// TODO`, `# FIXME`, `pass` stubs)
are forbidden unless explicitly approved in a feature specification.

**Rationale**: Placeholders accumulate technical debt and create ambiguity
about implementation completeness. Every line of code must be intentional.

### III. Test & Lint Discipline

Every code modification MUST pass linting and tests before being committed.

- **Frontend**: `npm run lint && npm test`
- **Backend**: `ruff check . && pytest tests/ -v --tb=short`
- **Mobile**: `npm run lint`

Code that fails lint MUST NOT be committed. Lint errors MUST be fixed
before a task is considered complete.

**Rationale**: Continuous quality enforcement prevents regression
accumulation and ensures consistent code style across contributors.

### IV. Layered API Pattern

All new backend API endpoints MUST follow the layered architecture:
`model` → `service` → `business` → `endpoint` → `route registration`.

- **Endpoints** handle routing, query parameters, security, and HTTP
  responses only. No business logic in endpoints.
- **Business** orchestrates multi-service workflows.
- **Services** provide focused, standalone infrastructure capabilities.

**Rationale**: Consistent layering makes the codebase navigable,
testable, and maintainable as it grows.

### V. Schema-less Database Compatibility

All new MongoDB fields MUST define default values. No field insertion
MAY assume prior data migration. Backward compatibility with existing
documents is mandatory.

**Rationale**: MongoDB is schema-less; documents created before a field
existed must not cause runtime errors when accessed by updated code.

### VI. Cross-Platform Consistency

Features shared across platforms (Web, Mobile) MUST remain synchronized.
Specifically, SSE-related changes MUST be applied simultaneously to both
`justime_agent/src/hooks/useSSEChat.ts` and
`mobile/justime_mobile/hooks/useSSEChat.ts`.

**Rationale**: Divergent client behavior erodes user trust and creates
platform-specific bugs that are expensive to diagnose.

## Security & Confidentiality Requirements

Credentials, tokens, and API keys MUST NEVER be hardcoded. All secrets
MUST be sourced from environment variables (`process.env` in TypeScript,
`os.getenv` or `settings` in Python).

Environment files (`.env`, `.env.local`) MUST remain local and MUST NOT
be committed to version control.

Debug instrumentation (`console.log`, `print()`, `breakpoint`, temporary
logging) MUST be removed before any commit.

**Rationale**: Secret leakage in version control is a critical security
incident. Debug noise in production logs degrades observability and may
expose sensitive data.

## Development Workflow & Quality Gates

1. All changes MUST target a feature branch, not `main`.
2. Lint and tests MUST pass before any commit (see Principle III).
3. New API endpoints MUST follow the layered pattern (see Principle IV).
4. Cross-platform features MUST be updated together (see Principle VI).
5. Existing comments, docstrings, and headers MUST be preserved unless
   explicitly requested to be removed.
6. MongoDB fields MUST have defaults (see Principle V).

## Governance

This constitution is the supreme project standard. All code reviews,
pull requests, and agent-generated changes MUST verify compliance with
these principles.

**Amendment procedure**:
1. Propose changes with rationale in a dedicated commit or PR.
2. Version using semantic versioning: MAJOR for principle
   removal/redefinition, MINOR for additions, PATCH for clarifications.
3. Update `LAST_AMENDED_DATE` and `CONSTITUTION_VERSION` on every change.
4. Propagate amendments to dependent templates and guidance files.

**Compliance review**: Every PR MUST be checked against these principles.
Violations MUST be resolved before merging. Complexity that violates a
principle MUST be justified in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-06-12 | **Last Amended**: 2026-06-12
