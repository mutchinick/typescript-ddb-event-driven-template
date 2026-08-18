# Project Architecture Overview

## 1. Purpose and overall design

This repository is a TypeScript template for an AWS-native, event-driven application built around the event sourcing pattern.

The core idea is:

- application state changes are captured as immutable domain events
- those events are persisted in DynamoDB
- DynamoDB Streams forward new writes to EventBridge
- EventBridge rules fan out events to SQS queues
- Lambda workers process queued events and emit follow-up events
- the workflow evolves as a chain of event-driven business steps

This matches the architecture described in [README.md](../README.md), especially the job-processing example for the test-template service.

## 2. Main frameworks and technology stack

### Application and runtime

- TypeScript for all service code and infrastructure code
- Node.js runtime for the Lambda handlers and build tooling
- AWS Lambda for API entry points and workers
- Amazon API Gateway HTTP API for the public REST endpoints
- Amazon DynamoDB as the event store and source of truth
- Amazon EventBridge as the routing backbone
- Amazon SQS as async worker queues
- AWS CDK (TypeScript) for infrastructure-as-code

### Supporting libraries and tooling

- TypeScript 5.6
- Jest for unit testing
- ESLint + Prettier for linting and formatting
- ts-node and ts-jest for TypeScript execution in scripts/tests
- zod for runtime validation and schema enforcement
- AWS SDK v3 clients for DynamoDB and related services

### Infrastructure platform

- CDK app lives in the infra folder
- Stack and construct structure is organized around shared infrastructure and service-specific resources
- Deployment is configured through AWS CDK with an app runner pattern centered on a root stack and nested constructs

## 3. Repository layout

### Root-level structure

- [README.md](../README.md): project overview, architecture explanation, and event flow
- [infra/](../infra): AWS CDK infrastructure definitions
- [services/](../services): TypeScript service code and business logic
- [openspec/](../openspec): local spec and project metadata
- [\_restclient/](../_restclient): HTTP request examples for local/manual testing
- [\_\_local/](../__local): helper scripts and local operational notes

### Service code layout

The application code is in [services/src](../services/src), with a clear separation between shared primitives and a sample domain implementation:

- [services/src/event-store/](../services/src/event-store): the foundational event system
  - EventStoreEvent.ts: abstract domain event contract
  - EventStoreClient.ts: writes events to DynamoDB
  - EventStoreEventBuilder.ts: reconstructs events from EventBridge payloads
  - EventStoreEventName.ts: event name enumeration
  - EventStoreEventData.ts: event data structure definitions

- [services/src/shared/](../services/src/shared): generic utilities and shared response types

- [services/src/test-template-service/](../services/src/test-template-service): example implementation of the event-driven workflow
  - CreateJobApi/
  - ListJobEventsApi/
  - ProcessStepWorker/
  - ExecuteTaskFooWorker/
  - ExecuteTaskQuxWorker/
  - ExecuteTaskBarWorker/
  - CompleteAllTasksWorker/
  - FinalizeJobWorker/
  - events/

### Infrastructure layout

The infrastructure code is in [infra/lib](../infra/lib):

- [infra/lib/common/](../infra/lib/common): reusable plumbing shared across the system
  - DynamoDbConstruct.ts: creates the event-store table and stream
  - EventBusConstruct.ts: creates EventBridge and the DynamoDB-to-EventBridge pipe

- [infra/lib/test-template-service/](../infra/lib/test-template-service): service-specific Lambda + API + worker wiring
  - TestTemplateServiceMainConstruct.ts: root construct for the sample service
  - CreateJobApiLambdaConstruct.ts
  - ListJobEventsApiLambdaConstruct.ts
  - ProcessStepWorkerConstruct.ts
  - ExecuteTaskFooWorkerConstruct.ts
  - ExecuteTaskQuxWorkerConstruct.ts
  - ExecuteTaskBarWorkerConstruct.ts
  - CompleteAllTasksWorkerConstruct.ts
  - FinalizeJobWorkerConstruct.ts
  - TestTemplateServiceApiConstruct.ts

- [infra/lib/MainStack.ts](../infra/lib/MainStack.ts): central stack that wires common infrastructure and the test-service construct together

## 4. Core architecture pattern

### Event sourcing and event flow

The system uses a classic event-sourced serverless workflow:

1. An API endpoint receives a request
2. A Lambda handler persists a domain event into DynamoDB
3. DynamoDB Streams emit the change
4. An EventBridge Pipe forwards the stream record into EventBridge
5. EventBridge rules route the event to the correct SQS queue
6. Worker Lambdas read from SQS and emit the next event in the chain
7. The next event triggers the next workflow step

This is intentionally asynchronous and message-driven, rather than synchronous state mutation in-process.

### Example workflow in this repo

The sample service models a job lifecycle as a sequence of events:

- JobCreatedEvent
- StepProcessedEvent
- TaskFooExecutedEvent
- TaskQuxExecutedEvent
- TaskBarExecutedEvent
- AllTasksCompletedEvent
- JobFinalizedEvent

