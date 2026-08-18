## 1. Contracts and failure model

- [x] 1.1 Extend failure-kind union with DuplicateFinalizedJobError and FinalizedJobWriteError in services/src/errors/FailureKind.ts
- [x] 1.2 Define RecordFinalizedJobWorker service contract to return finalized-job-specific failure kinds from client write operations
- [x] 1.3 Define FinalizedJobRecordClient interface contract with a single write operation and explicit result mapping expectations

## 2. RecordFinalizedJobWorker slice implementation

- [x] 2.1 Create RecordFinalizedJobWorkerController to parse SQS records, reconstitute JOB_FINALIZED_EVENT, and delegate to service
- [x] 2.2 Create RecordFinalizedJobWorkerService to validate input and delegate record persistence to IFinalizedJobRecordClient
- [x] 2.3 Create FinalizedJobRecordClient with explicit DynamoDBDocumentClient dependency and consolidated command build/execute pattern
- [x] 2.4 Implement deterministic base key write shape in client: pk FINALIZED_JOBS#jobId:{jobId}, sk FINALIZED_JOB
- [x] 2.5 Implement existing-GSI attributes in client: gsi1pk FINALIZED_JOBS#BY_DATE, gsi1sk FINALIZED_AT#{isoDate}#JOB_ID#{jobId}
- [x] 2.5.1 Include createdAt and updatedAt attributes in finalized-job record writes
- [x] 2.6 Enforce duplicate protection with conditional put for deterministic base key and map conditional-check failures to DuplicateFinalizedJobError
- [x] 2.7 Map non-duplicate DynamoDB write failures to FinalizedJobWriteError and preserve InvalidArgumentsError for invalid input/build failures
- [x] 2.8 Create worker handler that wires DynamoDBDocumentClient -> FinalizedJobRecordClient -> RecordFinalizedJobWorkerService -> RecordFinalizedJobWorkerController

## 3. Infrastructure wiring

- [x] 3.1 Add RecordFinalizedJobWorkerConstruct with SQS queue, DLQ, Lambda, and SQS event source configuration aligned to existing worker settings
- [x] 3.2 Add EventBridge routing rule in new construct for JOB_FINALIZED_EVENT from the shared event-store table stream
- [x] 3.3 Wire RecordFinalizedJobWorkerConstruct into TestTemplateServiceMainConstruct

## 4. Testing and verification

- [x] 4.1 Add FinalizedJobRecordClient tests for key shape, GSI attribute shape, DuplicateFinalizedJobError mapping, FinalizedJobWriteError mapping, and invalid-input failures
- [x] 4.2 Add RecordFinalizedJobWorkerService tests for input validation and delegation to client
- [x] 4.3 Add RecordFinalizedJobWorkerController tests for SQSEvent/SQSRecord edge cases, event reconstitution flow, and batchItemFailures transient behavior
- [x] 4.4 Add handler export/wiring test for RecordFinalizedJobWorker
- [x] 4.5 Add or update infra construct tests/snapshots for new worker construct and main-construct wiring
- [x] 4.6 Run affected services and infra test suites and confirm all pass
