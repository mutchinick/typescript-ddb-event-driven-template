# Development Guidelines: TypeScript DynamoDB Event-Driven Template

This comprehensive guide provides everything needed to understand, develop, and maintain the TypeScript DynamoDB Event-Driven Template project. This document consolidates all architectural knowledge, development patterns, testing requirements, and infrastructure guidelines into a single reference.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Understanding Workers and APIs](#understanding-workers-and-apis)
5. [Understanding Slices with Controller-Service-Clients](#understanding-slices-with-controller-service-clients)
6. [Event-Driven Architecture Approach](#event-driven-architecture-approach)
7. [Infrastructure and How It Ties Together](#infrastructure-and-how-it-ties-together)
8. [Key Design Patterns and Principles](#key-design-patterns-and-principles)
9. [Complete Event Flow Example](#complete-event-flow-example)
10. [Adding a New Feature](#adding-a-new-feature)
11. [Creating Domain Events](#creating-domain-events)
12. [Implementing APIs](#implementing-apis)
13. [Implementing Workers](#implementing-workers)
14. [Creating Clients](#creating-clients)
15. [Code Organization](#code-organization)
16. [Error Handling](#error-handling)
17. [Testing Guidelines](#testing-guidelines)
18. [Infrastructure Guidelines](#infrastructure-guidelines)
19. [Best Practices](#best-practices)
20. [Common Pitfalls](#common-pitfalls)
21. [Quick Reference](#quick-reference)

---

## Executive Summary

This project is a **TypeScript template for building event-driven applications on AWS** using:

- **Event Sourcing** pattern with DynamoDB as the event store
- **EventBridge** for event routing
- **SQS + Lambda** for asynchronous worker processing
- **API Gateway + Lambda** for synchronous API endpoints
- **Vertical Slice Architecture** with Controller-Service-Client pattern

### Core Components

**Event Store System:**

- `EventStoreEvent.ts` - Base class for domain events with `fromData()` and `reconstitute()` methods
- `EventStoreClient.ts` - Publishes events to DynamoDB with idempotency checks
- `EventStoreEventBuilder.ts` - Reconstitutes events from EventBridge payloads

**Common Infrastructure:**

- `DynamoDbConstruct.ts` - Event store table with streams enabled
- `EventBusConstruct.ts` - EventBridge setup with DynamoDB pipe

---

## Architecture Overview

### Event-Driven Architecture Flow

```
        ┌─────────────┐
        │ REST Client │
        └──────┬──────┘
               │ HTTP POST
               ▼
┌──────────────────────────────────────────────────────────┐
│                      API LAYER                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ API Gateway v2 → CreateJobApi Lambda Handler       │  │
│  │   └─> CreateJobApiController                       │  │
│  │       └─> CreateJobApiService                      │  │
│  │           └─> EventStoreClient.publish()           │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────┘
                            │
                            │ Store Event
                            ▼
┌──────────────────────────────────────────────────────────┐
│                EVENT STORE (DynamoDB)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Table: Events                                      │  │
│  │ - pk: EVENTS#JOB_CREATED_EVENT                     │  │
│  │ - sk: EVENT#jobId:ABC-123:created:true             │  │
│  │ - eventName, eventData, createdAt, idempotencyKey  │  │
│  │ - Stream: NEW_IMAGE enabled                        │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────┘
                            │
                            │ DynamoDB Stream
                            ▼
┌──────────────────────────────────────────────────────────┐
│              EVENT ROUTING (EventBridge)                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ EventBridge Pipe: DynamoDB Stream → EventBus       │  │
│  │ EventBridge Rule: Filter by eventName              │  │
│  │   └─> Route to SQS Queue                           │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────┘
                            │
                            │ SQS Message
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    WORKER LAYER                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ SQS Queue → ProcessStepWorker Lambda Handler       │  │
│  │   └─> ProcessStepWorkerController                  │  │
│  │       └─> ProcessStepWorkerService                 │  │
│  │           └─> EventStoreClient.publish()           │  │
│  │               (creates STEP_PROCESSED_EVENT)       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

1. **Event Sourcing**: All state changes are stored as immutable events
2. **CQRS-like separation**: APIs write events, Workers process events
3. **Event-Driven**: Components communicate via events, not direct calls
4. **Idempotency**: Events use idempotency keys to prevent duplicates
5. **Vertical Slices**: Each feature is self-contained (API + Worker + Events)

### Event Flow Example

The system supports complex event chains. For example:

```
JOB_CREATED_EVENT → STEP_PROCESSED_EVENT → TASK_FOO_EXECUTED_EVENT
                                         → TASK_QUX_EXECUTED_EVENT
                                         → TASK_BAR_EXECUTED_EVENT
                                         → ALL_TASKS_COMPLETED_EVENT → JOB_FINALIZED_EVENT
```

---

## Project Structure

### Root Level

```
typescript-ddb-event-driven-template/
├── services/          # Lambda function code (business logic)
├── infra/             # AWS CDK infrastructure code
├── _restclient/       # HTTP test files for VSCode REST Client
└── README.md          # Project documentation
```

### Services Directory (`services/src/`)

```
services/src/
├── event-store/                    # Core event system (shared)
│   ├── EventStoreEvent.ts         # Base class for all events
│   ├── EventStoreClient.ts        # Publishes events to DynamoDB
│   ├── EventStoreEventBuilder.ts  # Reconstitutes events from EventBridge
│   ├── EventStoreEventName.ts     # Event name enum
│   └── EventStoreEventData.ts     # Type definitions
│
├── errors/                         # Error handling (shared)
│   ├── Result.ts                  # Success/Failure result type
│   └── FailureKind.ts             # Failure type definitions
│
├── shared/                         # Shared utilities
│   ├── HttpResponse.ts            # HTTP response helpers
│   └── TypeUtils.ts               # Type utilities
│
└── test-template-service/         # Example service implementation
    ├── events/                     # Domain events for this service
    │   ├── JobCreatedEvent.ts
    │   ├── StepProcessedEvent.ts
    │   ├── TaskFooExecutedEvent.ts
    │   ├── TaskQuxExecutedEvent.ts
    │   ├── TaskBarExecutedEvent.ts
    │   ├── AllTasksCompletedEvent.ts
    │   └── JobFinalizedEvent.ts
    │
    ├── CreateJobApi/               # API Vertical Slice
    │   ├── CreateJobApiController/
    │   │   └── CreateJobApiController.ts
    │   ├── CreateJobApiService/
    │   │   └── CreateJobApiService.ts
    │   └── model/
    │       └── IncomingCreateJobRequest.ts
    │
    ├── ListJobEventsApi/           # API Vertical Slice
    │   ├── ListJobEventsApiController/
    │   ├── ListJobEventsApiService/
    │   └── model/
    │
    ├── ProcessStepWorker/          # Worker Vertical Slice
    │   ├── ProcessStepWorkerController/
    │   │   └── ProcessStepWorkerController.ts
    │   └── ProcessStepWorkerService/
    │       └── ProcessStepWorkerService.ts
    │
    ├── ExecuteTaskFooWorker/       # Worker Vertical Slice
    │   ├── ExecuteTaskFooWorkerController/
    │   └── ExecuteTaskFooWorkerService/
    │
    ├── ExecuteTaskQuxWorker/       # Worker Vertical Slice
    │   ├── ExecuteTaskQuxWorkerController/
    │   └── ExecuteTaskQuxWorkerService/
    │
    ├── ExecuteTaskBarWorker/       # Worker Vertical Slice
    │   ├── ExecuteTaskBarWorkerController/
    │   └── ExecuteTaskBarWorkerService/
    │
    ├── CompleteAllTasksWorker/     # Worker Vertical Slice
    │   ├── CompleteAllTasksWorkerController/
    │   └── CompleteAllTasksWorkerService/
    │
    ├── FinalizeJobWorker/           # Worker Vertical Slice
    │   ├── FinalizeJobWorkerController/
    │   ├── FinalizeJobWorkerService/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    ├── CreateJobApi/                 # API Vertical Slice
    │   ├── CreateJobApiController/
    │   ├── CreateJobApiService/
    │   ├── model/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    ├── ListJobEventsApi/             # API Vertical Slice
    │   ├── ListJobEventsApiController/
    │   ├── ListJobEventsApiService/
    │   ├── model/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    ├── ProcessStepWorker/            # Worker Vertical Slice
    │   ├── ProcessStepWorkerController/
    │   ├── ProcessStepWorkerService/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    ├── ExecuteTaskFooWorker/          # Worker Vertical Slice
    │   ├── ExecuteTaskFooWorkerController/
    │   ├── ExecuteTaskFooWorkerService/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    ├── ExecuteTaskQuxWorker/          # Worker Vertical Slice
    │   ├── ExecuteTaskQuxWorkerController/
    │   ├── ExecuteTaskQuxWorkerService/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    ├── ExecuteTaskBarWorker/          # Worker Vertical Slice
    │   ├── ExecuteTaskBarWorkerController/
    │   ├── ExecuteTaskBarWorkerService/
    │   └── handler/                  # Lambda entry point
    │       ├── handler.ts
    │       └── handler.test.ts
    │
    └── CompleteAllTasksWorker/        # Worker Vertical Slice
        ├── CompleteAllTasksWorkerController/
        ├── CompleteAllTasksWorkerService/
        └── handler/                  # Lambda entry point
            ├── handler.ts
            └── handler.test.ts
```

### Infrastructure Directory (`infra/lib/`)

```
infra/lib/
├── common/                         # Shared infrastructure
│   ├── DynamoDbConstruct.ts       # DynamoDB table with streams
│   └── EventBusConstruct.ts       # EventBridge bus + pipe
│
├── test-template-service/          # Service-specific infrastructure
│   ├── TestTemplateServiceMainConstruct.ts    # Orchestrates service infra
│   ├── TestTemplateServiceApiConstruct.ts    # API Gateway setup
│   ├── CreateJobApiLambdaConstruct.ts        # API Lambda + route
│   ├── ListJobEventsApiLambdaConstruct.ts   # API Lambda + route
│   ├── ProcessStepWorkerConstruct.ts         # Worker Lambda + SQS + rule
│   ├── ExecuteTaskFooWorkerConstruct.ts
│   ├── ExecuteTaskQuxWorkerConstruct.ts
│   ├── ExecuteTaskBarWorkerConstruct.ts
│   ├── CompleteAllTasksWorkerConstruct.ts
│   └── FinalizeJobWorkerConstruct.ts
│
├── MainStack.ts                    # Root CDK stack
├── settings.ts                     # Infrastructure settings
└── feature-flags.ts                # Feature toggles
```

---

## Understanding Workers and APIs

### APIs (Synchronous Request-Response)

**Purpose**: Handle HTTP requests from clients, validate input, and publish events.

**Flow**:

1. Client sends HTTP request → API Gateway
2. API Gateway routes to Lambda handler
3. Handler creates Controller → Service → Client chain
4. Service publishes event to DynamoDB via EventStoreClient
5. Returns HTTP response (202 Accepted typically)

**Example: CreateJobApi**

```typescript
// Handler (entry point)
CreateJobApi/handler/handler.ts
  └─> CreateJobApiController.createJob()
      └─> CreateJobApiService.createJob()
          └─> EventStoreClient.publish(JobCreatedEvent)
```

**Characteristics**:

- Fast response times (typically < 1 second)
- Returns immediately after event is stored
- Uses API Gateway v2 (HTTP API)
- Timeout: 29 seconds (API Gateway limit)

### Workers (Asynchronous Event Processing)

**Purpose**: Process events from the event store, perform business logic, and optionally publish new events.

**Flow**:

1. Event stored in DynamoDB → Triggers DynamoDB Stream
2. EventBridge Pipe forwards to EventBridge Bus
3. EventBridge Rule filters and routes to SQS Queue
4. Lambda polls SQS, processes batch of messages
5. Worker reconstitutes event, processes it, may publish new events

**Example: ProcessStepWorker**

```typescript
// Handler (entry point)
ProcessStepWorker/handler/handler.ts
  └─> ProcessStepWorkerController.processSteps()
      └─> EventStoreEventBuilder.fromEventBridge()  // Reconstitute event
          └─> ProcessStepWorkerService.processStep()
              └─> EventStoreClient.publish(StepProcessedEvent)
```

**Characteristics**:

- Asynchronous processing (can take longer)
- Batch processing from SQS (up to 10 messages)
- Dead Letter Queue for failed messages
- Retry logic via SQS visibility timeout
- Timeout: 60 seconds (configurable)

---

## Understanding Slices with Controller-Service-Clients

### Vertical Slice Architecture

Each feature is organized as a **self-contained vertical slice** containing:

- **Controller**: Handles AWS-specific input/output (API Gateway events, SQS events)
- **Service**: Contains business logic (domain rules, orchestration)
- **Clients**: External dependencies (EventStoreClient, database clients, etc.)
- **Models**: Request/response/data structures owned by the slice

### Controller Layer

**Responsibility**:

- Parse AWS Lambda event formats (APIGatewayProxyEventV2, SQSEvent)
- Validate and transform input
- Call Service layer
- Transform Service output to AWS response format
- Handle error mapping (business errors → HTTP status codes)

**Example: CreateJobApiController**

```typescript
class CreateJobApiController {
  async createJob(apiEvent: APIGatewayProxyEventV2) {
    // 1. Parse JSON body
    // 2. Validate input using model
    // 3. Call service
    // 4. Map result to HTTP response
    return HttpResponse.Accepted(output);
  }
}
```

**Example: ProcessStepWorkerController**

```typescript
class ProcessStepWorkerController {
  async processSteps(sqsEvent: SQSEvent) {
    // 1. Iterate SQS records
    // 2. Parse JSON body
    // 3. Reconstitute event using EventStoreEventBuilder
    // 4. Call service
    // 5. Return batch response (for retries)
    return { batchItemFailures: [...] }
  }
}
```

### Service Layer

**Responsibility**:

- Implement business logic
- Orchestrate domain operations
- Use Clients to interact with external systems
- Publish domain events via EventStoreClient
- Return Result<T> (Success or Failure)

**Example: CreateJobApiService**

```typescript
class CreateJobApiService {
  async createJob(request: IncomingCreateJobRequest) {
    // 1. Validate input
    // 2. Build domain event
    // 3. Publish event via EventStoreClient
    // 4. Return result
    const event = JobCreatedEvent.fromData({ jobId, created: true });
    return await this.eventStoreClient.publish(event);
  }
}
```

**Example: ProcessStepWorkerService**

```typescript
class ProcessStepWorkerService {
  async processStep(event: JobCreatedEvent) {
    // 1. Validate input
    // 2. Perform business logic (e.g., process job step)
    // 3. Publish new event (STEP_PROCESSED_EVENT)
    // 4. Return result
    const newEvent = StepProcessedEvent.fromData({ jobId, processed: true });
    return await this.eventStoreClient.publish(newEvent);
  }
}
```

### Client Layer

**Clients** are dependencies injected into Services:

- **EventStoreClient**: Publishes events to DynamoDB
- **Custom Clients**: For external systems (databases, APIs, etc.)

**Interface Pattern**: Services depend on interfaces (e.g., `IEventStoreClient`), not concrete implementations, enabling testing and flexibility.

---

## Event-Driven Architecture Approach

### Event Sourcing Pattern

**Core Principle**: Store all state changes as a sequence of immutable events.

**Benefits**:

- Complete audit trail
- Time travel (replay events to any point in time)
- Decoupled components (no direct dependencies)
- Scalability (events can be processed independently)

### Event Lifecycle

1. **Event Creation** (`fromData`):

   ```typescript
   const event = JobCreatedEvent.fromData({ jobId: "ABC-123", created: true });
   // Generates: idempotencyKey, createdAt, validates data
   ```

2. **Event Storage**:

   ```typescript
   await eventStoreClient.publish(event);
   // Stores in DynamoDB with idempotency check
   ```

3. **Event Streaming**:

   - DynamoDB Stream captures NEW_IMAGE
   - EventBridge Pipe forwards to EventBridge Bus

4. **Event Routing**:

   - EventBridge Rule filters by `eventName`
   - Routes matching events to SQS Queue

5. **Event Processing**:

   ```typescript
   const event = EventStoreEventBuilder.fromEventBridge(
     eventClassMap,
     incomingEvent
   );
   // Reconstitutes event from EventBridge payload
   ```

6. **Event Continuation**:
   - Worker processes event
   - May publish new events (creating event chains)

### Event Structure

```typescript
class EventStoreEvent<TEventData> {
  idempotencyKey: string; // Prevents duplicates
  eventName: string; // e.g., "JOB_CREATED_EVENT"
  eventData: TEventData; // Domain-specific data
  createdAt: string; // ISO timestamp
}
```

### Idempotency

Events use **idempotency keys** to prevent duplicate processing:

- Format: `jobId:ABC-123:created:true`
- DynamoDB condition: `attribute_not_exists(pk) AND attribute_not_exists(sk)`
- Duplicate events return `DuplicateEventError` (non-fatal)

---

## Infrastructure and How It Ties Together

### Infrastructure Hierarchy

```
MainStack (Root)
├── Common Infrastructure
│   ├── DynamoDbConstruct
│   │   └── Table with streams, GSI
│   └── EventBusConstruct
│       └── EventBus + EventBridge Pipe (DynamoDB → EventBus)
│
└── Service Infrastructure (TestTemplateService)
    ├── TestTemplateServiceApiConstruct
    │   └── HTTP API (API Gateway v2)
    │
    ├── CreateJobApiLambdaConstruct
    │   ├── Lambda Function
    │   ├── API Gateway Route
    │   └── DynamoDB Permissions
    │
    └── ProcessStepWorkerConstruct
        ├── SQS Queue + DLQ
        ├── Lambda Function (SQS trigger)
        ├── EventBridge Rule (filters events)
        └── DynamoDB Permissions
```

### How Infrastructure Ties to Services

#### 1. **API Infrastructure → API Handler**

```typescript
// infra/lib/test-template-service/CreateJobApiLambdaConstruct.ts
new NodejsFunction({
  entry: "services/src/test-template-service/CreateJobApi/handler/handler.ts",
  handler: "handler",
  environment: {
    EVENT_STORE_TABLE_NAME: dynamoDbTable.tableName,
  },
});

// infra/lib/test-template-service/CreateJobApiLambdaConstruct.ts
httpApi.addRoutes({
  path: "/api/v1/test-template-service/createJob",
  methods: [HttpMethod.POST],
  integration: lambdaIntegration,
});
```

**Connection**: API Gateway route → Lambda handler → Controller → Service → EventStoreClient

#### 2. **Worker Infrastructure → Worker Handler**

```typescript
// infra/lib/test-template-service/ProcessStepWorkerConstruct.ts
new NodejsFunction({
  entry:
    "services/src/test-template-service/ProcessStepWorker/handler/handler.ts",
  handler: "handler",
  environment: {
    EVENT_STORE_TABLE_NAME: dynamoDbTable.tableName,
  },
});

lambdaFunc.addEventSource(
  new SqsEventSource(queue, {
    batchSize: 10,
    reportBatchItemFailures: true,
  })
);

// EventBridge Rule routes events to SQS
new Rule({
  eventPattern: {
    detail: {
      dynamodb: {
        NewImage: {
          eventName: { S: ["JOB_CREATED_EVENT"] },
        },
      },
    },
  },
}).addTarget(new SqsQueue(queue));
```

**Connection**: DynamoDB Stream → EventBridge Pipe → EventBridge Bus → EventBridge Rule → SQS Queue → Lambda handler → Controller → Service → EventStoreClient

#### 3. **Event Store Infrastructure**

```typescript
// infra/lib/common/DynamoDbConstruct.ts
new Table({
  partitionKey: { name: "pk", type: STRING },
  sortKey: { name: "sk", type: STRING },
  stream: StreamViewType.NEW_IMAGE, // Enables DynamoDB Streams
});

// infra/lib/common/EventBusConstruct.ts
new CfnPipe({
  source: dynamoDbTable.tableStreamArn,
  target: eventBus.eventBusArn,
  // Transforms DynamoDB stream records to EventBridge events
});
```

**Connection**: EventStoreClient writes to DynamoDB → DynamoDB Stream → EventBridge Pipe → EventBridge Bus

### Environment Variables

All Lambda functions receive:

- `EVENT_STORE_TABLE_NAME`: DynamoDB table name for event storage

### Permissions (IAM)

- **API Lambdas**: `dynamoDbTable.grantReadWriteData(lambdaFunc)`
- **Worker Lambdas**: `dynamoDbTable.grantReadWriteData(lambdaFunc)` + `queue.grantConsumeMessages(lambdaFunc)`
- **EventBridge Pipe Role**: `dynamoDbTable.grantStreamRead(role)` + `eventBus.grantPutEventsTo(role)`

---

## Key Design Patterns and Principles

### 1. **Result Pattern** (Functional Error Handling)

Instead of throwing exceptions, methods return `Result<T>`:

```typescript
type Result<T> = Success<T> | Failure<FailureKind>;

// Usage
const result = await service.createJob(request);
if (Result.isSuccess(result)) {
  return HttpResponse.Accepted(result.value);
} else {
  return HttpResponse.BadRequestError();
}
```

**Benefits**:

- Explicit error handling
- Type-safe error types
- Transient vs non-transient failures
- No hidden exceptions

### 2. **Dependency Injection**

Handlers create dependency chains:

```typescript
function createHandler() {
  const ddbClient = new DynamoDBClient({});
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
  const eventStoreClient = new EventStoreClient(ddbDocClient);
  const service = new CreateJobApiService(eventStoreClient);
  const controller = new CreateJobApiController(service);
  return controller.createJob.bind(controller);
}
```

**Benefits**:

- Testable (can mock dependencies)
- Clear dependency graph
- Easy to swap implementations

### 3. **Interface Segregation**

Services depend on interfaces:

```typescript
interface IEventStoreClient {
  publish(event: EventStoreEvent): Promise<Result<void>>;
}

class CreateJobApiService {
  constructor(private readonly eventStoreClient: IEventStoreClient) {}
}
```

**Benefits**:

- Loose coupling
- Easy to mock in tests
- Can swap implementations

### 4. **Event Factory Pattern**

Events have two factory methods:

- `fromData()`: Creates new event from domain data
- `reconstitute()`: Rebuilds event from stored data (used by EventStoreEventBuilder)

### 5. **Validation with Zod**

All inputs validated using Zod schemas:

```typescript
const dataSchema = z.object({
  jobId: z.string().trim().min(6),
  created: z.literal(true),
});
```

### 6. **Consolidated Execution Pattern**

This is a preferred pattern for clients that make calls to external resources (external APIs, AWS SDK clients, databases, etc.). When it makes sense and is possible, consolidate request/command building and execution into a single method with the required number of try-catch blocks to isolate different actions and errors.

The number of try-catch blocks depends on the distinct operations that can fail independently. For example, in this DynamoDB client, we use two try-catch blocks because we need to isolate:

1. **Command construction** (can fail due to invalid arguments or missing environment variables)
2. **Command execution and response processing** (can fail due to network errors, DynamoDB errors, or missing data)

```typescript
private async executeDdbGetUserId(input: Input): Promise<Result<Output>> {
  const logCtx = "Client.executeDdbGetUserId";

  // First try-catch: Build request/command
  let command: GetCommand;
  try {
    command = new GetCommand({ /* ... */ });
  } catch (error) {
    return Result.makeFailure("InvalidArgumentsError", error, false);
  }

  // Second try-catch: Execute request and process response
  try {
    const response = await this.ddbDocClient.send(command);
    return Result.makeSuccess(processResponse(response));
  } catch (error) {
    return Result.makeFailure("UnrecognizedError", error, true);
  }
}
```

**Benefits**:

- Reduces indirection (no separate build/send methods)
- Maintains error handling granularity (isolates distinct operations with separate try-catch blocks)
- Clearer intent (single method describes the full operation)
- Less boilerplate (no intermediate Result unwrapping)
- Better cohesion (related operations are together while maintaining error isolation)

**Note**: This pattern is used in `EventStoreClient` (DynamoDB client) and should be applied to all clients making external calls when it makes sense. Examples include DynamoDB clients, external API clients (Axios, fetch), S3 clients, and other AWS SDK clients. The number of try-catch blocks should be determined by the distinct operations that need separate error handling.

---

## Complete Event Flow Example

### Scenario: Create a Job

1. **Client Request**:

   ```http
   POST /api/v1/test-template-service/createJob
   { "jobId": "ABC-123" }
   ```

2. **API Handler** (`CreateJobApi/handler/handler.ts`):

   - Creates Controller → Service → EventStoreClient chain
   - Calls `controller.createJob(apiEvent)`

3. **Controller** (`CreateJobApiController`):

   - Parses JSON body
   - Validates using `IncomingCreateJobRequest.fromInput()`
   - Calls `service.createJob(request)`

4. **Service** (`CreateJobApiService`):

   - Builds `JobCreatedEvent.fromData({ jobId: "ABC-123", created: true })`
   - Calls `eventStoreClient.publish(event)`

5. **EventStoreClient**:

   - Validates event
   - Executes DynamoDB PutCommand (builds and sends in consolidated `executeDdbPublishEvent` method)
   - Uses idempotency check to prevent duplicates
   - Stores in DynamoDB:
     ```
     pk: EVENTS#JOB_CREATED_EVENT
     sk: EVENT#jobId:ABC-123:created:true
     eventName: JOB_CREATED_EVENT
     eventData: { jobId: "ABC-123", created: true }
     createdAt: "2024-01-01T12:00:00Z"
     ```

6. **DynamoDB Stream**:

   - Captures NEW_IMAGE record
   - Forwards to EventBridge Pipe

7. **EventBridge Pipe**:

   - Transforms DynamoDB stream record to EventBridge event
   - Publishes to EventBridge Bus

8. **EventBridge Rule**:

   - Matches events where `eventName = "JOB_CREATED_EVENT"`
   - Routes to SQS Queue

9. **SQS Queue**:

   - Receives message with EventBridge event payload
   - Lambda polls queue (batch of up to 10 messages)

10. **Worker Handler** (`ProcessStepWorker/handler/handler.ts`):

    - Creates Controller → Service → EventStoreClient chain
    - Calls `controller.processSteps(sqsEvent)`

11. **Worker Controller** (`ProcessStepWorkerController`):

    - Iterates SQS records
    - Parses JSON body (EventBridge event)
    - Calls `EventStoreEventBuilder.fromEventBridge()` to reconstitute `JobCreatedEvent`
    - Calls `service.processStep(event)`

12. **Worker Service** (`ProcessStepWorkerService`):

    - Processes the job step (business logic)
    - Builds `StepProcessedEvent.fromData({ jobId: "ABC-123", processed: true })`
    - Calls `eventStoreClient.publish(newEvent)`

13. **Cycle Continues**:
    - `STEP_PROCESSED_EVENT` stored in DynamoDB
    - Triggers another DynamoDB Stream event
    - Can be routed to another worker (if rule exists)

---

## Adding a New Feature

When adding a new feature (e.g., "Cancel Job"), you typically need:

1. **Domain Event** (if creating new state)
2. **API Slice** (if exposing HTTP endpoint)
3. **Worker Slice** (if processing events asynchronously)
4. **Infrastructure** (Lambda, routes, rules, queues)
5. **Tests** (MANDATORY - see below)

### ⚠️ CRITICAL: Testing Requirement

**MANDATORY**: You MUST create comprehensive test files for ALL components when developing a new feature. This is not optional.

**For every component created, you must create a corresponding test file:**

- ✅ Every Event class → `{EventName}.test.ts`
- ✅ Every Controller class → `{ControllerName}.test.ts`
- ✅ Every Service class → `{ServiceName}.test.ts`
- ✅ Every Handler file → `{handlerName}.test.ts`
- ✅ Every Client class → `{ClientName}.test.ts` (if applicable)

**Test files must:**

- Be co-located with the component being tested
- Follow the naming pattern `{ComponentName}.test.ts`
- Follow the testing patterns documented in the [Testing Guidelines](#testing-guidelines) section
- Cover edge cases, internal logic, and expected results

**DO NOT** mark a feature as complete without creating all corresponding test files.

### Feature Implementation Checklist

When adding a new feature, follow these checklists in order. See [Quick Reference Checklists](#checklists) section below for detailed item-by-item checklists.

**High-Level Steps:**

1. **Event (if needed)**

   - [ ] Create event class following [Event Creation Checklist](#event-creation-checklist)
   - [ ] Add event name to `EventStoreEventName` enum

2. **API Slice (if needed)**

   - [ ] Create API slice following [API Implementation Checklist](#api-implementation-checklist)
   - [ ] Create infrastructure following [API Infrastructure Checklist](#infrastructure-checklist)

3. **Worker Slice (if needed)**

   - [ ] Create Worker slice following [Worker Implementation Checklist](#worker-implementation-checklist)
   - [ ] Create infrastructure following [Worker Infrastructure Checklist](#infrastructure-checklist)

4. **Final Steps**
   - [ ] Wire up infrastructure in service main construct
   - [ ] Update documentation
   - [ ] Verify all tests pass

---

## Creating Domain Events

### Event Structure

All events must:

1. Extend `EventStoreEvent<TEventData>`
2. Implement `fromData()` static method
3. Implement `reconstitute()` static method
4. Define a unique `eventName` constant
5. Use Zod for validation

### Event Template

```typescript
import { z } from "zod";
import { Failure, Result, Success } from "../../errors/Result";
import {
  EventStoreEvent,
  EventStoreEventConstructor,
} from "../../event-store/EventStoreEvent";
import { EventStoreEventName } from "../../event-store/EventStoreEventName";

// 1. Define data schema
const dataSchema = z.object({
  jobId: z.string().trim().min(6),
  cancelled: z.literal(true),
});

export type JobCancelledEventData = z.infer<typeof dataSchema>;

// 2. Define event schema (for reconstitution)
const eventSchema = z.object({
  eventData: dataSchema,
  idempotencyKey: z.string().trim().min(6),
  createdAt: z.string().datetime(),
});

// 3. Create event class
export class JobCancelledEvent extends EventStoreEvent<JobCancelledEventData> {
  public static readonly eventName = EventStoreEventName.JOB_CANCELLED_EVENT;

  private constructor(
    eventData: JobCancelledEventData,
    idempotencyKey: string,
    createdAt: string
  ) {
    super(JobCancelledEvent.eventName, eventData, idempotencyKey, createdAt);
  }

  // 4. Implement fromData (creates new event)
  static fromData(
    eventData: JobCancelledEventData
  ): Success<JobCancelledEvent> | Failure<"InvalidArgumentsError"> {
    const logCtx = "JobCancelledEvent.fromData";

    try {
      const validData = dataSchema.parse(eventData);
      const idempotencyKey = this.generateIdempotencyKey(validData);
      const event = new JobCancelledEvent(
        validData,
        idempotencyKey,
        new Date().toISOString()
      );
      return Result.makeSuccess(event);
    } catch (error) {
      return Result.makeFailure("InvalidArgumentsError", error, false);
    }
  }

  // 5. Generate idempotency key
  private static generateIdempotencyKey(
    eventData: JobCancelledEventData
  ): string {
    return `jobId:${eventData.jobId}:cancelled:${eventData.cancelled}`;
  }

  // 6. Implement reconstitute (rebuilds from stored data)
  static reconstitute(
    eventData: JobCancelledEventData,
    idempotencyKey: string,
    createdAt: string
  ): Success<JobCancelledEvent> | Failure<"InvalidArgumentsError"> {
    const logCtx = "JobCancelledEvent.reconstitute";

    try {
      const validEvent = eventSchema.parse({
        eventData,
        idempotencyKey,
        createdAt,
      });
      const event = new JobCancelledEvent(
        validEvent.eventData,
        idempotencyKey,
        createdAt
      );
      return Result.makeSuccess(event);
    } catch (error) {
      return Result.makeFailure("InvalidArgumentsError", error, false);
    }
  }
}

// 7. Type check (ensures contract compliance)
const _ConstructorCheck: EventStoreEventConstructor = JobCancelledEvent;
```

### Event Naming Conventions

- **Event Names**: `UPPER_SNAKE_CASE` (e.g., `JOB_CANCELLED_EVENT`)
- **Event Classes**: `PascalCase` (e.g., `JobCancelledEvent`)
- **Event Data Types**: `PascalCase` + `Data` (e.g., `JobCancelledEventData`)

### Idempotency Key Guidelines

- **Format**: `{entityType}:{entityId}:{action}:{value}`
- **Example**: `jobId:ABC-123:cancelled:true`
- **Purpose**: Prevents duplicate event processing
- **Uniqueness**: Must be unique per event instance

### Adding Event Name to Enum

```typescript
// services/src/event-store/EventStoreEventName.ts
export enum EventStoreEventName {
  JOB_CREATED_EVENT = "JOB_CREATED_EVENT",
  STEP_PROCESSED_EVENT = "STEP_PROCESSED_EVENT",
  JOB_CANCELLED_EVENT = "JOB_CANCELLED_EVENT", // Add here
}
```

---

## Implementing APIs

### API Slice Structure

```
<ServiceName>Api/
├── <ServiceName>ApiController/
│   └── <ServiceName>ApiController.ts
├── <ServiceName>ApiService/
│   └── <ServiceName>ApiService.ts
└── model/
    └── Incoming<ServiceName>Request.ts
```

### Controller Guidelines

**Responsibilities**:

- Parse AWS API Gateway event
- Validate input using model
- Call service
- Map result to HTTP response
- Handle error mapping

**Template**:

```typescript
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { Failure, Result, Success } from "../../../errors/Result";
import { HttpResponse } from "../../../shared/HttpResponse";
import { ICancelJobApiService } from "../CancelJobApiService/CancelJobApiService";
import { IncomingCancelJobRequest } from "../model/IncomingCancelJobRequest";

export interface ICancelJobApiController {
  cancelJob: (
    apiEvent: APIGatewayProxyEventV2
  ) => Promise<APIGatewayProxyStructuredResultV2>;
}

export class CancelJobApiController implements ICancelJobApiController {
  constructor(private readonly cancelJobApiService: ICancelJobApiService) {}

  public async cancelJob(
    apiEvent: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyStructuredResultV2> {
    const logCtx = "CancelJobApiController.cancelJob";
    console.info(`${logCtx} init:`, { apiEvent });

    const cancelJobResult = await this.cancelJobSafe(apiEvent);
    if (Result.isSuccess(cancelJobResult)) {
      return HttpResponse.Accepted(cancelJobResult.value);
    }

    if (Result.isFailureOfKind(cancelJobResult, "InvalidArgumentsError")) {
      return HttpResponse.BadRequestError();
    }

    return HttpResponse.InternalServerError();
  }

  private async cancelJobSafe(
    apiEvent: APIGatewayProxyEventV2
  ): Promise<
    Success<IncomingCancelJobRequest> | Failure<"InvalidArgumentsError">
  > {
    // Parse and validate input
    const parseResult = this.parseInputRequest(apiEvent);
    if (Result.isFailure(parseResult)) {
      return parseResult;
    }

    const unverifiedRequest = parseResult.value as unknown;
    const requestResult = IncomingCancelJobRequest.fromInput(unverifiedRequest);
    if (Result.isFailure(requestResult)) {
      return requestResult;
    }

    // Call service
    const serviceResult = await this.cancelJobApiService.cancelJob(
      requestResult.value
    );
    return serviceResult;
  }

  private parseInputRequest(
    apiEvent: APIGatewayProxyEventV2
  ): Success<unknown> | Failure<"InvalidArgumentsError"> {
    try {
      return Result.makeSuccess(JSON.parse(apiEvent.body!));
    } catch (error) {
      return Result.makeFailure("InvalidArgumentsError", error, false);
    }
  }
}
```

### Service Guidelines

**Responsibilities**:

- Implement business logic
- Validate input
- Build domain events
- Publish events via EventStoreClient
- Return Result<T>

**Template**:

```typescript
import { Failure, Result, Success } from "../../../errors/Result";
import { IEventStoreClient } from "../../../event-store/EventStoreClient";
import {
  JobCancelledEvent,
  JobCancelledEventData,
} from "../../events/JobCancelledEvent";
import { IncomingCancelJobRequest } from "../model/IncomingCancelJobRequest";

export interface ICancelJobApiService {
  cancelJob: (
    request: IncomingCancelJobRequest
  ) => Promise<
    Success<CancelJobApiServiceOutput> | Failure<"InvalidArgumentsError">
  >;
}

export type CancelJobApiServiceOutput = {
  jobId: string;
};

export class CancelJobApiService implements ICancelJobApiService {
  constructor(private readonly eventStoreClient: IEventStoreClient) {}

  public async cancelJob(
    request: IncomingCancelJobRequest
  ): Promise<
    Success<CancelJobApiServiceOutput> | Failure<"InvalidArgumentsError">
  > {
    const logCtx = "CancelJobApiService.cancelJob";
    console.info(`${logCtx} init:`, { request });

    // Validate input
    const validationResult = this.validateInput(request);
    if (Result.isFailure(validationResult)) {
      return validationResult;
    }

    // Build and publish event
    const eventData: JobCancelledEventData = {
      jobId: request.jobId,
      cancelled: true,
    };
    const eventResult = JobCancelledEvent.fromData(eventData);
    if (Result.isFailure(eventResult)) {
      return eventResult;
    }

    const publishResult = await this.eventStoreClient.publish(
      eventResult.value
    );
    if (Result.isFailure(publishResult)) {
      return publishResult;
    }

    // Return success
    return Result.makeSuccess({ jobId: request.jobId });
  }

  private validateInput(
    request: IncomingCancelJobRequest
  ): Success<void> | Failure<"InvalidArgumentsError"> {
    if (request instanceof IncomingCancelJobRequest === false) {
      return Result.makeFailure(
        "InvalidArgumentsError",
        "Expected IncomingCancelJobRequest",
        false
      );
    }
    return Result.makeSuccess();
  }
}
```

### Model Guidelines

**Responsibilities**:

- Validate incoming request data
- Use Zod for schema validation
- Provide type-safe request object

**Template**:

```typescript
import { z } from "zod";
import { Failure, Result, Success } from "../../../errors/Result";

export type IncomingCancelJobRequestInput = {
  jobId: string;
};

type IncomingCancelJobRequestProps = {
  jobId: string;
};

export class IncomingCancelJobRequest implements IncomingCancelJobRequestProps {
  private constructor(public readonly jobId: string) {}

  public static fromInput(
    input: IncomingCancelJobRequestInput
  ): Success<IncomingCancelJobRequest> | Failure<"InvalidArgumentsError"> {
    const schema = z.object({
      jobId: z.string().trim().min(6),
    });

    try {
      const validInput = schema.parse(input);
      return Result.makeSuccess(new IncomingCancelJobRequest(validInput.jobId));
    } catch (error) {
      return Result.makeFailure("InvalidArgumentsError", error, false);
    }
  }
}
```

### Handler Guidelines

**Responsibilities**:

- Create dependency chain
- Wire up Controller → Service → Clients
- Export handler function

**Template**:

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { EventStoreClient } from "../../event-store/EventStoreClient";
import { CancelJobApiController } from "../CancelJobApi/CancelJobApiController/CancelJobApiController";
import { CancelJobApiService } from "../CancelJobApi/CancelJobApiService/CancelJobApiService";

function createHandler(): (
  apiEvent: APIGatewayProxyEventV2
) => Promise<APIGatewayProxyStructuredResultV2> {
  const ddbClient = new DynamoDBClient({});
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
  const eventStoreClient = new EventStoreClient(ddbDocClient);
  const cancelJobApiService = new CancelJobApiService(eventStoreClient);
  const cancelJobApiController = new CancelJobApiController(
    cancelJobApiService
  );
  return cancelJobApiController.cancelJob.bind(cancelJobApiController);
}

export const handler = createHandler();
```

---

## Implementing Workers

### Worker Slice Structure

```
<ServiceName>Worker/
├── <ServiceName>WorkerController/
│   └── <ServiceName>WorkerController.ts
└── <ServiceName>WorkerService/
    └── <ServiceName>WorkerService.ts
```

### Worker Controller Guidelines

**Responsibilities**:

- Parse SQS event
- Iterate SQS records
- Reconstitute events using EventStoreEventBuilder
- Call service for each record
- Return batch response (for retries)

**Template**:

```typescript
import { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { Failure, Result, Success } from "../../../errors/Result";
import {
  EventClassMap,
  EventStoreEventBuilder,
  IncomingEventBridgeEvent,
} from "../../../event-store/EventStoreEventBuilder";
import { EventStoreEventName } from "../../../event-store/EventStoreEventName";
import { JobCancelledEvent } from "../../events/JobCancelledEvent";
import { ICancelJobWorkerService } from "../CancelJobWorkerService/CancelJobWorkerService";

const validEventsMap: EventClassMap = {
  [EventStoreEventName.JOB_CANCELLED_EVENT]: JobCancelledEvent,
};

export interface ICancelJobWorkerController {
  cancelJob: (sqsEvent: SQSEvent) => Promise<SQSBatchResponse>;
}

export class CancelJobWorkerController implements ICancelJobWorkerController {
  constructor(
    private readonly cancelJobWorkerService: ICancelJobWorkerService
  ) {}

  public async cancelJob(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const logCtx = "CancelJobWorkerController.cancelJob";
    console.info(`${logCtx} init:`, { sqsEvent });

    const batchResponse: SQSBatchResponse = { batchItemFailures: [] };

    if (!sqsEvent?.Records) {
      return batchResponse;
    }

    for (const record of sqsEvent.Records) {
      const processResult = await this.processRecordSafe(record);
      // Only retry transient failures
      if (Result.isFailureTransient(processResult)) {
        batchResponse.batchItemFailures.push({
          itemIdentifier: record.messageId,
        });
      }
    }

    return batchResponse;
  }

  private async processRecordSafe(
    record: SQSRecord
  ): Promise<Success<void> | Failure<"InvalidArgumentsError">> {
    // Parse SQS record body
    const parseResult = this.parseInputEvent(record);
    if (Result.isFailure(parseResult)) {
      return parseResult;
    }

    // Reconstitute event from EventBridge payload
    const unverifiedEvent = parseResult.value as IncomingEventBridgeEvent;
    const eventResult = EventStoreEventBuilder.fromEventBridge(
      validEventsMap,
      unverifiedEvent
    );
    if (Result.isFailure(eventResult)) {
      return eventResult;
    }

    // Type check and call service
    const event = eventResult.value;
    if (event instanceof JobCancelledEvent === false) {
      return Result.makeFailure(
        "InvalidArgumentsError",
        "Expected JobCancelledEvent",
        false
      );
    }

    return await this.cancelJobWorkerService.cancelJob(event);
  }

  private parseInputEvent(
    record: SQSRecord
  ): Success<unknown> | Failure<"InvalidArgumentsError"> {
    try {
      return Result.makeSuccess(JSON.parse(record.body));
    } catch (error) {
      return Result.makeFailure("InvalidArgumentsError", error, false);
    }
  }
}
```

### Worker Service Guidelines

**Responsibilities**:

- Implement business logic
- Validate input event
- Optionally publish new events
- Return Result<T>

**Template**:

```typescript
import { Failure, Result, Success } from "../../../errors/Result";
import { IEventStoreClient } from "../../../event-store/EventStoreClient";
import { JobCancelledEvent } from "../../events/JobCancelledEvent";

export interface ICancelJobWorkerService {
  cancelJob: (
    event: JobCancelledEvent
  ) => Promise<Success<void> | Failure<"InvalidArgumentsError">>;
}

export class CancelJobWorkerService implements ICancelJobWorkerService {
  constructor(private readonly eventStoreClient: IEventStoreClient) {}

  public async cancelJob(
    event: JobCancelledEvent
  ): Promise<Success<void> | Failure<"InvalidArgumentsError">> {
    const logCtx = "CancelJobWorkerService.cancelJob";
    console.info(`${logCtx} init:`, { event });

    // Validate input
    const validationResult = this.validateInput(event);
    if (Result.isFailure(validationResult)) {
      return validationResult;
    }

    // Perform business logic (e.g., update database, call external API)
    // ...

    // Optionally publish new event
    // const newEvent = SomeOtherEvent.fromData({ ... })
    // await this.eventStoreClient.publish(newEvent)

    return Result.makeSuccess();
  }

  private validateInput(
    event: JobCancelledEvent
  ): Success<void> | Failure<"InvalidArgumentsError"> {
    if (event instanceof JobCancelledEvent === false) {
      return Result.makeFailure(
        "InvalidArgumentsError",
        "Expected JobCancelledEvent",
        false
      );
    }
    return Result.makeSuccess();
  }
}
```

### Worker Handler Guidelines

**Template**:

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { EventStoreClient } from "../../event-store/EventStoreClient";
import { CancelJobWorkerController } from "../CancelJobWorker/CancelJobWorkerController/CancelJobWorkerController";
import { CancelJobWorkerService } from "../CancelJobWorker/CancelJobWorkerService/CancelJobWorkerService";

function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({});
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
  const eventStoreClient = new EventStoreClient(ddbDocClient);
  const cancelJobWorkerService = new CancelJobWorkerService(eventStoreClient);
  const cancelJobWorkerController = new CancelJobWorkerController(
    cancelJobWorkerService
  );
  return cancelJobWorkerController.cancelJob.bind(cancelJobWorkerController);
}

export const handler = createHandler();
```

---

## Creating Clients

### When to Create a Client

If a slice (API or Worker) requires access to an external service (DynamoDB, S3, external API, etc.), create a **purpose-built client within that slice**. Each client should handle a single, specific action.

### Core Principles

1. **Clients are slice-specific**: Clients live inside the slice that uses them (not in shared folders)
2. **Single responsibility**: Each client handles one specific action
3. **Single method**: Each client exposes one method
4. **Self-contained**: The slice owns all its dependencies
5. **Consolidated execution pattern**: For clients making external calls, consolidate request/command building and execution into a single `execute*` method with the required number of try-catch blocks to isolate different actions and errors when it makes sense (see Client Template below). This pattern applies to external API clients, AWS SDK clients (DynamoDB, S3, etc.), and other external resource clients. The number of try-catch blocks depends on the distinct operations that can fail independently.

### Client Structure

```
DoSomethingApi/
├── DoSomethingApiController/
├── DoSomethingApiService/
├── DdbGetUserIdClient/              # DynamoDB client
│   ├── DdbGetUserIdClient.ts
│   └── IDdbGetUserIdClient.ts
├── S3StoreSomeFileClient/           # S3 client
│   ├── S3StoreSomeFileClient.ts
│   └── IS3StoreSomeFileClient.ts
└── AxiosFetchSomeDataClient/        # External API client
    ├── AxiosFetchSomeDataClient.ts
    └── IAxiosFetchSomeDataClient.ts
```

### Naming Conventions

- **Folder**: `{Service}{Action}Client` (e.g., `DdbGetUserIdClient`, `S3StoreSomeFileClient`)
- **Class**: `{Service}{Action}Client` (e.g., `DdbGetUserIdClient`)
- **Interface**: `I{Service}{Action}Client` (e.g., `IDdbGetUserIdClient`)
- **Method**: `{action}` (e.g., `getUserId()`, `storeFile()`, `fetchData()`)

### Client Template

```typescript
// DdbGetUserIdClient/IDdbGetUserIdClient.ts
import { Failure, Result, Success } from "../../../errors/Result";

export interface IDdbGetUserIdClientInput {
  email: string;
}

export interface IDdbGetUserIdClientOutput {
  userId: string;
}

export interface IDdbGetUserIdClient {
  getUserId: (
    input: IDdbGetUserIdClientInput
  ) => Promise<
    | Success<IDdbGetUserIdClientOutput>
    | Failure<"InvalidArgumentsError">
    | Failure<"UnrecognizedError">
  >;
}
```

```typescript
// DdbGetUserIdClient/DdbGetUserIdClient.ts
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Failure, Result, Success } from "../../../errors/Result";
import {
  IDdbGetUserIdClient,
  IDdbGetUserIdClientInput,
  IDdbGetUserIdClientOutput,
} from "./IDdbGetUserIdClient";

export class DdbGetUserIdClient implements IDdbGetUserIdClient {
  constructor(private readonly ddbDocClient: DynamoDBDocumentClient) {}

  public async getUserId(
    input: IDdbGetUserIdClientInput
  ): Promise<
    | Success<IDdbGetUserIdClientOutput>
    | Failure<"InvalidArgumentsError">
    | Failure<"UnrecognizedError">
  > {
    const logCtx = "DdbGetUserIdClient.getUserId";
    console.info(`${logCtx} init:`, { input });

    const validationResult = this.validateInput(input);
    if (Result.isFailure(validationResult)) {
      console.error(`${logCtx} exit failure:`, { validationResult, input });
      return validationResult;
    }

    const executeDdbResult = await this.executeDdbGetUserId(input);
    Result.isFailure(executeDdbResult)
      ? console.error(`${logCtx} exit failure:`, { executeDdbResult, input })
      : console.info(`${logCtx} exit success:`, { executeDdbResult, input });

    return executeDdbResult;
  }

  private validateInput(
    input: IDdbGetUserIdClientInput
  ): Success<void> | Failure<"InvalidArgumentsError"> {
    if (!input?.email) {
      return Result.makeFailure(
        "InvalidArgumentsError",
        "Email is required",
        false
      );
    }
    return Result.makeSuccess();
  }

  /**
   * Executes the DynamoDB GetCommand operation.
   * Consolidates command building and execution into a single method with the required number of try-catch blocks to isolate different actions and errors.
   *
   * In this client, we use two try-catch blocks because we need to isolate:
   * - First try-catch: Builds the command (catches construction errors like invalid arguments or missing environment variables)
   * - Second try-catch: Executes the command and processes response (catches execution errors like network failures, DynamoDB errors, or missing data)
   *
   * This pattern is preferred for clients making external calls when it makes sense.
   */
  private async executeDdbGetUserId(
    input: IDdbGetUserIdClientInput
  ): Promise<
    | Success<IDdbGetUserIdClientOutput>
    | Failure<"InvalidArgumentsError">
    | Failure<"UnrecognizedError">
  > {
    const logCtx = "DdbGetUserIdClient.executeDdbGetUserId";

    let ddbCommand: GetCommand;
    try {
      const tableName = process.env.USERS_TABLE_NAME;
      ddbCommand = new GetCommand({
        TableName: tableName,
        Key: {
          email: input.email,
        },
      });
    } catch (error) {
      console.error(`${logCtx} error building GetCommand:`, { error, input });
      const failure = Result.makeFailure("InvalidArgumentsError", error, false);
      console.error(`${logCtx} exit failure:`, { failure, input });
      return failure;
    }

    try {
      const response = await this.ddbDocClient.send(ddbCommand);
      if (!response.Item) {
        const failure = Result.makeFailure(
          "UnrecognizedError",
          "User not found",
          false
        );
        console.error(`${logCtx} exit failure:`, { failure, ddbCommand });
        return failure;
      }
      const output: IDdbGetUserIdClientOutput = {
        userId: response.Item.userId,
      };
      const success = Result.makeSuccess(output);
      console.info(`${logCtx} exit success:`, { success, ddbCommand });
      return success;
    } catch (error) {
      console.error(`${logCtx} error executing GetCommand:`, {
        error,
        ddbCommand,
      });
      const failure = Result.makeFailure("UnrecognizedError", error, true);
      console.error(`${logCtx} exit failure:`, { failure, ddbCommand });
      return failure;
    }
  }
}
```

### Using Clients in Services

```typescript
// DoSomethingApiService/DoSomethingApiService.ts
import { Failure, Result, Success } from "../../../errors/Result";
import { IEventStoreClient } from "../../../event-store/EventStoreClient";
import { IDdbGetUserIdClient } from "../DdbGetUserIdClient/IDdbGetUserIdClient";
import { IncomingDoSomethingRequest } from "../model/IncomingDoSomethingRequest";

export interface IDoSomethingApiService {
  doSomething: (
    request: IncomingDoSomethingRequest
  ) => Promise<
    Success<DoSomethingApiServiceOutput> | Failure<"InvalidArgumentsError">
  >;
}

export class DoSomethingApiService implements IDoSomethingApiService {
  constructor(
    private readonly eventStoreClient: IEventStoreClient,
    private readonly getUserIdClient: IDdbGetUserIdClient // Injected client
  ) {}

  public async doSomething(
    request: IncomingDoSomethingRequest
  ): Promise<
    Success<DoSomethingApiServiceOutput> | Failure<"InvalidArgumentsError">
  > {
    const logCtx = "DoSomethingApiService.doSomething";
    console.info(`${logCtx} init:`, { request });

    // Use the client
    const userIdResult = await this.getUserIdClient.getUserId({
      email: request.email,
    });
    if (Result.isFailure(userIdResult)) {
      return userIdResult;
    }

    const userId = userIdResult.value.userId;
    // ... continue with business logic using userId
  }
}
```

### Wiring Clients in Handlers

```typescript
// DoSomethingApi/handler/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { EventStoreClient } from "../../event-store/EventStoreClient";
import { DoSomethingApiController } from "../DoSomethingApi/DoSomethingApiController/DoSomethingApiController";
import { DoSomethingApiService } from "../DoSomethingApi/DoSomethingApiService/DoSomethingApiService";
import { DdbGetUserIdClient } from "../DoSomethingApi/DdbGetUserIdClient/DdbGetUserIdClient";

function createHandler(): (
  apiEvent: APIGatewayProxyEventV2
) => Promise<APIGatewayProxyStructuredResultV2> {
  const ddbClient = new DynamoDBClient({});
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

  // Create clients
  const eventStoreClient = new EventStoreClient(ddbDocClient);
  const getUserIdClient = new DdbGetUserIdClient(ddbDocClient);

  // Wire up service with clients
  const doSomethingApiService = new DoSomethingApiService(
    eventStoreClient,
    getUserIdClient
  );
  const doSomethingApiController = new DoSomethingApiController(
    doSomethingApiService
  );

  return doSomethingApiController.doSomething.bind(doSomethingApiController);
}

export const handler = createHandler();
```

### Client Guidelines

1. **One action per client**: Each client should handle a single, specific action
2. **Single method**: Expose one method per client
3. **Interface-based**: Always define an interface for dependency injection
4. **Result pattern**: Return `Result<T>` for error handling
5. **Validation**: Validate input within the client
6. **Logging**: Log at entry and exit points
7. **Co-location**: Keep clients within the slice that uses them
8. **Consolidated execution pattern**: When it makes sense and is possible, consolidate request/command building and execution into a single `execute*` method with the required number of try-catch blocks to isolate different actions and errors:
   - **Principle**: Use separate try-catch blocks for distinct operations that can fail independently and need different error handling
   - **Number of blocks**: Determined by the distinct operations (could be 1, 2, 3, or more depending on the client's needs)
   - **Why**: Reduces indirection, improves clarity, and maintains error handling granularity while keeping code cohesive
   - **When to use**: This pattern is preferred for clients making calls to external resources (external APIs, AWS SDK clients, databases, etc.)
   - **Example**: In the DynamoDB client example (`executeDdbGetUserId()`), we use two try-catch blocks because we isolate: (1) command construction errors, (2) command execution and response processing errors. Other clients might need a different number based on their operations.

### Benefits

- ✅ **Self-contained slices**: All dependencies live within the slice
- ✅ **Single responsibility**: Each client has one clear purpose
- ✅ **Testability**: Easy to mock interfaces in tests
- ✅ **Clear ownership**: Client belongs to the slice that uses it
- ✅ **No shared pollution**: Clients are purpose-built, not generic utilities

---

## Code Organization

### Naming Conventions

- **Files**: `PascalCase.ts` (e.g., `CreateJobApiController.ts`)
- **Classes**: `PascalCase` (e.g., `CreateJobApiController`)
- **Interfaces**: `IPascalCase` (e.g., `ICreateJobApiController`)
- **Types**: `PascalCase` (e.g., `CreateJobApiServiceOutput`)
- **Functions**: `camelCase` (e.g., `createJob`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `JOB_CREATED_EVENT`)

### Folder Structure Rules

1. **One feature per folder**: Each API/Worker gets its own folder
2. **Controller/Service separation**: Separate folders for each layer
3. **Models co-located**: Models live in the slice they belong to
4. **Events shared**: Events live in `events/` folder at service level
5. **Handlers co-located**: Each handler lives in its slice folder as `handler/handler.ts`

### Import Organization

```typescript
// 1. AWS SDK imports
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// 2. AWS Lambda types
import { APIGatewayProxyEventV2 } from "aws-lambda";

// 3. Shared utilities (errors, event-store, shared)
import { Result } from "../../../errors/Result";
import { EventStoreClient } from "../../../event-store/EventStoreClient";

// 4. Service-specific imports (events, models, other slices)
import { JobCreatedEvent } from "../../events/JobCreatedEvent";
import { IncomingCreateJobRequest } from "../model/IncomingCreateJobRequest";
```

---

## Error Handling

### Result Pattern

Always use `Result<T>` instead of throwing exceptions:

```typescript
// ✅ Good
const result = await service.createJob(request);
if (Result.isSuccess(result)) {
  return HttpResponse.Accepted(result.value);
}
return HttpResponse.BadRequestError();

// ❌ Bad
try {
  const output = await service.createJob(request);
  return HttpResponse.Accepted(output);
} catch (error) {
  return HttpResponse.BadRequestError();
}
```

### Failure Types

- **InvalidArgumentsError**: Validation failures, malformed input (non-transient)
- **DuplicateEventError**: Event already exists (non-transient)
- **UnrecognizedError**: Unexpected errors (transient by default)

### Transient vs Non-Transient

- **Transient**: Should retry (e.g., network errors, temporary failures)
- **Non-Transient**: Don't retry (e.g., validation errors, duplicate events)

Workers only retry transient failures:

```typescript
if (Result.isFailureTransient(processResult)) {
  batchResponse.batchItemFailures.push({ itemIdentifier: record.messageId });
}
```

---

## Testing Guidelines

### ⚠️ MANDATORY: Create Tests for Every Feature

**CRITICAL REQUIREMENT**: When developing any new feature, you MUST create comprehensive test files for ALL components. This includes:

- ✅ **Events**: Every event class must have a test file
- ✅ **Controllers**: Every controller must have a test file
- ✅ **Services**: Every service must have a test file
- ✅ **Handlers**: Every handler must have a test file
- ✅ **Clients**: Every client must have a test file (if applicable)

**Test files are mandatory and must be created as part of the feature implementation, not as an afterthought.**

### Test File Naming

- **Format**: `{ComponentName}.test.ts` (e.g., `CreateJobApiController.test.ts`)
- **Location**: Co-located with the component being tested
- **Never use**: `.spec.ts` (use `.test.ts` only)

### Test Structure and Organization

Tests are organized into logical sections separated by comment blocks:

```typescript
describe(`Test Template Service CreateJobApi CreateJobApiController tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test APIGatewayProxyEventV2 edge cases
   ************************************************************/
  it(`does not throw if the input APIGatewayProxyEventV2 is valid`, async () => {
    // Test implementation
  });

  /*
   *
   *
   ************************************************************
   * Test APIGatewayProxyEventV2.body edge cases
   ************************************************************/
  it(`does not call CreateJobApiService.createJob if the input
      APIGatewayProxyEventV2.body is undefined`, async () => {
    // Test implementation
  });

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls CreateJobApiService.createJob with the expected input`, async () => {
    // Test implementation
  });

  /*
   *
   *
   ************************************************************
   * Test expected results
   ************************************************************/
  it(`responds with status code 202 Accepted`, async () => {
    // Test implementation
  });
});
```

### Comment Block Format

Use multi-line comment blocks with asterisks to separate test sections:

```typescript
/*
 *
 *
 ************************************************************
 * Section Title
 ************************************************************/
```

**Sections typically include:**

1. **Edge cases** - Test invalid inputs (undefined, null, empty, blank, invalid types)
2. **Internal logic** - Test method calls, parameters, propagation
3. **Expected results** - Test successful execution paths

### Test Naming Conventions

**Format**: Use descriptive, natural language test names in template literals:

```typescript
// ✅ Good - Descriptive, natural language
it(`does not return a Failure if the input IncomingCreateJobRequest is valid`, async () => {
  // ...
});

it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
    IncomingCreateJobRequest is undefined`, async () => {
  // ...
});

it(`calls EventStoreClient.publish a single time`, async () => {
  // ...
});

it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2.body is
    undefined`, async () => {
  // ...
});
```

**Patterns:**

- **Positive cases**: `does not return a Failure if...`, `does not throw if...`
- **Negative cases**: `returns a non-transient Failure of kind X if...`
- **Behavior verification**: `calls X a single time`, `calls X with the expected input`
- **Response verification**: `responds with status code X`, `responds with the expected HttpResponse.X`

### Mock Functions

**Naming Convention:**

- **Prefix**: `buildMock` (e.g., `buildMockApiEvent`, `buildMockEventStoreClient`)
- **Suffixes**:
  - `_succeeds` - Returns success result
  - `_fails` - Returns failure result
  - `_resolves` - Resolves promise
  - `_throws` - Throws error

**Organization:**
Mocks are organized in comment blocks at the top of the test file:

```typescript
/*
 *
 *
 ************************************************************
 * Mock services
 ************************************************************/
function buildMockCreateJobApiService_succeeds(): ICreateJobApiService {
  const mockApiEventBody = buildMockApiEventBody();
  const mockServiceOutput: CreateJobApiServiceOutput = mockApiEventBody;
  const mockServiceOutputResult = Result.makeSuccess(mockServiceOutput);
  return { createJob: jest.fn().mockResolvedValue(mockServiceOutputResult) };
}

function buildMockCreateJobApiService_fails(
  failureKind: FailureKind
): ICreateJobApiService {
  const mockFailure = Result.makeFailure(failureKind, failureKind, false);
  return { createJob: jest.fn().mockResolvedValue(mockFailure) };
}
```

### Test Coverage Requirements

#### Edge Cases (Must Test)

For every input parameter, test:

1. **undefined** - `undefined as never`
2. **null** - `null as never`
3. **Empty string** - `''`
4. **Blank string** - `'      '`
5. **Invalid type** - Wrong type cast as `as never`
6. **Not an instance** - Plain object `{ ...obj }` (for class validation)
7. **Length constraints** - Values below minimum length
8. **Type constraints** - Wrong literal values (e.g., `false` when `true` is required)

**Example:**

```typescript
it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
    JobCreatedEventData.jobId is undefined`, () => {
  const testInput = buildTestInputData();
  testInput.jobId = undefined as never;
  const result = JobCreatedEvent.fromData(testInput);
  expect(Result.isFailure(result)).toBe(true);
  expect(Result.isFailureOfKind(result, "InvalidArgumentsError")).toBe(true);
  expect(Result.isFailureTransient(result)).toBe(false);
});

it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
    JobCreatedEventData.jobId is null`, () => {
  const testInput = buildTestInputData();
  testInput.jobId = null as never;
  const result = JobCreatedEvent.fromData(testInput);
  expect(Result.isFailure(result)).toBe(true);
  expect(Result.isFailureOfKind(result, "InvalidArgumentsError")).toBe(true);
  expect(Result.isFailureTransient(result)).toBe(false);
});

it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
    JobCreatedEventData.jobId is empty`, () => {
  const testInput = buildTestInputData();
  testInput.jobId = "";
  const result = JobCreatedEvent.fromData(testInput);
  expect(Result.isFailure(result)).toBe(true);
  expect(Result.isFailureOfKind(result, "InvalidArgumentsError")).toBe(true);
  expect(Result.isFailureTransient(result)).toBe(false);
});
```

#### Internal Logic (Must Test)

1. **Method calls**: Verify methods are called with correct parameters
2. **Call counts**: Verify methods are called the expected number of times
3. **Error propagation**: Verify failures are propagated correctly
4. **Service interactions**: Verify services/clients are called correctly

**Example:**

```typescript
it(`calls EventStoreClient.publish a single time`, async () => {
  const mockEventStoreClient = buildMockEventStoreClient_succeeds();
  const createJobApiService = new CreateJobApiService(mockEventStoreClient);
  await createJobApiService.createJob(mockIncomingRequest);
  expect(mockEventStoreClient.publish).toHaveBeenCalledTimes(1);
});

it(`calls EventStoreClient.publish with the expected input`, async () => {
  const mockEventStoreClient = buildMockEventStoreClient_succeeds();
  const createJobApiService = new CreateJobApiService(mockEventStoreClient);
  await createJobApiService.createJob(mockIncomingRequest);
  const expectedJobCreatedEventResult = JobCreatedEvent.fromData({
    jobId: mockIncomingRequest.jobId,
    created: true,
  });
  const expectedJobCreatedEvent = Result.getSuccessValueOrThrow(
    expectedJobCreatedEventResult
  );
  expect(mockEventStoreClient.publish).toHaveBeenCalledWith(
    expectedJobCreatedEvent
  );
});
```

#### Expected Results (Must Test)

1. **Success paths**: Verify successful execution returns expected results
2. **Failure paths**: Verify different failure kinds return appropriate responses
3. **Response formats**: Verify HTTP responses, batch responses, etc.

**Example:**

```typescript
it(`returns the expected Success<CreateJobApiServiceOutput> if the execution path is
    successful`, async () => {
  const mockEventStoreClient = buildMockEventStoreClient_succeeds();
  const createJobApiService = new CreateJobApiService(mockEventStoreClient);
  const result = await createJobApiService.createJob(mockIncomingRequest);
  const expectedOutput: CreateJobApiServiceOutput = {
    jobId: mockIncomingRequest.jobId,
  };
  const expectedResult = Result.makeSuccess(expectedOutput);
  expect(Result.isSuccess(result)).toBe(true);
  expect(result).toStrictEqual(expectedResult);
});
```

### Result Pattern Testing

Always test Result pattern properties:

```typescript
// Test failure kind
expect(Result.isFailure(result)).toBe(true);
expect(Result.isFailureOfKind(result, "InvalidArgumentsError")).toBe(true);

// Test transient vs non-transient
expect(Result.isFailureTransient(result)).toBe(false); // or true

// Test success
expect(Result.isSuccess(result)).toBe(true);
expect(result).toStrictEqual(expectedResult);
```

### Type Casting in Tests

Use `as never` for invalid types in edge case tests:

```typescript
const mockTestRequest = undefined as never;
const mockTestRequest = null as never;
const mockTestRequest = "invalid" as unknown as APIGatewayProxyEventV2;
```

### Class Instance Testing

When testing class instances, use `Object.setPrototypeOf()`:

```typescript
const expectedEvent: JobCreatedEvent = {
  idempotencyKey: mockIdempotencyKey,
  eventName: EventStoreEventName.JOB_CREATED_EVENT,
  eventData: {
    jobId: mockJobId,
    created: true,
  },
  createdAt: mockDate,
};
Object.setPrototypeOf(expectedEvent, JobCreatedEvent.prototype);
const expectedResult = Result.makeSuccess(expectedEvent);
expect(result).toStrictEqual(expectedResult);
```

### Time Mocking

Use `jest.useFakeTimers()` for consistent timestamps:

```typescript
jest.useFakeTimers().setSystemTime(new Date("2024-10-19T03:24:00Z"));

const mockDate = new Date().toISOString();
```

### Nested Describe Blocks

Use nested `describe` blocks for testing multiple methods:

```typescript
describe(`Test JobCreatedEvent`, () => {
  describe(`Test JobCreatedEvent.fromData`, () => {
    // Tests for fromData method
  });

  describe(`Test JobCreatedEvent.reconstitute`, () => {
    // Tests for reconstitute method
  });
});
```

### Assertion Patterns

**Common assertions:**

```typescript
// Result pattern
expect(Result.isSuccess(result)).toBe(true);
expect(Result.isFailure(result)).toBe(true);
expect(Result.isFailureOfKind(result, "InvalidArgumentsError")).toBe(true);
expect(Result.isFailureTransient(result)).toBe(false);

// Method calls
expect(mockService.method).toHaveBeenCalledTimes(1);
expect(mockService.method).toHaveBeenCalledWith(expectedArg);
expect(mockService.method).toHaveBeenNthCalledWith(1, expectedArg);

// Equality
expect(result).toStrictEqual(expectedResult);
expect(response).toStrictEqual(expectedResponse);

// Exceptions
await expect(controller.method(mockEvent)).resolves.not.toThrow();
expect(() => Result.getSuccessValueOrThrow(result)).toThrow();

// Instance checks
expect(event).toBeInstanceOf(JobCreatedEvent);
```

### Test Organization Checklist

For each component, ensure tests cover:

- [ ] **Edge cases**: undefined, null, empty, blank, invalid types
- [ ] **Validation**: All validation rules (length, format, type)
- [ ] **Internal logic**: Method calls, parameters, propagation
- [ ] **Success paths**: Expected results for valid inputs
- [ ] **Failure paths**: All failure kinds and transient/non-transient
- [ ] **Response formats**: HTTP status codes, batch responses
- [ ] **Type safety**: Instance checks, type validation

---

## Infrastructure Guidelines

### Creating API Infrastructure

**File**: `infra/lib/<service-name>/<ApiName>LambdaConstruct.ts`

```typescript
export class CancelJobApiLambdaConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ICancelJobApiLambdaConstructProps
  ) {
    super(scope, id);
    const lambdaFunc = this.createLambdaFunction(
      scope,
      id,
      props.dynamoDbTable
    );
    this.createApiIntegration(id, lambdaFunc, props.httpApi);
  }

  private createLambdaFunction(
    scope: Construct,
    id: string,
    dynamoDbTable: Table
  ): NodejsFunction {
    const lambdaFuncName = `${id}-Lambda`.slice(0, 64);
    const servicesRoot = join(__dirname, "../../../services");

    const lambdaFunc = new NodejsFunction(scope, lambdaFuncName, {
      functionName: lambdaFuncName,
      runtime: Runtime.NODEJS_20_X,
      projectRoot: servicesRoot,
      depsLockFilePath: join(servicesRoot, "package-lock.json"),
      entry: join(
        servicesRoot,
        "src/test-template-service/CancelJobApi/handler/handler.ts"
      ),
      handler: "handler",
      environment: {
        EVENT_STORE_TABLE_NAME: dynamoDbTable.tableName,
      },
      timeout: settings.API.TIMEOUT,
    });

    dynamoDbTable.grantReadWriteData(lambdaFunc);
    return lambdaFunc;
  }

  private createApiIntegration(
    id: string,
    lambdaFunc: NodejsFunction,
    httpApi: HttpApi
  ): void {
    const integration = new HttpLambdaIntegration(
      `${id}-Integration`,
      lambdaFunc,
      {
        payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
      }
    );

    httpApi.addRoutes({
      path: "/api/v1/test-template-service/cancelJob",
      methods: [HttpMethod.POST],
      integration,
    });
  }
}
```

### Creating Worker Infrastructure

**File**: `infra/lib/<service-name>/<WorkerName>WorkerConstruct.ts`

```typescript
export class CancelJobWorkerConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ICancelJobWorkerConstructProps
  ) {
    super(scope, id);
    const dlq = this.createDlq(scope, id);
    const queue = this.createQueue(scope, id, dlq);
    this.createLambdaFunction(scope, id, props.dynamoDbTable, queue);
    this.createEventBridgeRule(
      scope,
      id,
      props.dynamoDbTable,
      props.eventBus,
      queue
    );
  }

  private createLambdaFunction(
    scope: Construct,
    id: string,
    dynamoDbTable: Table,
    queue: Queue
  ): NodejsFunction {
    const lambdaFuncName = `${id}-Lambda`.slice(0, 64);
    const servicesRoot = join(__dirname, "../../../services");

    const lambdaFunc = new NodejsFunction(scope, lambdaFuncName, {
      functionName: lambdaFuncName,
      runtime: Runtime.NODEJS_20_X,
      projectRoot: servicesRoot,
      depsLockFilePath: join(servicesRoot, "package-lock.json"),
      entry: join(
        servicesRoot,
        "src/test-template-service/CancelJobWorker/handler/handler.ts"
      ),
      handler: "handler",
      environment: {
        EVENT_STORE_TABLE_NAME: dynamoDbTable.tableName,
      },
      timeout: settings.WORKER.TIMEOUT,
    });

    lambdaFunc.addEventSource(
      new SqsEventSource(queue, {
        batchSize: settings.WORKER.BATCH_SIZE,
        reportBatchItemFailures: settings.WORKER.REPORT_BATCH_ITEM_FAILURES,
      })
    );

    dynamoDbTable.grantReadWriteData(lambdaFunc);
    queue.grantConsumeMessages(lambdaFunc);
    return lambdaFunc;
  }

  private createEventBridgeRule(
    scope: Construct,
    id: string,
    dynamoDbTable: Table,
    eventBus: EventBus,
    queue: Queue
  ): void {
    const rule = new Rule(scope, `${id}-Rule`, {
      eventBus,
      eventPattern: {
        source: ["event-store.dynamodb.stream"],
        detailType: ["DynamoDBStreamRecord"],
        detail: {
          eventSourceARN: [dynamoDbTable.tableStreamArn],
          eventName: ["INSERT"],
          dynamodb: {
            NewImage: {
              eventName: {
                S: ["JOB_CANCELLED_EVENT"], // Filter by event name
              },
            },
          },
        },
      },
    });
    rule.addTarget(new SqsQueue(queue));
  }
}
```

### Wiring in Service Main Construct

```typescript
export class TestTemplateServiceMainConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ITestTemplateServiceMainConstructProps
  ) {
    super(scope, id);

    // API
    const httpApi = new TestTemplateServiceApiConstruct(scope, `${id}-Api`);
    new CreateJobApiLambdaConstruct(scope, `${id}-CreateJobApi`, {
      httpApi: httpApi.httpApi,
      dynamoDbTable: props.dynamoDbTable,
    });
    new CancelJobApiLambdaConstruct(scope, `${id}-CancelJobApi`, {
      httpApi: httpApi.httpApi,
      dynamoDbTable: props.dynamoDbTable,
    });

    // Workers
    new ProcessStepWorkerConstruct(scope, `${id}-ProcessStepWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    });
    new CancelJobWorkerConstruct(scope, `${id}-CancelJobWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    });
  }
}
```

---

## Best Practices

### 1. Always Validate Input

```typescript
// ✅ Good
const validationResult = this.validateInput(request);
if (Result.isFailure(validationResult)) {
  return validationResult;
}

// ❌ Bad
// Assume input is valid
```

### 2. Use Result Pattern, Not Exceptions

```typescript
// ✅ Good
return Result.makeFailure("InvalidArgumentsError", error, false);

// ❌ Bad
throw new Error("Invalid input");
```

### 3. Log at Entry and Exit Points

```typescript
const logCtx = "ServiceName.methodName";
console.info(`${logCtx} init:`, { input });
// ... logic ...
console.info(`${logCtx} exit success:`, { result });
```

### 4. Keep Services Pure

Services should not depend on AWS-specific types. Controllers handle AWS types.

### 5. Use Interfaces for Dependencies

```typescript
// ✅ Good
constructor(private readonly eventStoreClient: IEventStoreClient) {}

// ❌ Bad
constructor(private readonly eventStoreClient: EventStoreClient) {}
```

### 6. One Responsibility Per Class

- **Controller**: AWS I/O handling
- **Service**: Business logic
- **Client**: External system interaction

---

## Common Pitfalls

### ❌ Don't: Throw Exceptions

```typescript
// Bad
if (!request) {
  throw new Error("Request is required");
}
```

### ✅ Do: Return Result

```typescript
// Good
if (!request) {
  return Result.makeFailure(
    "InvalidArgumentsError",
    "Request is required",
    false
  );
}
```

### ❌ Don't: Mix AWS Types in Services

```typescript
// Bad - Service depends on AWS types
class Service {
  async process(event: APIGatewayProxyEventV2) {}
}
```

### ✅ Do: Use Domain Types

```typescript
// Good - Service uses domain types
class Service {
  async process(request: IncomingRequest) {}
}
```

### ❌ Don't: Skip Validation

```typescript
// Bad
const event = JobCreatedEvent.fromData(unvalidatedData);
```

### ✅ Do: Validate First

```typescript
// Good
const validationResult = this.validateInput(data);
if (Result.isFailure(validationResult)) {
  return validationResult;
}
const event = JobCreatedEvent.fromData(validatedData);
```

---

## Quick Reference

### Critical Patterns

#### 1. Result Pattern (Never Throw Exceptions)

```typescript
// ✅ ALWAYS use Result pattern
return Result.makeSuccess(value);
return Result.makeFailure("InvalidArgumentsError", error, false);

// ❌ NEVER throw exceptions
throw new Error("Something went wrong");
```

#### 2. Logging Pattern

```typescript
const logCtx = "ClassName.methodName";
console.info(`${logCtx} init:`, { input });
// ... logic ...
console.info(`${logCtx} exit success:`, { result });
console.error(`${logCtx} exit failure:`, { failure, input });
```

#### 3. HTTP Response Pattern

```typescript
// Use HttpResponse class
return HttpResponse.Accepted(output); // 202
return HttpResponse.OK(output); // 200
return HttpResponse.Created(output); // 201
return HttpResponse.BadRequestError(); // 400
return HttpResponse.InternalServerError(); // 500
```

#### 4. Worker Batch Response Pattern

```typescript
const batchResponse: SQSBatchResponse = { batchItemFailures: [] };

for (const record of sqsEvent.Records) {
  const result = await this.processRecord(record);
  // Only retry transient failures
  if (Result.isFailureTransient(result)) {
    batchResponse.batchItemFailures.push({ itemIdentifier: record.messageId });
  }
}

return batchResponse;
```

#### 5. Event Reconstitution in Workers

```typescript
// Define event map
const validEventsMap: EventClassMap = {
  [EventStoreEventName.JOB_CREATED_EVENT]: JobCreatedEvent,
};

// Reconstitute event
const eventResult = EventStoreEventBuilder.fromEventBridge(
  validEventsMap,
  unverifiedEvent
);

if (Result.isFailure(eventResult)) {
  return eventResult;
}

const event = eventResult.value;
if (event instanceof JobCreatedEvent === false) {
  return Result.makeFailure(
    "InvalidArgumentsError",
    "Expected JobCreatedEvent",
    false
  );
}
```

### Quick Decision Tree

**Adding a new feature?**

1. **Need to expose HTTP endpoint?** → Create API slice (Controller + Service + Model + Handler + Infrastructure)
2. **Need to process events asynchronously?** → Create Worker slice (Controller + Service + Handler + Infrastructure)
3. **Need to represent state change?** → Create Event (with `fromData` and `reconstitute`)
4. **Need to filter events?** → Create EventBridge Rule in Worker construct

**Error handling?**

- **Validation error?** → `Result.makeFailure('InvalidArgumentsError', error, false)`
- **Duplicate event?** → `Result.makeFailure('DuplicateEventError', error, false)` (non-transient)
- **Unexpected error?** → `Result.makeFailure('UnrecognizedError', error, true)` (transient)

**HTTP response?**

- **Event published successfully?** → `HttpResponse.Accepted(output)` (202)
- **Validation failed?** → `HttpResponse.BadRequestError()` (400)
- **Unexpected error?** → `HttpResponse.InternalServerError()` (500)

### TypeScript Requirements

- **Explicit return types**: All functions must have explicit return types
- **No floating promises**: All promises must be awaited or handled
- **Interface prefix**: All interfaces start with `I` (e.g., `IEventStoreClient`)
- **Object shorthand**: Use `{ method }` instead of `{ method: method }`

### Checklists

#### Event Creation Checklist {#event-creation-checklist}

- [ ] Extend `EventStoreEvent<TEventData>`
- [ ] Define `eventName` constant
- [ ] Create Zod schema for `eventData`
- [ ] Implement `fromData()` with validation
- [ ] Implement `reconstitute()` with validation
- [ ] Generate unique idempotency key
- [ ] Add event name to `EventStoreEventName` enum
- [ ] Add type check: `const _ConstructorCheck: EventStoreEventConstructor = EventName`
- [ ] Create test file `{EventName}.test.ts` with comprehensive coverage

#### API Implementation Checklist {#api-implementation-checklist}

- [ ] Create Controller class with interface
- [ ] Create Service class with interface
- [ ] Create Model class with `fromInput()` method
- [ ] Create handler file
- [ ] Create infrastructure construct
- [ ] Wire up in service main construct
- [ ] Create Controller test file with edge cases, internal logic, and expected results
- [ ] Create Service test file with edge cases, internal logic, and expected results
- [ ] Create Handler test file

#### Worker Implementation Checklist {#worker-implementation-checklist}

- [ ] Create Controller class with interface
- [ ] Create Service class with interface
- [ ] Create handler file
- [ ] Create infrastructure construct (SQS + DLQ + Lambda + Rule)
- [ ] Wire up in service main construct
- [ ] Create Controller test file with edge cases, internal logic, and expected results
- [ ] Create Service test file with edge cases, internal logic, and expected results
- [ ] Create Handler test file

#### Infrastructure Checklist {#infrastructure-checklist}

**API Infrastructure:**

- [ ] Create Lambda function with handler entry point
- [ ] Set `EVENT_STORE_TABLE_NAME` environment variable
- [ ] Grant DynamoDB read/write permissions
- [ ] Create API Gateway route
- [ ] Use `settings.API.TIMEOUT` for timeout

**Worker Infrastructure:**

- [ ] Create SQS Queue with DLQ
- [ ] Create Lambda function with handler entry point
- [ ] Set `EVENT_STORE_TABLE_NAME` environment variable
- [ ] Grant DynamoDB read/write permissions
- [ ] Grant SQS consume permissions
- [ ] Add SQS event source to Lambda
- [ ] Create EventBridge Rule filtering by `eventName`
- [ ] Route rule to SQS Queue
- [ ] Use `settings.WORKER.*` for configuration

#### Error Handling Checklist

- [ ] Use `Result<T>` pattern, never throw exceptions
- [ ] Check `Result.isSuccess()` before accessing `.value`
- [ ] Use `Result.isFailureOfKind()` for specific error types
- [ ] Use `Result.isFailureTransient()` in workers for retry logic
- [ ] Map business errors to appropriate HTTP status codes
- [ ] Log all failures with context

### Key Files to Reference

When implementing features, reference these existing files:

- **Event Example**: `services/src/test-template-service/events/JobCreatedEvent.ts`
- **API Controller**: `services/src/test-template-service/CreateJobApi/CreateJobApiController/CreateJobApiController.ts`
- **API Service**: `services/src/test-template-service/CreateJobApi/CreateJobApiService/CreateJobApiService.ts`
- **Worker Controller**: `services/src/test-template-service/ProcessStepWorker/ProcessStepWorkerController/ProcessStepWorkerController.ts`
- **Worker Service**: `services/src/test-template-service/ProcessStepWorker/ProcessStepWorkerService/ProcessStepWorkerService.ts`
- **API Handler**: `services/src/test-template-service/CreateJobApi/handler/handler.ts`
- **Worker Handler**: `services/src/test-template-service/ProcessStepWorker/handler/handler.ts`
- **API Infrastructure**: `infra/lib/test-template-service/CreateJobApiLambdaConstruct.ts`
- **Worker Infrastructure**: `infra/lib/test-template-service/ProcessStepWorkerConstruct.ts`

---

## Summary

Follow these guidelines to maintain consistency and quality:

1. ✅ Use Vertical Slice Architecture
2. ✅ Separate Controller, Service, and Client layers
3. ✅ Use Result pattern for error handling
4. ✅ Validate all inputs
5. ✅ Use interfaces for dependencies
6. ✅ Follow naming conventions
7. ✅ Write tests for all components (MANDATORY)
8. ✅ Log at entry/exit points
9. ✅ Keep services pure (no AWS types)
10. ✅ Use idempotency keys for events

This template provides a **production-ready foundation** for building event-driven applications on AWS with:

✅ **Event Sourcing** for complete auditability  
✅ **Vertical Slices** for maintainable code organization  
✅ **Controller-Service-Client** pattern for clean separation of concerns  
✅ **Type-safe error handling** with Result pattern  
✅ **Idempotent event processing**  
✅ **Scalable architecture** using serverless AWS services  
✅ **Infrastructure as Code** with AWS CDK

The architecture is designed to scale horizontally, handle failures gracefully, and maintain a clear separation between API endpoints and asynchronous workers.
