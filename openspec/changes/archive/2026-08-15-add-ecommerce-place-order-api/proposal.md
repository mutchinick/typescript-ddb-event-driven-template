## Why

The repository currently demonstrates the event-driven architecture with a test-template job workflow, but it does not include a real domain service. We need a first ecommerce vertical slice that proves the same pattern with a customer-facing place-order-api API whose only source-of-truth side effect is an immutable domain event.

## What Changes

- Add a new ecommerce service vertical slice for placing orders.
- Add a `PlaceOrderApi` HTTP entry point that accepts a place-order-api request and returns `202 Accepted` after the order event is accepted for persistence.
- Add an `OrderPlacedEvent` domain event that represents the fact that an order was placed.
- Persist `ORDER_PLACED_EVENT` through the existing `EventStoreClient`; do not write a separate order record in this feature.
- Use `orderId:<orderId>` as the event idempotency key.
- Preserve the current event-store physical key strategy:
  - base key: `pk` is `EVENTS#orderId:<orderId>`, `sk` is `EVENTS#ORDER_PLACED_EVENT`.
  - GSI key: `gsi1pk` is `EVENTS#EVENT`, `gsi1sk` is `CREATED_AT#<createdAt>`.
- Treat duplicate `ORDER_PLACED_EVENT` writes for the same order id as idempotent success.
- Add tests for the new request model, event class, controller, service, handler wiring, and infrastructure wiring updates.
- Add infrastructure wiring for the new ecommerce API route and Lambda.

## Capabilities

### New Capabilities

- `ecommerce-service/place-order`: Accept place-order-api API requests and publish exactly one `ORDER_PLACED_EVENT` per order id through the existing event store.

### Modified Capabilities

- None.

## Impact

- Affected services code:
  - New service folder under `services/src/ecommerce-service`.
  - New `PlaceOrderApi` API slice.
  - New ecommerce event under `services/src/ecommerce-service/events`.
  - Shared event name enum update for `ORDER_PLACED_EVENT`.
- Affected infrastructure code:
  - New ecommerce service API and Lambda constructs under `infra/lib/ecommerce-service`.
  - `MainStack` registration behind a service feature flag.
- Affected behavior:
  - Adds a real ecommerce domain API while preserving the architecture rule that business state changes happen by publishing events.
  - Keeps event storage as the source of truth for this first feature.
  - Leaves payment, inventory, fulfillment, notifications, and order read-model projection out of scope.
