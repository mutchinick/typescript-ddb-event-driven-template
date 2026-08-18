## Purpose

Allow clients to place ecommerce orders by recording an immutable order-placed event as the source of truth for the order lifecycle.

## ADDED Requirements

### Requirement: Accept valid place-order-api request

The system SHALL expose an ecommerce place-order-api API that accepts a valid order request and acknowledges it after the order-placed event is accepted for persistence.

#### Scenario: Valid order request is accepted

- **WHEN** a client submits a place-order-api request with an order id, customer id, currency, and at least one order item
- **THEN** the system returns an accepted response
- **THEN** the response includes the accepted order request data or order identifier sufficient for the caller to correlate the accepted order

### Requirement: Publish order-placed event as source of truth

The system SHALL represent a placed order by persisting an `ORDER_PLACED_EVENT` domain event through the event store.

#### Scenario: Order placed event is persisted

- **WHEN** the system accepts a valid place-order-api request for order id `<orderId>`
- **THEN** it persists an `ORDER_PLACED_EVENT`
- **THEN** the event data includes the order id, customer id, currency, order items, and a placed marker

### Requirement: Use order id as event idempotency boundary

The system SHALL use `orderId:<orderId>` as the idempotency key for the order-placed event so repeated requests for the same order id do not create multiple order-placed events.

#### Scenario: First place-order-api request creates deterministic event key

- **WHEN** the system builds an order-placed event for order id `<orderId>`
- **THEN** the event idempotency key is `orderId:<orderId>`
- **THEN** the persisted event base key is `pk` `EVENTS#orderId:<orderId>` and `sk` `EVENTS#ORDER_PLACED_EVENT`

#### Scenario: Duplicate place-order-api request is treated as success

- **GIVEN** an `ORDER_PLACED_EVENT` already exists for order id `<orderId>`
- **WHEN** a client submits another valid place-order-api request for the same order id
- **THEN** the system treats the duplicate event-store write as idempotent success
- **THEN** the system does not create a second `ORDER_PLACED_EVENT` for that order id

### Requirement: Preserve global event stream indexing

The system SHALL preserve the existing global event stream GSI attributes for order-placed events.

#### Scenario: Order placed event includes global chronological GSI keys

- **WHEN** an `ORDER_PLACED_EVENT` is persisted
- **THEN** the persisted event has `gsi1pk` `EVENTS#EVENT`
- **THEN** the persisted event has `gsi1sk` `CREATED_AT#<createdAt>` using the event creation timestamp

### Requirement: Reject invalid place-order-api requests

The system SHALL reject malformed or incomplete place-order-api requests without publishing an order-placed event.

#### Scenario: Invalid request returns bad request

- **WHEN** a client submits a place-order-api request with malformed JSON, missing required fields, invalid identifiers, invalid currency, or no order items
- **THEN** the system returns a bad request response
- **THEN** no `ORDER_PLACED_EVENT` is persisted

### Requirement: Do not write non-event order records

The system SHALL NOT create or update a separate non-event order record as part of the place-order-api API behavior.

#### Scenario: Place order has only event-store side effect

- **WHEN** the system accepts a valid place-order-api request
- **THEN** the only source-of-truth persistence side effect is the `ORDER_PLACED_EVENT`
- **THEN** any order read model or derived order record is left to a future event consumer
