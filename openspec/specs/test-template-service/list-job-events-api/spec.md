## Purpose

The ListJobEventsApi provides a read-only query capability for a job's event stream. It accepts a job identifier, validates the request, retrieves all persisted events associated with that job, and returns the job-scoped event list in a stable payload shape. The API is intentionally idempotent from the caller's perspective: repeated requests for the same job do not mutate domain state and an empty event stream is treated as a successful empty result.

## Requirements

### Requirement: Accept valid list-job-events requests

The ListJobEventsApi SHALL accept an authenticated or otherwise valid HTTP request to `POST /api/v1/test-template-service/listJobEvents` when the body contains a single `jobId` value that is a non-empty string after trimming.

#### Scenario: Valid list-job-events request is accepted

- **WHEN** a client submits a request to `POST /api/v1/test-template-service/listJobEvents` with a JSON body like:

```json
{
  "jobId": "ABC-1234"
}
```

- **THEN** the API accepts the request as valid
- **THEN** it queries the event store for all events associated with that job
- **THEN** it returns an HTTP `200 OK` response
- **THEN** the response body includes the requested `jobId` and an `events` array

### Requirement: Validate request schema and input contract

The ListJobEventsApi SHALL reject malformed or incomplete request bodies before reading any job events, and SHALL treat the payload as invalid whenever `jobId` is missing, blank, or not a string.

#### Scenario: Request body is missing or invalid JSON

- **WHEN** the request has no body, a `null` body, or a body that is not valid JSON
- **THEN** the API returns an HTTP `400 Bad Request` response
- **THEN** the response body is:

```json
{
  "message": "Bad Request"
}
```

- **THEN** the API does not query the event store for job events

#### Scenario: Request body is structurally invalid

- **WHEN** the JSON body is present but does not contain a `jobId` property, contains a blank `jobId`, or contains a `jobId` value that becomes empty after trimming whitespace
- **THEN** the API returns an HTTP `400 Bad Request` response
- **THEN** the response body is:

```json
{
  "message": "Bad Request"
}
```

- **THEN** the API does not return any event data

#### Scenario: Request contract accepts valid input

- **WHEN** the system validates the input object:

```json
{
  "jobId": "  ABC-1234  "
}
```

- **THEN** it accepts the request as valid after trimming surrounding whitespace
- **THEN** the canonical job identifier used for querying is `ABC-1234`

### Requirement: Resolve the job stream from the supplied job identifier

The ListJobEventsApi SHALL identify the requested event stream as the set of persisted records associated with the supplied `jobId`, using the job-scoped event stream convention implied by the domain model.

#### Scenario: A valid job identifier resolves to a job event stream

- **WHEN** a client submits a valid request for `jobId` `ABC-1234`
- **THEN** the API resolves the stream to the event set for that job
- **THEN** it fetches all events belonging to that job from the event store
- **THEN** it returns those events without mutating the underlying job state

#### Scenario: A job with no persisted events returns an empty result

- **WHEN** the event store contains no rows for the requested job stream
- **THEN** the API returns an HTTP `200 OK` response
- **THEN** the body is:

```json
{
  "jobId": "ABC-1234",
  "events": []
}
```

- **THEN** the empty result is treated as a successful read, not as an error

### Requirement: Return the canonical event list payload

The ListJobEventsApi SHALL return a job-scoped event list in a stable response contract. Each returned event SHALL include the event identity, domain event name, serialized event payload, and creation timestamp.

#### Scenario: The API returns the expected event payload

- **WHEN** the event store returns one or more events for the requested job
- **THEN** the API returns HTTP `200 OK`
- **THEN** the response body is shaped like:

```json
{
  "jobId": "ABC-1234",
  "events": [
    {
      "idempotencyKey": "jobId:ABC-1234",
      "eventName": "JOB_CREATED_EVENT",
      "eventData": {
        "jobId": "ABC-1234",
        "created": true
      },
      "createdAt": "2024-10-19T03:24:00.000Z"
    }
  ]
}
```

- **THEN** each element in `events` contains `idempotencyKey`, `eventName`, `eventData`, and `createdAt`
- **AND** the array preserves the event stream ordering as ascending chronological time

