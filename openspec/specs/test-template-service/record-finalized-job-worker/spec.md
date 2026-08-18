## Purpose

Persist a dedicated non-event finalized-job record for each JOB_FINALIZED_EVENT so downstream consumers can query finalized-job tracking data without reconstructing it from the full event stream.

## Requirements

### Requirement: Record finalized-job entry from finalized event

The system SHALL consume JOB_FINALIZED_EVENT messages and write exactly one finalized-job record per jobId using a deterministic base key and date-ordered GSI attributes.

#### Scenario: Valid finalized event writes tracking record

- **WHEN** a worker receives a valid JOB_FINALIZED_EVENT containing a jobId
- **THEN** it writes one non-event DynamoDB item with pk FINALIZED_JOBS#jobId:{jobId}
- **THEN** it writes sk FINALIZED_JOB
- **THEN** it writes gsi1pk FINALIZED_JOBS#BY_DATE
- **THEN** it writes gsi1sk FINALIZED_AT#{isoDate}#JOB_ID#{jobId}, where isoDate is the current ISO timestamp string
- **THEN** it writes createdAt and updatedAt attributes using the current ISO timestamp string

### Requirement: Duplicate finalized-job records are rejected per jobId

The system SHALL reject writes that attempt to create a second finalized-job record for the same jobId.

#### Scenario: Existing finalized-job record is treated as duplicate

- **GIVEN** a finalized-job record already exists for a jobId with base key pk FINALIZED_JOBS#jobId:{jobId} and sk FINALIZED_JOB
- **WHEN** the worker processes another valid JOB_FINALIZED_EVENT for the same jobId
- **THEN** the client returns DuplicateFinalizedJobError
- **THEN** the write operation does not create another base record for that jobId

### Requirement: Finalized-job client maps write failures to domain-specific failure kinds

The system SHALL map finalized-job client write failures to finalized-job-specific failure kinds.

#### Scenario: Duplicate key maps to duplicate finalized-job failure

- **WHEN** DynamoDB responds with a conditional-check failure during finalized-job record write
- **THEN** the client returns DuplicateFinalizedJobError

#### Scenario: Non-duplicate write failure maps to finalized-job write failure

- **WHEN** DynamoDB write fails for reasons other than conditional-check failure
- **THEN** the client returns FinalizedJobWriteError

### Requirement: Non-event persistence must use slice-local client boundary

The system MUST persist finalized-job tracking records through a purpose-built slice-local client interface, and the service layer MUST NOT call AWS SDK document client send operations directly.

#### Scenario: Service delegates write to client abstraction

- **WHEN** the finalized-job worker service handles a valid input event
- **THEN** it invokes a slice-local finalized-job record client interface to persist the record
- **THEN** no direct PutCommand or ddbDocClient.send call is executed in the service

### Requirement: Handler composes explicit client dependency chain

The system SHALL construct the finalized-job record client with an explicit DynamoDBDocumentClient dependency and wire controller, service, and client in the handler.

#### Scenario: Handler wires controller-service-client with explicit doc client

- **WHEN** the worker handler is initialized
- **THEN** it creates DynamoDBDocumentClient
- **THEN** it injects DynamoDBDocumentClient into the finalized-job record client
- **THEN** it injects the client into the service and the service into the controller

### Requirement: Finalized-job slice must include unit tests for all components

The system SHALL include co-located unit tests for each finalized-job slice component to preserve test parity with existing repository conventions.

#### Scenario: New finalized-job components are covered by unit tests

- **WHEN** the RecordFinalizedJobWorker slice is implemented
- **THEN** unit tests exist for FinalizedJobRecordClient
- **THEN** unit tests exist for RecordFinalizedJobWorkerService
- **THEN** unit tests exist for RecordFinalizedJobWorkerController
- **THEN** a handler wiring/export test exists for RecordFinalizedJobWorker
- **THEN** infrastructure wiring is validated through infra tests or snapshots
