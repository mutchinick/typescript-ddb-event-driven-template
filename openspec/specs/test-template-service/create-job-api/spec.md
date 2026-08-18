## Purpose

Allow clients to create a test-template job by submitting a minimal job identifier, validating the request, and persisting an immutable `JOB_CREATED_EVENT` as the authoritative record for the job lifecycle.

## Requirements

### Requirement: Accept valid create-job requests

The system SHALL accept a valid create-job request over the test-template service HTTP API and acknowledge it after the job-created event is accepted for persistence.

#### Scenario: Valid create-job request is accepted

- **WHEN** a client submits a `POST` request to `/api/v1/test-template-service/createJob` with a JSON body containing a valid `jobId` string of at least 6 characters after trimming
- **THEN** the system returns an HTTP `202 Accepted` response
- **THEN** the response body includes the accepted request payload exactly as `{ "jobId": "<jobId>" }`
- **THEN** the system has attempted to persist a `JOB_CREATED_EVENT` for that job identifier

### Requirement: Reject malformed create-job requests

The system SHALL reject malformed or incomplete create-job requests without persisting a job-created event.

#### Scenario: Request body is missing or invalid JSON

- **WHEN** the HTTP request has no body, a `null` body, or a body that is not valid JSON
- **THEN** the system returns an HTTP `400 Bad Request` response
- **THEN** it does not call the service layer to create a job
- **THEN** no `JOB_CREATED_EVENT` is persisted

#### Scenario: Request body is structurally invalid

- **WHEN** the JSON body is present but does not contain a `jobId`, contains a blank `jobId`, or contains a `jobId` shorter than 6 characters after trimming
- **THEN** the system returns an HTTP `400 Bad Request` response
- **THEN** no `JOB_CREATED_EVENT` is persisted

### Requirement: Validate create-job request contract

The system SHALL validate the incoming create-job request using the `IncomingCreateJobRequest` contract, which requires exactly one `jobId` property and applies trimming plus a minimum length rule.

#### Scenario: Request contract accepts valid input

- **WHEN** the system validates `{ "jobId": "job-123" }`
- **THEN** it accepts the value as a valid `IncomingCreateJobRequest`
- **THEN** the stored request object has the same `jobId` value after trimming whitespace only when present

#### Scenario: Request contract rejects invalid input

- **WHEN** the system validates an object where `jobId` is `undefined`, `null`, empty, whitespace-only, or shorter than 6 characters
- **THEN** it returns an `InvalidArgumentsError`
- **THEN** the controller maps that failure to an HTTP `400 Bad Request` response

### Requirement: Persist a job-created event as the source of truth

The system SHALL persist a `JOB_CREATED_EVENT` using the event store whenever a valid create-job request is accepted.

#### Scenario: Valid create-job request creates a persisted event

- **WHEN** the system accepts a valid create-job request for `jobId` `<jobId>`
- **THEN** it builds a `JobCreatedEvent` with `eventName` `JOB_CREATED_EVENT`
- **THEN** it sets `eventData` to `{ "jobId": "<jobId>", "created": true }`
- **THEN** it sets `idempotencyKey` to `jobId:<jobId>`
- **THEN** it sets `createdAt` to the current ISO timestamp string
- **THEN** it calls the event store publish operation with that event

#### Scenario: Event-store write stores the canonical event row

- **WHEN** the event store persists a `JOB_CREATED_EVENT`
- **THEN** it writes a DynamoDB item with `pk` `EVENTS#jobId:<jobId>`
- **THEN** it writes `sk` `EVENTS#JOB_CREATED_EVENT`
- **THEN** it writes `idempotencyKey` `jobId:<jobId>`
- **THEN** it writes `eventName` `JOB_CREATED_EVENT`
- **THEN** it writes `eventData` containing the `jobId` and a literal `created: true` flag
- **THEN** it writes `createdAt` as the ISO timestamp used when the event was created
- **THEN** it writes `_tn` `EVENTS#EVENT`
- **THEN** it writes `_sn` `EVENTS`
- **THEN** it writes `gsi1pk` `EVENTS#EVENT`
- **THEN** it writes `gsi1sk` `CREATED_AT#<createdAt>`
- **THEN** it uses the conditional expression `attribute_not_exists(pk) AND attribute_not_exists(sk)` so the row is created only once for that idempotency key

