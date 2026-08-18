import { Result } from '../../errors/Result'
import { EventStoreEventName } from '../../event-store/EventStoreEventName'
import { OrderPlacedEvent, OrderPlacedEventData } from './OrderPlacedEvent'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockOrderId = 'mockOrderId'
const mockCustomerId = 'mockCustomerId'
const mockCurrency = 'USD'
const mockItems = [{ productId: 'mockProductId', quantity: 2, unitPrice: 10.5 }]
const mockIdempotencyKey = `orderId:${mockOrderId}`

function buildTestInputData(): OrderPlacedEventData {
  return {
    orderId: mockOrderId,
    customerId: mockCustomerId,
    currency: mockCurrency,
    items: mockItems,
    placed: true,
  }
}

describe(`Ecommerce Service OrderPlacedEvent tests`, () => {
  describe(`Test OrderPlacedEvent.fromData`, () => {
    it(`does not return a Failure if the input OrderPlacedEventData is valid`, () => {
      const result = OrderPlacedEvent.fromData(buildTestInputData())
      expect(Result.isFailure(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if orderId is
        invalid`, () => {
      const testInput = buildTestInputData()
      testInput.orderId = '12345'
      const result = OrderPlacedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if currency is not
        uppercase three-letter code`, () => {
      const testInput = buildTestInputData()
      testInput.currency = 'usd'
      const result = OrderPlacedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if items is empty`, () => {
      const testInput = buildTestInputData()
      testInput.items = []
      const result = OrderPlacedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns the expected Success<OrderPlacedEvent> if the execution path is
        successful`, () => {
      const testInput = buildTestInputData()
      const result = OrderPlacedEvent.fromData(testInput)

      const expectedEvent: OrderPlacedEvent = {
        idempotencyKey: mockIdempotencyKey,
        eventName: EventStoreEventName.ORDER_PLACED_EVENT,
        eventData: testInput,
        createdAt: mockDate,
      }
      Object.setPrototypeOf(expectedEvent, OrderPlacedEvent.prototype)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(Result.makeSuccess(expectedEvent))
    })
  })

  describe(`Test OrderPlacedEvent.reconstitute`, () => {
    it(`does not return a Failure if the input OrderPlacedEvent is valid`, () => {
      const result = OrderPlacedEvent.reconstitute(buildTestInputData(), mockIdempotencyKey, mockDate)
      expect(Result.isFailure(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if idempotencyKey
        is invalid`, () => {
      const result = OrderPlacedEvent.reconstitute(buildTestInputData(), '', mockDate)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if createdAt is
        invalid`, () => {
      const result = OrderPlacedEvent.reconstitute(buildTestInputData(), mockIdempotencyKey, 'mockInvalidDate')
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })
  })
})
