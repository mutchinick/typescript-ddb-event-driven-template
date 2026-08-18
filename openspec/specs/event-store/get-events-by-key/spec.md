## Purpose

Read all events for a logical stream key from the shared event-store table and return them as chronologically ordered `EventStoreEvent` instances without treating an empty stream as an error.

## Requirements

### Requirement: Resolve the event-stream partition key

The event-store read flow SHALL query streams by the partition key format `EVENTS#<idempotencyKey>`.

#### Scenario: A caller resolves a job stream key for retrieval

- **WHEN** an upstream caller needs all events for a job-scoped stream keyed by `jobId:<jobId>`
- **THEN** it resolves the query partition key as `EVENTS#jobId:<jobId>`
- **THEN** it invokes `EventStoreClient.getEventsByKey()` with that fully qualified key

### Requirement: Query DynamoDB by partition key

The EventStoreClient SHALL retrieve stream rows by issuing a DynamoDB query on the event-store table primary partition key.

#### Scenario: Valid stream key is queried

- **WHEN** `EventStoreClient.getEventsByKey()` receives a non-empty string key `EVENTS#<idempotencyKey>`
- **THEN** it issues one DynamoDB `Query` against the table named by `EVENT_STORE_TABLE_NAME`
- **THEN** it uses `pk = :pk` as the key condition expression
- **THEN** it binds `:pk` to the supplied partition key value

### Requirement: Validate get-events-by-key inputs

The EventStoreClient SHALL reject malformed stream keys before issuing the DynamoDB query.

#### Scenario: Stream key is missing or blank

- **WHEN** `EventStoreClient.getEventsByKey()` receives `undefined`, `null`, a non-string value, an empty string, or a whitespace-only string
- **THEN** it returns a typed `Result` failure with `failureKind` `InvalidArgumentsError`
- **THEN** the failure is marked as non-transient
- **THEN** it does not issue the DynamoDB query

### Requirement: Return chronologically ordered event envelopes

The EventStoreClient SHALL transform queried rows into typed `EventStoreEvent` instances and SHALL order the returned stream by ascending `createdAt`.

#### Scenario: Retrieved rows are transformed into EventStoreEvent instances

- **WHEN** the DynamoDB query returns one or more event-store rows for the same `pk`
- **THEN** the client transforms each row into an `EventStoreEvent` instance with the `EventStoreEvent` prototype applied
- **THEN** each returned event envelope contains only these typed fields:

```json
{
  "idempotencyKey": "<idempotencyKey>",
  "eventName": "<eventName>",
  "eventData": {
    "...": "EventStoreEventData payload"
  },
  "createdAt": "<ISO-8601 timestamp>"
}
```

#### Scenario: Retrieved rows are ordered by event time

- **WHEN** the DynamoDB query returns stream rows in any order
- **THEN** the client sorts the rows by `createdAt` in ascending lexicographic ISO timestamp order before returning them
- **THEN** the earliest event in the stream is returned first
- **THEN** later events in the same stream follow in ascending timestamp order

### Requirement: Treat an empty stream as a successful read

The EventStoreClient SHALL treat the absence of matching stream rows as a successful empty result.

#### Scenario: No rows exist for the queried stream key

- **WHEN** the DynamoDB query returns no `Items`
- **THEN** the client returns a typed success result containing an empty array
- **THEN** it does not return an error for the empty stream

### Requirement: Classify retrieval failures into result contracts

The EventStoreClient SHALL map retrieval-path failures into typed `Result` objects.

#### Scenario: Query command construction fails

- **WHEN** the client cannot construct the DynamoDB query command for the supplied input
- **THEN** it returns a typed `Result` failure with `failureKind` `InvalidArgumentsError`
- **THEN** the failure is marked as non-transient

#### Scenario: Query execution fails unexpectedly

- **WHEN** the DynamoDB client throws an unrecognized error while executing the stream query
- **THEN** the client returns a typed `Result` failure with `failureKind` `UnrecognizedError`
- **THEN** the failure is marked as transient
