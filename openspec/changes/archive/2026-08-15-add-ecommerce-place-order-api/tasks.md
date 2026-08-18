## 1. Event Contract

- [x] 1.1 Add `ORDER_PLACED_EVENT` to the shared event name enum.
- [x] 1.2 Create `OrderPlacedEvent` under the ecommerce service events folder with zod validation for order id, customer id, currency, items, and `placed: true`.
- [x] 1.3 Implement `orderId:<orderId>` idempotency key generation for `OrderPlacedEvent`.
- [x] 1.4 Add unit tests for valid event creation, invalid event data, deterministic idempotency key, and reconstitution.

## 2. Place Order API Slice

- [x] 2.1 Create the `services/src/ecommerce-service/PlaceOrderApi` folder structure following the existing controller, service, model, and handler pattern.
- [x] 2.2 Create `IncomingPlaceOrderRequest` validation for order id, customer id, uppercase three-letter currency, and at least one item with product id, positive integer quantity, and non-negative unit price.
- [x] 2.3 Implement `PlaceOrderApiService` to validate request instances, build `OrderPlacedEvent`, publish it through `IEventStoreClient`, and treat `DuplicateEventError` as idempotent success.
- [x] 2.4 Implement `PlaceOrderApiController` to parse API Gateway JSON input, map valid accepted requests to `202 Accepted`, map invalid requests to bad request, and map unexpected failures to internal server error.
- [x] 2.5 Implement the Lambda handler dependency chain as DynamoDB client, DynamoDB document client, `EventStoreClient`, service, and controller.

## 3. API Slice Tests

- [x] 3.1 Add unit tests for `IncomingPlaceOrderRequest` accepted and rejected input shapes.
- [x] 3.2 Add unit tests for `PlaceOrderApiService` success, invalid request instance, duplicate event idempotent success, event build failure, and publish failure behavior.
- [x] 3.3 Add unit tests for `PlaceOrderApiController` valid request handling, malformed JSON, invalid payload, and unexpected service failure response mapping.
- [x] 3.4 Add handler tests that verify dependency-chain wiring and exported handler behavior.

## 4. Infrastructure Wiring

- [x] 4.1 Add ecommerce service CDK constructs for the HTTP API, place-order-api Lambda, and ecommerce service main construct.
- [x] 4.2 Wire the place-order-api Lambda to `services/src/ecommerce-service/PlaceOrderApi/handler/handler.ts` with `EVENT_STORE_TABLE_NAME`.
- [x] 4.3 Grant the place-order-api Lambda read/write access to the event-store DynamoDB table.
- [x] 4.4 Add route `POST /api/v1/ecommerce-service/placeOrder`.
- [x] 4.5 Add an ecommerce service feature flag and register the ecommerce service construct in `MainStack`.

## 5. Verification

- [x] 5.1 Run the affected services unit tests for the ecommerce service and shared event-store/event-name changes.
- [x] 5.2 Run affected infra validation or synthesis for the ecommerce CDK wiring.
- [x] 5.3 Run `openspec validate add-ecommerce-place-order-api --strict`.
