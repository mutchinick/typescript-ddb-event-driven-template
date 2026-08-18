## Why

The workflow currently ends at JobFinalizedEvent publication but does not persist a dedicated non-event record for finalized jobs. We need this now to support projection-style access patterns and to formalize a slice-local client pattern for non-event DynamoDB writes.

## What Changes

- Add a new worker vertical slice named RecordFinalizedJobWorker that listens to JOB_FINALIZED_EVENT and writes a finalized-job record to DynamoDB.
- Add a slice-local single-operation client to persist non-event records with explicit DynamoDBDocumentClient dependency injection.
- Store finalized-job records with uniqueness in the base key and date ordering in the existing GSI:
  - base key: pk FINALIZED_JOBS#jobId:{jobId}, sk FINALIZED_JOB.
  - GSI key: gsi1pk FINALIZED_JOBS#BY_DATE, gsi1sk FINALIZED_AT#{isoDate}#JOB_ID#{jobId}.
  - timestamps: createdAt and updatedAt on the finalized-job record item.
- Add finalized-job-specific failure kinds for the new client path:
  - DuplicateFinalizedJobError.
  - FinalizedJobWriteError.
- Add tests for controller, service, client, handler, and infrastructure wiring updates.
- Update infrastructure wiring to route JOB_FINALIZED_EVENT records to the new worker.

## Capabilities

### New Capabilities

- record-finalized-job-worker: Persist one non-event finalized-job base record per jobId from JOB_FINALIZED_EVENT through a dedicated worker slice and client, with date-ordered lookup attributes in the existing GSI.

### Modified Capabilities

- None.

## Impact

- Affected services code:
  - New worker slice under services/src/test-template-service/RecordFinalizedJobWorker.
  - New slice-local client for finalized-job record writes.
- Affected infrastructure code:
  - New worker construct under infra/lib/test-template-service.
  - Main service construct wiring update to include the new worker.
- Affected behavior:
  - Adds a non-event persistence side effect after JOB_FINALIZED_EVENT.
  - Guarantees a single finalized-job record per jobId in the base table key.
  - Preserves date-ordered search via the existing gsi1pk-gsi1sk-index.
  - Keeps event-store behavior unchanged for domain events.
