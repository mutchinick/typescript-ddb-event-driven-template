# OpenSpec & Service Architecture Rules

## Spec Directory Hierarchy

All canonical specs (`openspec/specs/`) and delta specs (`openspec/changes/<id>/specs/`) MUST follow a 2-tier service structure:

`openspec/specs/<service-name>/<capability-name>/spec.md`

### Registered Services

- `event-store` (e.g., `openspec/specs/event-store/publish-event/spec.md`)
- `ecommerce-service` (e.g., `openspec/specs/ecommerce-service/place-order/spec.md`)
- `test-template-service` (e.g., `openspec/specs/test-template-service/record-finalized-job-worker/spec.md`)

## Operational Rules for AI Assistants

1. **No Flat Specs:** Never place capability folders directly under `openspec/specs/`.
2. **Service Matching:** Use exact codebase service names (no generic shortcuts like `jobs/` or `ecommerce/`).
3. **Header Semantics:**
   - Canonical files (`openspec/specs/**/spec.md`) MUST use `## Requirements`.
   - Delta files (`openspec/changes/**/specs/**/spec.md`) MUST use `## ADDED Requirements`, `## MODIFIED Requirements`, etc.
   - When archiving a change to canonical specs, always normalize `## ADDED Requirements` $\rightarrow$ `## Requirements`.
4. **Validation:** Run `openspec validate --specs` after creating or modifying specifications.
