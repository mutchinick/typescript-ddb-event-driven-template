## Context

The current repository uses the test-template service to demonstrate a DynamoDB event-store plus EventBridge workflow. API Lambdas validate incoming HTTP requests, delegate to a service, publish domain events through `EventStoreClient`, and let DynamoDB Streams plus EventBridge route persisted events to later consumers.

The new ecommerce place-order-api feature should follow that same vertical-slice pattern while creating a separate real service namespace rather than extending the test-template service.

## Goals / Non-Goals

**Goals:**

- Add the first real ecommerce service under `services/src/ecommerce-service`.
- Keep the place-order-api behavior event-first: the API publishes an order-placed event and does not mutate an order table.
- Reuse the existing event-store client and physical key derivation.
- Keep duplicate place-order-api calls idempotent for a given order id.
- Wire the new API through CDK in the same style as the existing test-template API.

**Non-Goals:**

- Do not add payment authorization, inventory reservation, fulfillment, or notification workers.
- Do not create an order read model or non-event order record.
- Do not redesign the shared event-store table key strategy or GSI strategy.
- Do not add a generic service framework abstraction; copy the established local vertical-slice shape.

## Decisions

### Create a separate ecommerce service namespace

Create the first real domain service under `services/src/ecommerce-service` with a colocated `events` folder and a `PlaceOrderApi` slice.

Alternative considered: add place-order-api behavior under `test-template-service`. That would reduce file count but would mix real domain behavior with the architecture sample and make later ecommerce workflow expansion harder to reason about.

### Use the existing controller-service-event-store flow

The API should follow the existing pattern:

```text
handler -> controller -> incoming request model -> service -> OrderPlacedEvent -> EventStoreClient
```

The controller owns API Gateway parsing and HTTP response mapping. The request model owns input validation. The service owns business orchestration and event publication. The handler owns dependency composition.

Alternative considered: let the handler publish the event directly. That would be shorter for one endpoint but would bypass the repository's controller/service test boundaries.

### Model `ORDER_PLACED_EVENT` as the only source-of-truth write

`OrderPlacedEvent` should extend the shared event base class, validate its event data with zod, and be added to the shared event name enum.

The event data should include:

- `orderId`
- `customerId`
- `currency`
- `items`
- `placed: true`

Each item should include:

- `productId`
- `quantity`
- `unitPrice`

Assumptions:

- The caller supplies `orderId`.
- The API accepts caller-provided prices for this first feature; price calculation and catalog lookup are future concerns.
- `currency` is validated as a three-letter uppercase ISO-style currency code.
- `quantity` must be a positive integer.
- `unitPrice` must be a non-negative number.

Alternative considered: generate `orderId` server-side. Caller-supplied ids align better with the current template's deterministic idempotency style and simplify duplicate retry behavior.

### Use `orderId:<orderId>` as the idempotency key

The order-placed event should generate:

```text
idempotencyKey = orderId:<orderId>
```

With the current `EventStoreClient`, this persists as:

```text
pk = EVENTS#orderId:<orderId>
sk = EVENTS#ORDER_PLACED_EVENT
```

This intentionally enforces one `ORDER_PLACED_EVENT` for a specific order id. That is the idempotency mechanism for place-order-api requests: a duplicate request for the same order id is interpreted as a retry of the same command, not as a second order placement. Duplicate conditional writes should be mapped by `EventStoreClient` to `DuplicateEventError`, and the place-order-api service should treat that as success.

Alternative considered: keep the older `ORDER_ID#<orderId>` shape. The lowercase `orderId:<orderId>` format now matches the key pattern used in current service tests and remains fully compatible with the existing event-store client.

### Preserve the existing global chronological GSI

Order-placed events should rely on the existing global event GSI keys:

```text
gsi1pk = EVENTS#EVENT
gsi1sk = CREATED_AT#<createdAt>
```

This keeps event-store behavior consistent and avoids introducing a service-specific index for the first feature.

Alternative considered: add event-type or service-specific GSI keys. That could help later event browsing, but it is outside the first feature and would change the shared event-store contract.

### Add CDK wiring as a first-class part of the slice

Add ecommerce-specific infra constructs mirroring the test-template API constructs:

- ecommerce HTTP API construct
- place-order-api Lambda construct
- ecommerce main construct
- feature flag and `MainStack` registration

The route should be:

```text
POST /api/v1/ecommerce-service/placeOrder
```

Alternative considered: reuse the test-template HTTP API. A separate ecommerce API keeps service boundaries explicit and mirrors the existing service-main construct pattern.

## Risks / Trade-offs

- Caller-supplied prices can become inaccurate or untrusted -> Treat this as a POC/event-flow feature and leave catalog pricing for a later capability.
- The global GSI is not service- or event-type-specific -> Accept for now because the feature does not require querying placed orders by type.
- No read model means clients cannot query order state directly from this feature -> Future projection workers can consume `ORDER_PLACED_EVENT` and write derived records.
- Adding a second service increases infra surface area -> Keep constructs small and copy the established test-template wiring pattern.

## Migration Plan

1. Add service code and tests for the new ecommerce place-order-api vertical slice.
2. Add infrastructure constructs and feature-flagged stack registration.
3. Run affected service tests and infra validation.
4. Deploy with the ecommerce feature flag enabled when ready.
5. Roll back by disabling the ecommerce service feature flag and redeploying; persisted events remain immutable historical records.
