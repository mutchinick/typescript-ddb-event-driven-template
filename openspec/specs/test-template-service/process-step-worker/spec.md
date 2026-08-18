## Purpose

Process each accepted `JOB_CREATED_EVENT` by deriving and persisting exactly one `STEP_PROCESSED_EVENT` for the same job identifier, while treating duplicate reprocessing as a safe idempotent outcome and separating permanent input rejection from transient infrastructure failure.

## Requirements

### Requirement: Accept only a valid job-created domain event as the trigger contract

The ProcessStepWorker SHALL begin processing only when it receives a valid `JOB_CREATED_EVENT` envelope whose payload satisfies the job-created domain event schema.

#### Scenario: Valid job-created event can trigger processing

- **WHEN** the worker receives a job-created domain event with this canonical shape:

```json
{
  "eventName": "JOB_CREATED_EVENT",
  "idempotencyKey": "jobId:job-123456",
  "createdAt": "2024-10-19T03:24:00.000Z",
  "eventData": {
    "jobId": "job-123456",
    "created": true
  }
}
```

- **THEN** the worker accepts the event as a valid trigger
- **THEN** the worker derives processing from the `jobId` value in the event payload
- **THEN** the worker does not require any additional business fields to start processing

#### Scenario: Invalid job-created event is rejected as a permanent input failure

- **WHEN** the worker receives an event that is missing `jobId`, has a blank or trimmed-short `jobId`, has `created` set to anything other than the literal boolean `true`, or is otherwise not a valid `JOB_CREATED_EVENT` envelope
- **THEN** the worker treats the input as a non-transient `InvalidArgumentsError`
- **THEN** the worker does not emit a `STEP_PROCESSED_EVENT`
- **THEN** the worker acknowledges the message instead of requeueing it

### Requirement: Transform job-created input into a step-processed output event

The ProcessStepWorker SHALL transform each accepted `JOB_CREATED_EVENT` into one `STEP_PROCESSED_EVENT` that preserves the same `jobId` and sets `processed` to the literal boolean `true`.

#### Scenario: Accepted job-created event produces the canonical step-processed event

- **WHEN** the worker processes a valid `JOB_CREATED_EVENT` for a job identifier
- **THEN** it emits a `STEP_PROCESSED_EVENT` with the same `jobId`
- **THEN** it sets `processed` to `true`
- **THEN** it uses an idempotency key derived from that same `jobId`
- **THEN** it records the event with the current ISO timestamp string as `createdAt`

- **THEN** the resulting domain event has this canonical shape:

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

#### Scenario: Step processing does not change the job identifier

- **WHEN** a valid `JOB_CREATED_EVENT` is processed successfully
- **THEN** the emitted `STEP_PROCESSED_EVENT.eventData.jobId` is exactly the same value as the input event `jobId`
- **THEN** the worker does not synthesize a new job identifier
- **THEN** the worker does not mutate the input into a different business key

### Requirement: Treat duplicate processing as an idempotent success outcome

The ProcessStepWorker SHALL guarantee that reprocessing the same logical job-created event does not create a second step-processed record and completes safely as an idempotent success from the workflow perspective.

#### Scenario: Duplicate step processing is acknowledged without creating a second event

- **GIVEN** a `STEP_PROCESSED_EVENT` already exists for `jobId` `job-123456`
- **WHEN** the worker processes another valid `JOB_CREATED_EVENT` for the same `jobId`
- **THEN** the event store rejects the duplicate step-processed publish attempt with `DuplicateEventError`
- **THEN** the worker does not create a second `STEP_PROCESSED_EVENT`
- **THEN** the worker acknowledges the message instead of marking it for retry
- **THEN** the overall processing outcome is idempotent and safe

#### Scenario: Replayed trigger event for the same job remains safe

- **GIVEN** the same valid `JOB_CREATED_EVENT` is delivered more than once for the same `jobId`
- **WHEN** the worker processes each delivery independently
- **THEN** at most one `STEP_PROCESSED_EVENT` is persisted for that logical job step
- **THEN** any later duplicate delivery does not produce a new business effect

### Requirement: Classify permanent rejections separately from transient failures

The ProcessStepWorker SHALL classify business and schema rejections as non-transient and infrastructure failures as transient so the queue can distinguish acknowledge-only outcomes from retryable outcomes.

#### Scenario: Permanent input rejection is dropped and acknowledged

- **WHEN** the worker cannot parse the incoming message body, cannot reconstruct a valid `JOB_CREATED_EVENT`, or receives a trigger event with invalid business data
- **THEN** the worker returns a non-transient `InvalidArgumentsError`
- **THEN** the worker does not request a retry
- **THEN** the queue message is acknowledged and removed from the delivery path

#### Scenario: Temporary publishing failure is marked for retry

- **WHEN** the worker successfully validates the input event but the event store publish operation fails for a transient infrastructure reason
- **THEN** the worker returns a transient `UnrecognizedError`
- **THEN** the queue message is marked for retry
- **THEN** the worker does not claim successful completion for that delivery

#### Scenario: Non-transient duplicate outcomes are not retried

- **WHEN** the event store reports `DuplicateEventError` while publishing the step-processed event
- **THEN** the worker treats the outcome as non-transient
- **THEN** the worker acknowledges the message
- **THEN** the worker does not add the message to the retry set
