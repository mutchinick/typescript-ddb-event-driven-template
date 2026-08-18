## Purpose

Determine when all required task-executed events for a job have been observed, and emit exactly one `ALL_TASKS_COMPLETED_EVENT` for that job while preserving safe idempotent behavior and clear retry semantics.

## Requirements

### Requirement: Accept only valid task-executed domain events as trigger contracts

The CompleteAllTasksWorker SHALL begin processing only when it receives a valid task-executed domain event envelope whose payload satisfies one of the accepted trigger schemas.

#### Scenario: Valid task-executed trigger schemas are accepted

- **WHEN** the worker receives any one of the following canonical trigger event shapes:

```json
{
  "eventName": "TASK_FOO_EXECUTED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "executed": true
  }
}
```

```json
{
  "eventName": "TASK_QUX_EXECUTED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "executed": true
  }
}
```

```json
{
  "eventName": "TASK_BAR_EXECUTED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "executed": true
  }
}
```

- **THEN** the worker accepts the event as a valid trigger
- **THEN** the worker derives processing from `eventData.jobId`
- **THEN** the worker does not require additional business fields to initiate completion evaluation

#### Scenario: Invalid task-executed trigger is rejected as a permanent input failure

- **WHEN** the worker receives an event that is not a valid task-executed envelope, has invalid JSON payload, has missing or invalid `jobId`, has `executed` set to anything other than the literal boolean `true`, or has an unrecognized event class
- **THEN** the worker treats the input as a non-transient `InvalidArgumentsError`
- **THEN** the worker does not emit an `ALL_TASKS_COMPLETED_EVENT`
- **THEN** the worker acknowledges the message instead of requeueing it

### Requirement: Evaluate domain completion state before emitting completion event

The CompleteAllTasksWorker SHALL evaluate job completion state from event-store history for the same job identifier and emit completion only when all required task-executed events are present.

#### Scenario: Not all required task events are present

- **WHEN** the worker processes a valid task-executed trigger for `jobId` `job-123456`
- **AND** the event-store history for that `jobId` does not contain all of `TASK_FOO_EXECUTED_EVENT`, `TASK_QUX_EXECUTED_EVENT`, and `TASK_BAR_EXECUTED_EVENT`
- **THEN** the worker completes successfully without publishing `ALL_TASKS_COMPLETED_EVENT`
- **THEN** the message is acknowledged

#### Scenario: All required task events are present

- **WHEN** the worker processes a valid task-executed trigger for `jobId` `job-123456`
- **AND** the event-store history for that `jobId` contains `TASK_FOO_EXECUTED_EVENT`, `TASK_QUX_EXECUTED_EVENT`, and `TASK_BAR_EXECUTED_EVENT`
- **THEN** the worker publishes one `ALL_TASKS_COMPLETED_EVENT`
- **THEN** the event uses the same `jobId` and sets `completed` to the literal boolean `true`

### Requirement: Emit canonical all-tasks-completed event schema

The CompleteAllTasksWorker SHALL emit a canonical completion event with deterministic business identity derived from `jobId`.

#### Scenario: Completion event payload and identity are canonical

- **WHEN** the worker emits an all-tasks-completed event for `jobId` `job-123456`
- **THEN** the resulting domain event has this canonical shape:

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

- **THEN** the emitted `eventData.jobId` is exactly the same business key used for completion-state evaluation
- **THEN** the worker does not synthesize a different business key

### Requirement: Guarantee idempotent outcome for duplicate processing

The CompleteAllTasksWorker SHALL guarantee that duplicate processing of an identical logical trigger completes safely without creating additional completion events.

#### Scenario: Duplicate completion publish is treated as idempotent safe outcome

- **GIVEN** an `ALL_TASKS_COMPLETED_EVENT` already exists for `jobId` `job-123456`
- **WHEN** the worker processes another valid task-executed trigger for the same `jobId`
- **THEN** the event store rejects duplicate completion publish with `DuplicateEventError`
- **THEN** the worker does not create a second `ALL_TASKS_COMPLETED_EVENT`
- **THEN** the worker acknowledges the message instead of marking it for retry
- **THEN** the overall workflow effect is idempotent and safe

#### Scenario: Replayed trigger deliveries remain side-effect safe

- **GIVEN** the same logical task-executed trigger is delivered more than once for the same `jobId`
- **WHEN** the worker processes each delivery independently
- **THEN** at most one `ALL_TASKS_COMPLETED_EVENT` is persisted for that job completion transition
- **THEN** later duplicate deliveries do not produce additional business effects

### Requirement: Classify permanent failures separately from retryable failures

The CompleteAllTasksWorker SHALL classify schema and business rejections as non-transient and infrastructure failures as transient so queue retry behavior remains correct.

#### Scenario: Permanent rejections are acknowledged and dropped

- **WHEN** parsing, trigger reconstruction, trigger validation, or business-class validation fails with `InvalidArgumentsError`
- **THEN** the worker treats the failure as non-transient
- **THEN** the worker does not request retry
- **THEN** the queue message is acknowledged and removed from retry flow

#### Scenario: Transient event-store read failure is retried

- **WHEN** the worker successfully validates input but event-store completion-state lookup fails with transient `UnrecognizedError`
- **THEN** the worker marks the message for retry
- **THEN** the failure is returned as transient

#### Scenario: Transient event-store publish failure is retried

- **WHEN** the worker determines all required task events are present but completion-event publish fails with transient `UnrecognizedError`
- **THEN** the worker marks the message for retry
- **THEN** the worker does not report successful completion for that delivery

#### Scenario: Non-transient duplicate outcome is not retried

- **WHEN** the event store returns non-transient `DuplicateEventError` for completion publish
- **THEN** the worker acknowledges the message
- **THEN** the worker does not add the message to the retry set
