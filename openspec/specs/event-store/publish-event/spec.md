## Purpose

Persist immutable domain events into the shared DynamoDB event store using a single conditional write per event so repeated publishes of the same logical event do not create duplicate rows.

## Requirements

### Requirement: Persist a canonical event-store row

The EventStoreClient SHALL persist a validated EventStoreEvent as a single DynamoDB item in the shared event-store table.

#### Scenario: Valid event is published

- **WHEN** `EventStoreClient.publish()` receives an `EventStoreEvent` instance whose `eventData` is not `null` or `undefined`
- **THEN** it issues one DynamoDB `PutItem` operation against the table named by `EVENT_STORE_TABLE_NAME`
- **THEN** the persisted item matches this canonical single-table schema:

```json
{
  "pk": "EVENTS#<idempotencyKey>",
  "sk": "EVENTS#<eventName>",
  "idempotencyKey": "<idempotencyKey>",
  "eventName": "<eventName>",
  "eventData": {
    "...": "EventStoreEventData payload"
  },
  "createdAt": "<ISO-8601 timestamp>",
  "_tn": "EVENTS#EVENT",
  "_sn": "EVENTS",
  "gsi1pk": "EVENTS#EVENT",
  "gsi1sk": "CREATED_AT#<ISO-8601 timestamp>"
}
```

### Requirement: Validate publish inputs before persistence

The EventStoreClient SHALL reject invalid publish arguments before attempting DynamoDB persistence.

#### Scenario: Event argument is not a valid EventStoreEvent

- **WHEN** `EventStoreClient.publish()` receives `undefined`, `null`, a non-class object, or an event whose `eventData` is `null` or `undefined`
- **THEN** it returns a typed `Result` failure with `failureKind` `InvalidArgumentsError`
- **THEN** the failure is marked as non-transient
- **THEN** it does not attempt the DynamoDB write

### Requirement: Enforce idempotent event publication

The EventStoreClient SHALL enforce idempotency by conditioning each write on the absence of the target primary key pair.

#### Scenario: First publish for an event key succeeds

- **WHEN** `EventStoreClient.publish()` builds the DynamoDB write for an event identified by `pk` `EVENTS#<idempotencyKey>` and `sk` `EVENTS#<eventName>`
- **THEN** it uses the condition expression `attribute_not_exists(pk) AND attribute_not_exists(sk)`
- **THEN** the write succeeds only when no item already exists with that exact `pk` and `sk`

#### Scenario: Duplicate publish for the same event key is rejected deterministically

- **GIVEN** an event-store row already exists with `pk` `EVENTS#<idempotencyKey>` and `sk` `EVENTS#<eventName>`
- **WHEN** `EventStoreClient.publish()` attempts to persist the same logical event again
- **THEN** DynamoDB raises a conditional-check failure for the guarded write
- **THEN** the client maps that failure to a typed `Result` failure with `failureKind` `DuplicateEventError`
- **THEN** the duplicate failure is marked as non-transient
- **THEN** no second event-store row is created

### Requirement: Preserve event envelopes exactly as provided

The EventStoreClient SHALL persist the event envelope values without reshaping the domain payload.

#### Scenario: Event payload from a domain event is written unchanged

- **WHEN** a domain event such as `JOB_CREATED_EVENT`, `STEP_PROCESSED_EVENT`, `TASK_FOO_EXECUTED_EVENT`, `TASK_BAR_EXECUTED_EVENT`, `TASK_QUX_EXECUTED_EVENT`, `ALL_TASKS_COMPLETED_EVENT`, or `JOB_FINALIZED_EVENT` is published
- **THEN** the stored envelope preserves the supplied `eventName`, `idempotencyKey`, `createdAt`, and `eventData`
- **THEN** a representative payload remains structurally intact, for example:

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

### Requirement: Classify write-time infrastructure failures

The EventStoreClient SHALL classify persistence failures into typed result contracts.

#### Scenario: Write construction fails before the request is sent

- **WHEN** the publish path cannot construct the DynamoDB command, including missing or invalid command input data
- **THEN** it returns a typed `Result` failure with `failureKind` `InvalidArgumentsError`
- **THEN** the failure is marked as non-transient

#### Scenario: An unrecognized DynamoDB failure occurs during publish

- **WHEN** the DynamoDB client throws an error other than a conditional-check failure while sending the publish command
- **THEN** the client returns a typed `Result` failure with `failureKind` `UnrecognizedError`
- **THEN** the failure is marked as transient