#### Scenario: Returned events are domain-accurate representations

- **WHEN** the event store contains events for a job
- **THEN** the API returns each event as a plain data object and not as a raw low-level storage row
- **THEN** the `eventData` field contains the event payload as recorded by the domain
- **THEN** the `createdAt` field is the timestamp associated with that event

### Requirement: Preserve idempotency and read-only behavioral invariants

The ListJobEventsApi SHALL be idempotent from the client perspective. Repeated calls for the same valid `jobId` SHALL not create, update, delete, or duplicate job state.

#### Scenario: Repeated reads for the same job are side-effect free

- **GIVEN** a valid job already has a persisted event stream
- **WHEN** the same client submits the same request multiple times for that `jobId`
- **THEN** each request returns the same job-scoped event list for that job
- **THEN** no new events are created by the read operation
- **THEN** the domain state remains unchanged after each read

#### Scenario: Empty streams remain successful and stable

- **GIVEN** a valid `jobId` with no stored events
- **WHEN** the API is called for that `jobId`
- **THEN** it returns HTTP `200 OK`
- **THEN** it returns `"events": []`
- **THEN** it does not report a missing-job or validation failure

### Requirement: Distinguish client validation failures from infrastructure faults

The ListJobEventsApi SHALL classify request and validation failures separately from infrastructure failures. Client-input problems SHALL map to `400 Bad Request`, while unexpected storage or execution faults SHALL map to `500 Internal Server Error`.

#### Scenario: Invalid input maps to a client error

- **WHEN** the request is missing or malformed, or `jobId` fails validation
- **THEN** the system classifies the result as an `InvalidArgumentsError`
- **THEN** the API responds with HTTP `400 Bad Request`
- **THEN** the response body is:

```json
{
  "message": "Bad Request"
}
```

#### Scenario: Unrecognized infrastructure faults map to a server error

- **WHEN** the system cannot read the event stream because of an unrecognized storage or runtime failure
- **THEN** the system classifies the result as an `UnrecognizedError`
- **THEN** the API responds with HTTP `500 Internal Server Error`
- **THEN** the response body is:

```json
{
  "message": "Internal Server Error"
}
```

### Requirement: Provide a stable API contract over the HTTP surface

The ListJobEventsApi SHALL expose a single read-style HTTP contract for listing job events, and SHALL not return a non-`200` success status for a valid, non-empty, or empty event stream.

#### Scenario: Successful read returns a success payload

- **WHEN** the request is valid and the job stream is readable
- **THEN** the API returns HTTP `200 OK`
- **THEN** the body contains the `jobId` and a serializable `events` array
- **THEN** it does not return `202 Accepted`, `201 Created`, or an error wrapper for a successful read

#### Scenario: Validation failure is not conflated with server failure

- **WHEN** input validation fails
- **THEN** the response is `400 Bad Request`
- **AND** it is not reported as an internal server failure

- **WHEN** a non-validation failure occurs during retrieval
- **THEN** the response is `500 Internal Server Error`
- **AND** it is not reported as a client request problem

### Requirement: Expose the job-events query endpoint through the public API surface

The ListJobEventsApi SHALL be reachable through the common test-template service HTTP API at `POST /api/v1/test-template-service/listJobEvents` and SHALL return the same JSON contract for every valid request regardless of whether the job has zero or many persisted events.

#### Scenario: Public route is reachable and consistent

- **WHEN** a client calls `POST /api/v1/test-template-service/listJobEvents`
- **THEN** the request enters the API at the public route
- **THEN** the returned payload always follows the same structure:

```json
{
  "jobId": "<jobId>",
  "events": [
    {
      "idempotencyKey": "<idempotencyKey>",
      "eventName": "<eventName>",
      "eventData": {},
      "createdAt": "<ISO-8601 timestamp>"
    }
  ]
}
```

- **THEN** the API returns `200 OK` for valid reads with zero or more events
- **THEN** invalid requests are rejected with `400 Bad Request`
- **THEN** unexpected infrastructure failures are rejected with `500 Internal Server Error`