### Requirement: Treat duplicate event writes as idempotent success

The system SHALL treat a duplicate event-store write for the same `jobId` as successful idempotent processing rather than as a user-visible error.

#### Scenario: Duplicate request for same job id is treated as success

- **GIVEN** a `JOB_CREATED_EVENT` already exists for `pk` `EVENTS#jobId:<jobId>` and `sk` `EVENTS#JOB_CREATED_EVENT`
- **WHEN** a second valid create-job request arrives for the same `jobId`
- **THEN** the event-store publish call receives a conditional-check failure
- **THEN** the event store returns a `DuplicateEventError`
- **THEN** the service layer converts that duplicate-event outcome into a successful service result with the original request payload
- **THEN** the HTTP controller still returns an HTTP `202 Accepted` response
- **THEN** no second `JOB_CREATED_EVENT` row is created

### Requirement: Map create-job failures to HTTP responses

The system SHALL map validation and persistence failures to the appropriate HTTP status codes consistent with the result contract and controller behavior.

#### Scenario: Invalid input maps to bad request

- **WHEN** request parsing fails, `IncomingCreateJobRequest.fromInput` fails, or the service validates that the input is not an `IncomingCreateJobRequest`
- **THEN** the result is a `Failure` with `failureKind` `InvalidArgumentsError`
- **THEN** the controller responds with HTTP `400 Bad Request`
- **THEN** the response body is `{ "message": "Bad Request" }`

#### Scenario: Duplicate event write does not surface as a client error

- **WHEN** the event store reports a duplicate write through `DuplicateEventError`
- **THEN** the service resolves that outcome into a successful service response for the same request
- **THEN** the controller does not return a `400` or `500` error for the duplicate case
- **THEN** the client still receives HTTP `202 Accepted`

#### Scenario: Unrecognized internal failures map to server error

- **WHEN** the system produces any failure other than `InvalidArgumentsError` and not a duplicate-event idempotent success path, such as `UnrecognizedError`
- **THEN** the controller responds with HTTP `500 Internal Server Error`
- **THEN** the response body is `{ "message": "Internal Server Error" }`

### Requirement: Integrate the create-job API with AWS Lambda and API Gateway

The system SHALL expose the create-job capability through an API Gateway HTTP API route backed by a Lambda function that runs the CreateJobApi handler and reads the event-store table from environment configuration.

#### Scenario: Lambda handler is constructed from the event-store client

- **WHEN** the Lambda handler is initialized
- **THEN** it creates a DynamoDB client
- **THEN** it creates a DynamoDB document client from that client
- **THEN** it instantiates `EventStoreClient` with the document client
- **THEN** it instantiates `CreateJobApiService` with that event-store client
- **THEN** it instantiates `CreateJobApiController` with the service
- **THEN** it exports the controller method bound to the `createJob` operation

#### Scenario: Infrastructure registers the route and Lambda integration

- **WHEN** the CDK stack creates the create-job API
- **THEN** it creates a Lambda function named `<id>-CreateJobApi-Lambda` with `NODEJS_20_X` runtime, a log group, and the environment variable `EVENT_STORE_TABLE_NAME`
- **THEN** it grants the function read/write access to the DynamoDB event-store table
- **THEN** it registers an `HTTP POST` integration for `/api/v1/test-template-service/createJob`
- **THEN** it exposes the route on the shared `TestTemplateService` HTTP API with CORS enabled for `POST` and `OPTIONS`

### Requirement: Keep job creation as an event-driven write-only API

The system SHALL create jobs through the event store and SHALL NOT persist a separate non-event job record as part of the create-job API flow.

#### Scenario: Create-job flow has event-store side effect only

- **WHEN** a valid create-job request is accepted
- **THEN** the request is transformed into a `JOB_CREATED_EVENT`
- **THEN** the only persistence side effect is the event-store item described by the `JOB_CREATED_EVENT` schema
- **THEN** no separate job table row is created by the create-job API itself