The README describes the chain clearly: the ProcessStep worker starts the flow, downstream task workers produce their task events, the completion worker aggregates those events, and the finalizer completes the job.

## 5. Key infrastructure decisions

### DynamoDB event store

The event store is modeled as a table with a composite key and a GSI. The shared DynamoDB construct enables:

- partition and sort key modeling
- global secondary index support
- DynamoDB streams enabled with NEW_IMAGE view
- per-request billing mode for serverless scale

This is a strong fit for event sourcing and efficient event history queries.

### EventBridge integration

The shared EventBusConstruct configures:

- an EventBridge event bus
- an IAM role for the EventBridge pipe
- a DynamoDB stream -> EventBridge pipe
- event publication to the bus as a message-driven integration layer

This turns DynamoDB writes into a standard event-routing mechanism without custom code for every stream handler.

### Lambda worker model

The service is split into small, purpose-specific Lambda workers and controllers:

- API handlers manage external entry points
- service classes contain business orchestration logic
- workers act as event consumers / publishers
- each worker is responsible for one step in the workflow

This is a clear modular pattern that matches event-driven systems.

## 6. Development workflow and conventions

The project is organized around two main codebases:

- [services/](../services): domain logic, handlers, workers, and tests
- [infra/](../infra): deployment and AWS resource definitions

Typical local workflow:

- build and test within the services package
- deploy and manage stack resources via the infra package
- use the CDK scripts for bootstrap, synth, deploy, and destroy

The scripts show an opinionated TypeScript + AWS serverless workflow with strong emphasis on monitoring, quality gates, and repeatable deployments.

### Testing conventions and scope

Project-level testing policy is mandatory for every new or modified vertical slice.

- Every new component must include a co-located unit test file named <ComponentName>.test.ts.
- At minimum, each slice change must include tests for controller, service, and handler wiring.
- If a slice adds a purpose-built external client, that client must also have unit tests.
- CDK infrastructure files are excluded from test requirements in this repository.

What to test by layer:

- Controller tests: input parsing, null/undefined and malformed event edge cases, delegation calls, and SQS batchItemFailures behavior for transient failures.
- Service tests: input validation, orchestration and delegation to interfaces, expected success outputs, and failure propagation.
- Client tests: command/key shape, dependency usage, invalid-input failures, duplicate mapping, and non-duplicate external write failure mapping.
- Handler tests: dependency-chain wiring (SDK -> client -> service -> controller) and exported handler behavior.
- Infrastructure tests: not required for CDK files in this repository.

Execution expectations:

- Run affected test suites in services and infra before marking a change complete.
- Run affected services test suites before marking a change complete.
- Do not consider a feature complete when required tests are missing, even if implementation code compiles.

## 7. Data persistence boundaries and slice client rules

This project persists two categories of data in DynamoDB, each with a different contract.

### Event storage (source of truth)

Domain events represent immutable business facts and workflow transitions.

- Domain events must be created through EventStoreEvent classes.
- Domain events must be persisted through EventStoreClient.
- Services that publish events must depend on IEventStoreClient.
- Event persistence must preserve event-sourcing semantics (immutability, idempotency behavior, and event metadata).

### Non-event database records (derived or operational data)

Non-event records represent read models, projections, indexes, or operational tracking data.

- Non-event records must not be written via EventStoreClient.
- Non-event records must be written via purpose-built clients owned by the slice that uses them.
- Slice clients should have a single responsibility and, when possible, a single public operation.
- Services must depend on slice client interfaces, not AWS SDK concrete types.

### Controller-Service-Client contract for non-event persistence

When a slice writes non-event records, it must implement three explicit layers:

- Controller: AWS input and output orchestration.
- Service: business logic and orchestration.
- Client: external persistence operation.

Service constraints:

- Services must not build PutCommand or QueryCommand directly.
- Services must not call ddbDocClient.send directly.
- Services must delegate persistence to injected client interfaces.

Dependency injection constraints:

- DynamoDBDocumentClient must be an explicit dependency of the slice client implementation.
- Handler composition order must be: SDK client, slice client, service, controller.

### Naming convention for non-event record clients

Client names should describe the record domain and client role.

- Preferred class pattern: <DomainSingular>RecordClient.
- Preferred interface pattern: I<DomainSingular>RecordClient.
- Preferred method naming: explicit operation verbs, for example putFinalizedJobRecord.

Example for finalized-job records:

- FinalizedJobRecordClient
- IFinalizedJobRecordClient
- putFinalizedJobRecord

## 8. Architectural summary

Overall, the repository is a serverless, event-driven, TypeScript-first architecture with these defining characteristics:

- event-sourced persistence in DynamoDB
- message propagation through DynamoDB Streams and EventBridge
- decoupled worker processing through SQS + Lambda
- modular service decomposition by workflow step
- AWS CDK as the infrastructure foundation
- testable, pipeline-friendly TypeScript service design

This is a solid template for building workflow automation, domain event applications, and asynchronous state transitions on AWS without introducing a heavy application framework.
