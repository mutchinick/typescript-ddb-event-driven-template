## Purpose

Process each accepted `STEP_PROCESSED_EVENT` by deriving and persisting exactly one `TASK_FOO_EXECUTED_EVENT` for the same job identifier, while treating duplicate reprocessing as a safe idempotent outcome and separating permanent input rejection from transient infrastructure failure.

## Requirements

### Requirement: Accept only a valid step-processed domain event as the trigger contract

The ExecuteTaskFooWorker SHALL begin processing only when it receives a valid `STEP_PROCESSED_EVENT` envelope whose payload satisfies the step-processed domain event schema.

#### Scenario: Valid step-processed event can trigger processing

- **WHEN** the worker receives a step-processed domain event with this canonical shape:

```json
{
  "eventName": "STEP_PROCESSED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "processed": true
  }
}
```

- **THEN** the worker accepts the event as a valid trigger
- **THEN** the worker derives processing from the `jobId` value in the event payload
- **THEN** the worker does not require any additional business fields to start processing

#### Scenario: Invalid step-processed event is rejected as a permanent input failure

- **WHEN** the worker receives an event that is missing `jobId`, has a blank or trimmed-short `jobId`, has `processed` set to anything other than the literal boolean `true`, or is otherwise not a valid `STEP_PROCESSED_EVENT` envelope
- **THEN** the worker treats the input as a non-transient `InvalidArgumentsError`
- **THEN** the worker does not emit a `TASK_FOO_EXECUTED_EVENT`
- **THEN** the worker acknowledges the message instead of requeueing it

### Requirement: Transform step-processed input into a task-foo-executed output event

The ExecuteTaskFooWorker SHALL transform each accepted `STEP_PROCESSED_EVENT` into one `TASK_FOO_EXECUTED_EVENT` that preserves the same `jobId` and sets `executed` to the literal boolean `true`.

#### Scenario: Accepted step-processed event produces the canonical task-foo-executed event

- **WHEN** the worker processes a valid `STEP_PROCESSED_EVENT` for a job identifier
- **THEN** it emits a `TASK_FOO_EXECUTED_EVENT` with the same `jobId`
- **THEN** it sets `executed` to `true`
- **THEN** it uses an idempotency key derived from that same `jobId`
- **THEN** it records the event with the current ISO timestamp string as `createdAt`

- **THEN** the resulting domain event has this canonical shape:

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

#### Scenario: Task execution does not change the job identifier

- **WHEN** a valid `STEP_PROCESSED_EVENT` is processed successfully
- **THEN** the emitted `TASK_FOO_EXECUTED_EVENT.eventData.jobId` is exactly the same value as the input event `jobId`
- **THEN** the worker does not synthesize a new job identifier
- **THEN** the worker does not mutate the input into a different business key

### Requirement: Treat duplicate processing as an idempotent success outcome

The ExecuteTaskFooWorker SHALL guarantee that reprocessing the same logical step-processed event does not create a second task-foo-executed record and completes safely as an idempotent success from the workflow perspective.

#### Scenario: Duplicate task execution is acknowledged without creating a second event

- **GIVEN** a `TASK_FOO_EXECUTED_EVENT` already exists for `jobId` `job-123456`
- **WHEN** the worker processes another valid `STEP_PROCESSED_EVENT` for the same `jobId`
- **THEN** the event store rejects the duplicate task-foo-executed publish attempt with `DuplicateEventError`
- **THEN** the worker does not create a second `TASK_FOO_EXECUTED_EVENT`
- **THEN** the worker acknowledges the message instead of marking it for retry
- **THEN** the overall processing outcome is idempotent and safe

#### Scenario: Replayed trigger event for the same job remains safe

- **GIVEN** the same valid `STEP_PROCESSED_EVENT` is delivered more than once for the same `jobId`
- **WHEN** the worker processes each delivery independently
- **THEN** at most one `TASK_FOO_EXECUTED_EVENT` is persisted for that logical job step
- **THEN** any later duplicate delivery does not produce a new business effect

### Requirement: Classify permanent rejections separately from transient failures

The ExecuteTaskFooWorker SHALL classify business and schema rejections as non-transient and infrastructure failures as transient so the queue can distinguish acknowledge-only outcomes from retryable outcomes.

#### Scenario: Permanent input rejection is dropped and acknowledged

- **WHEN** the worker cannot parse the incoming message body, cannot reconstruct a valid `STEP_PROCESSED_EVENT`, or receives a trigger event with invalid business data
- **THEN** the worker returns a non-transient `InvalidArgumentsError`
- **THEN** the worker does not request a retry
- **THEN** the queue message is acknowledged and removed from the delivery path

#### Scenario: Temporary publishing failure is marked for retry

- **WHEN** the worker successfully validates the input event but the event store publish operation fails for a transient infrastructure reason
- **THEN** the worker returns a transient `UnrecognizedError`
- **THEN** the queue message is marked for retry
- **THEN** the worker does not claim successful completion for that delivery

#### Scenario: Non-transient duplicate outcomes are not retried

- **WHEN** the event store reports `DuplicateEventError` while publishing the task-foo-executed event
- **THEN** the worker treats the outcome as non-transient
- **THEN** the worker acknowledges the message
- **THEN** the worker does not add the message to the retry set
