## Context

See proposal.md for motivation. The current workflow ends with JOB_FINALIZED_EVENT publication, but there is no dedicated non-event record projection for finalized jobs. Existing slices mostly use EventStoreClient for event persistence; this change introduces a slice-local client for non-event writes while preserving the existing event-sourcing flow.

## Goals / Non-Goals

**Goals:**

- Add a new worker slice that listens to JOB_FINALIZED_EVENT and writes finalized-job tracking records.
- Enforce controller-service-client layering for non-event writes.
- Inject DynamoDBDocumentClient explicitly into the slice-local client.
- Keep EventStoreClient usage unchanged for domain event persistence.

**Non-Goals:**

- Changing existing event schema or event-store key structure.
- Replacing existing worker slices with slice-local clients where not required.
- Adding read/query APIs for finalized-job records in this change.

## Decisions

1. Create a dedicated worker slice named RecordFinalizedJobWorker.

- Rationale: keeps responsibility isolated to finalized-job projection behavior and aligns with current vertical-slice organization.
- Alternative considered: extend FinalizeJobWorker. Rejected because FinalizeJobWorker owns domain event emission; this new behavior is projection persistence and deserves separate ownership.

2. Use a slice-local single-operation client named FinalizedJobRecordClient.

- Rationale: non-event persistence should not flow through EventStoreClient, and a single-operation client enforces focused responsibility.
- Alternative considered: add method to EventStoreClient. Rejected because it mixes event persistence and non-event projection responsibilities.

3. Persist records with base-key uniqueness and GSI date ordering.

- Rationale: one base item per job is guaranteed by deterministic pk/sk, while the existing GSI captures chronological access with ISO timestamp ordering.
- Selected key shape:
  - base key: pk FINALIZED_JOBS#jobId:{jobId}, sk FINALIZED_JOB.
  - GSI key: gsi1pk FINALIZED_JOBS#BY_DATE, gsi1sk FINALIZED_AT#{isoDate}#JOB_ID#{jobId}.
  - record timestamps: createdAt and updatedAt are written on insert.
- Alternative considered: base sk as current ISO timestamp string. Rejected because duplicate prevention per jobId cannot be guaranteed with varying sk.

4. Add finalized-job-specific failure kinds for non-event write operations.

- Rationale: prevents overloading generic error names and gives explicit domain context for this new slice behavior.
- Selected failure kinds:
  - DuplicateFinalizedJobError for conditional-check duplicate failures.
  - FinalizedJobWriteError for non-duplicate write failures.

5. Keep existing worker failure semantics based on Result transient/non-transient classification.

- Rationale: matches established SQS batch retry behavior used in current worker controllers.
- Alternative considered: custom retry policy for this slice. Rejected to avoid divergence from existing worker behavior.

## Risks / Trade-offs

- [Risk] Additional write attributes for the GSI increase write amplification -> Mitigation: keep this projection to one item per job and reuse existing GSI rather than adding a new index.
- [Risk] New non-event write pattern may be inconsistently applied in future slices -> Mitigation: document boundary explicitly in project.md and enforce via code review.
- [Risk] Additional worker increases infrastructure and operational surface -> Mitigation: mirror existing construct settings and patterns to reduce variance.

## Migration Plan

1. Add RecordFinalizedJobWorker slice (controller, service, client, handler, tests).
2. Extend failure union with DuplicateFinalizedJobError and FinalizedJobWriteError.
3. Add RecordFinalizedJobWorker construct and wire it in TestTemplateServiceMainConstruct.
4. Configure EventBridge rule filter for JOB_FINALIZED_EVENT to the new worker queue.
5. Deploy to dev stage and validate end-to-end flow by creating a job and observing finalized-job record writes and GSI ordering behavior.
6. Rollback strategy: remove new construct wiring and redeploy if regressions occur.

## Open Questions

None.
