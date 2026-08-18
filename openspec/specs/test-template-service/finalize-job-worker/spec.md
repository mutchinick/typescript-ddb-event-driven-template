## Purpose

Process each accepted all-tasks-completed trigger for a job and emit exactly one `JOB_FINALIZED_EVENT` for that same job while preserving idempotent duplicate safety and explicit retry classification semantics.

## Requirements

### Requirement: Accept only a valid all-tasks-completed domain event as trigger contract

The FinalizeJobWorker SHALL begin processing only when it receives a valid `ALL_TASKS_COMPLETED_EVENT` envelope whose payload satisfies the accepted trigger schema.

#### Scenario: Valid all-tasks-completed trigger schema is accepted

- **WHEN** the worker receives a domain event with this canonical trigger shape:

```json
{
  "eventName": "ALL_TASKS_COMPLETED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "completed": true
  }
}
```

- **THEN** the worker accepts the event as a valid trigger
- **THEN** the worker derives processing from `eventData.jobId`
- **THEN** the worker does not require additional business fields to initiate finalization

#### Scenario: Invalid all-tasks-completed trigger is rejected as permanent input failure

- **WHEN** the worker receives an event that cannot be parsed, cannot be reconstructed as an all-tasks-completed domain event, has missing or invalid `jobId`, has `completed` set to anything other than the literal boolean `true`, or belongs to an unrecognized event class
- **THEN** the worker treats the input as a non-transient `InvalidArgumentsError`
- **THEN** the worker does not emit a `JOB_FINALIZED_EVENT`
- **THEN** the worker acknowledges the message instead of requeueing it

### Requirement: Transform accepted all-tasks-completed input into finalized output event

The FinalizeJobWorker SHALL transform each accepted `ALL_TASKS_COMPLETED_EVENT` into one `JOB_FINALIZED_EVENT` using the same business identity for the target job.

#### Scenario: Accepted trigger emits job-finalized event

- **WHEN** the worker processes a valid `ALL_TASKS_COMPLETED_EVENT` for `jobId` `job-123456`
- **THEN** the worker publishes one `JOB_FINALIZED_EVENT`
- **THEN** the published event uses the same `jobId`
- **THEN** the published event sets `finalized` to the literal boolean `true`

### Requirement: Emit canonical job-finalized event schema

The FinalizeJobWorker SHALL emit a canonical finalized event with deterministic event identity derived from `jobId`.

#### Scenario: Finalized event payload and identity are canonical

- **WHEN** the worker emits a finalized event for `jobId` `job-123456`
- **THEN** the resulting domain event has this canonical shape:

```json
{
  "eventName": "JOB_FINALIZED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "finalized": true
  }
}
```

- **THEN** the emitted `eventData.jobId` is exactly the same business key used for transformation input
- **THEN** the worker does not synthesize a different business key

### Requirement: Guarantee idempotent outcome for duplicate processing

The FinalizeJobWorker SHALL guarantee that duplicate processing of an identical logical trigger completes safely without creating additional finalized events.

#### Scenario: Duplicate publish outcome is treated as idempotent safe result

- **GIVEN** a `JOB_FINALIZED_EVENT` already exists for `jobId` `job-123456`
- **WHEN** the worker processes another valid `ALL_TASKS_COMPLETED_EVENT` for the same `jobId`
- **THEN** the event store rejects duplicate finalized publish with `DuplicateEventError`
- **THEN** the worker does not create a second `JOB_FINALIZED_EVENT`
- **THEN** the worker acknowledges the message instead of marking it for retry
- **THEN** the overall workflow effect remains idempotent and safe

#### Scenario: Replayed trigger deliveries remain side-effect safe

- **GIVEN** the same logical all-tasks-completed trigger is delivered more than once for the same `jobId`
- **WHEN** the worker processes each delivery independently
- **THEN** at most one `JOB_FINALIZED_EVENT` is persisted for that job finalization transition
- **THEN** later duplicate deliveries do not produce additional business effects

### Requirement: Classify permanent failures separately from retryable failures

The FinalizeJobWorker SHALL classify schema and business rejections as non-transient and infrastructure failures as transient so queue retry behavior remains correct.

#### Scenario: Permanent rejections are acknowledged and dropped

- **WHEN** parsing, trigger reconstruction, trigger validation, or business-class validation fails with `InvalidArgumentsError`
- **THEN** the worker treats the failure as non-transient
- **THEN** the worker does not request retry
- **THEN** the queue message is acknowledged and removed from retry flow

#### Scenario: Transient publish failure is retried

- **WHEN** the worker successfully validates input but finalized-event publish fails with transient `UnrecognizedError`
- **THEN** the worker marks the message for retry
- **THEN** the failure is returned as transient
- **THEN** the worker does not report successful completion for that delivery

#### Scenario: Non-transient duplicate outcome is not retried

- **WHEN** the event store returns non-transient `DuplicateEventError` for finalized-event publish
- **THEN** the worker acknowledges the message
- **THEN** the worker does not add the message to the retry set
