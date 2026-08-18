## Purpose

Normalize persisted event-store envelopes back into typed domain event instances so workers can safely consume DynamoDB stream records delivered through EventBridge.

## Requirements

### Requirement: Parse DynamoDB stream records received through EventBridge

The EventStoreEventBuilder SHALL ingest EventBridge events that wrap DynamoDB stream `INSERT` records and extract the persisted event-store envelope from `detail.dynamodb.NewImage`.

#### Scenario: Valid EventBridge stream record is ingested

- **WHEN** `EventStoreEventBuilder.fromEventBridge()` receives an EventBridge event whose `detail.dynamodb.NewImage` contains a persisted event-store row
- **THEN** it unmarshals `detail.dynamodb.NewImage` into a normalized event envelope
- **THEN** the normalized envelope has this shape before domain reconstitution:

```json
{
  "eventName": "<eventName>",
  "idempotencyKey": "<idempotencyKey>",
  "createdAt": "<ISO-8601 timestamp>",
  "eventData": {
    "...": "EventStoreEventData payload"
  }
}
```

### Requirement: Resolve the domain event class by event name

The EventStoreEventBuilder SHALL use the incoming envelope `eventName` to resolve the matching event constructor from the provided `eventClassMap`.

#### Scenario: Matching event class exists for the envelope

- **WHEN** the normalized envelope contains an `eventName` that is present in the supplied `eventClassMap`
- **THEN** the builder selects the mapped event class for that `eventName`
- **THEN** it invokes that class's `reconstitute(eventData, idempotencyKey, createdAt)` method exactly once

### Requirement: Reconstitute typed domain events through schema validation

The EventStoreEventBuilder SHALL rely on the mapped event class to validate the envelope against the domain event schema and return a typed domain event instance.

#### Scenario: Domain event reconstitution succeeds

- **WHEN** the mapped event class accepts the normalized envelope through `reconstitute(eventData, idempotencyKey, createdAt)`
- **THEN** the builder returns a typed success result containing an instance of the matching domain event class
- **THEN** the envelope fields remain aligned with the persisted values for `eventName`, `idempotencyKey`, `createdAt`, and `eventData`

#### Scenario: Concrete domain event schemas reject malformed data

- **WHEN** the normalized envelope is routed to a concrete domain event such as `JOB_CREATED_EVENT`, `STEP_PROCESSED_EVENT`, `TASK_FOO_EXECUTED_EVENT`, `TASK_BAR_EXECUTED_EVENT`, `TASK_QUX_EXECUTED_EVENT`, `ALL_TASKS_COMPLETED_EVENT`, or `JOB_FINALIZED_EVENT`
- **THEN** that event class validates `eventData`, `idempotencyKey`, and `createdAt` through its own `reconstitute()` schema checks
- **THEN** representative accepted envelopes use payloads such as:

```json
{
  "JOB_CREATED_EVENT": {
    "eventData": {
      "jobId": "job-123456",
      "created": true
    },
    "idempotencyKey": "jobId:job-123456",
    "createdAt": "2024-10-19T03:24:00.000Z"
  },
  "STEP_PROCESSED_EVENT": {
    "eventData": {
      "jobId": "job-123456",
      "processed": true
    },
    "idempotencyKey": "jobId:job-123456",
    "createdAt": "2024-10-19T03:25:00.000Z"
  },
  "TASK_FOO_EXECUTED_EVENT": {
    "eventData": {
      "jobId": "job-123456",
      "executed": true
    },
    "idempotencyKey": "jobId:job-123456",
    "createdAt": "2024-10-19T03:26:00.000Z"
  }
}
```

### Requirement: Return typed failures for malformed ingestion inputs

The EventStoreEventBuilder SHALL return typed `Result` failures when the incoming EventBridge payload cannot be normalized or mapped.

#### Scenario: Incoming EventBridge payload is malformed

- **WHEN** `fromEventBridge()` receives `undefined`, lacks `detail.dynamodb.NewImage`, or otherwise cannot be unmarshalled into an envelope containing `eventName`, `eventData`, `idempotencyKey`, and `createdAt`
- **THEN** it returns a typed `Result` failure with `failureKind` `InvalidArgumentsError`
- **THEN** the failure is marked as non-transient

#### Scenario: Event name is missing or unmapped

- **WHEN** the normalized envelope does not contain an `eventName` or the `eventClassMap` does not define a matching constructor for that event name
- **THEN** the builder returns a typed `Result` failure with `failureKind` `InvalidArgumentsError`
- **THEN** the failure is marked as non-transient

#### Scenario: Reconstitution returns a typed failure

- **WHEN** the resolved event class returns a typed `Failure` from `reconstitute()` because the envelope violates the concrete event schema
- **THEN** the builder propagates that failure unchanged to the caller
