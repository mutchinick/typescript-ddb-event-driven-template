import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { OrderPlacedEvent, OrderPlacedEventData } from '../../events/OrderPlacedEvent'
import { IncomingPlaceOrderRequest } from '../model/IncomingPlaceOrderRequest'
import { PlaceOrderApiService, PlaceOrderApiServiceOutput } from './PlaceOrderApiService'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

function buildMockIncomingRequest(): TypeUtilsMutable<IncomingPlaceOrderRequest> {
  const mockClass = IncomingPlaceOrderRequest.fromInput({
    orderId: 'mockOrderId',
    customerId: 'mockCustomerId',
    currency: 'USD',
    items: [{ productId: 'mockProductId', quantity: 1, unitPrice: 10 }],
  })
  return Result.getSuccessValueOrThrow(mockClass)
}

function buildMockEventStoreClient_succeeds(value?: unknown): IEventStoreClient {
  const mockResult = Result.makeSuccess(value)
  return {
    publish: jest.fn().mockResolvedValue(mockResult),
    getEventsByKey: jest.fn().mockResolvedValue(Result.makeSuccess([])),
  }
}

function buildMockEventStoreClient_fails(
  failureKind?: FailureKind,
  error?: unknown,
  transient?: boolean,
): IEventStoreClient {
  const mockFailure = Result.makeFailure(
    failureKind ?? 'UnrecognizedError',
    error ?? 'UnrecognizedError',
    transient ?? true,
  )
  return {
    publish: jest.fn().mockResolvedValue(mockFailure),
    getEventsByKey: jest.fn().mockResolvedValue(Result.makeSuccess([])),
  }
}

describe(`Ecommerce Service PlaceOrderApi PlaceOrderApiService tests`, () => {
  it(`does not return a Failure if the input IncomingPlaceOrderRequest is valid`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds()
    const service = new PlaceOrderApiService(mockEventStoreClient)
    const result = await service.placeOrder(buildMockIncomingRequest())
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input is
      not an instance of the class`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds()
    const service = new PlaceOrderApiService(mockEventStoreClient)
    const result = await service.placeOrder({ ...buildMockIncomingRequest() })
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`propagates the Failure if OrderPlacedEvent.fromData returns a Failure`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds()
    const service = new PlaceOrderApiService(mockEventStoreClient)
    const expectedResult = Result.makeFailure('InvalidArgumentsError', 'mockError', false)
    jest.spyOn(OrderPlacedEvent, 'fromData').mockReturnValueOnce(expectedResult)
    const result = await service.placeOrder(buildMockIncomingRequest())
    expect(Result.isFailure(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  it(`calls EventStoreClient.publish with the expected input`, async () => {
    const mockIncomingRequest = buildMockIncomingRequest()
    const mockEventStoreClient = buildMockEventStoreClient_succeeds()
    const service = new PlaceOrderApiService(mockEventStoreClient)
    await service.placeOrder(mockIncomingRequest)
    const eventData: OrderPlacedEventData = {
      orderId: mockIncomingRequest.orderId,
      customerId: mockIncomingRequest.customerId,
      currency: mockIncomingRequest.currency,
      items: mockIncomingRequest.items,
      placed: true,
    }
    const expectedEvent = Result.getSuccessValueOrThrow(OrderPlacedEvent.fromData(eventData))
    expect(expectedEvent.idempotencyKey).toBe(`orderId:${mockIncomingRequest.orderId}`)
    expect(mockEventStoreClient.publish).toHaveBeenCalledWith(expectedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledTimes(1)
  })

  it(`propagates the Failure if EventStoreClient.publish returns a non-duplicate
      Failure`, async () => {
    const mockFailureKind = 'UnrecognizedError'
    const mockEventStoreClient = buildMockEventStoreClient_fails(mockFailureKind, 'mockError', true)
    const service = new PlaceOrderApiService(mockEventStoreClient)
    const result = await service.placeOrder(buildMockIncomingRequest())
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, mockFailureKind)).toBe(true)
  })

  it(`returns Success<PlaceOrderApiServiceOutput> if EventStoreClient.publish returns
      DuplicateEventError`, async () => {
    const mockIncomingRequest = buildMockIncomingRequest()
    const mockEventStoreClient = buildMockEventStoreClient_fails('DuplicateEventError')
    const service = new PlaceOrderApiService(mockEventStoreClient)
    const result = await service.placeOrder(mockIncomingRequest)
    const expectedOutput: PlaceOrderApiServiceOutput = { ...mockIncomingRequest }
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(Result.makeSuccess(expectedOutput))
  })

  it(`returns the expected Success<PlaceOrderApiServiceOutput> if the execution path
      is successful`, async () => {
    const mockIncomingRequest = buildMockIncomingRequest()
    const mockEventStoreClient = buildMockEventStoreClient_succeeds()
    const service = new PlaceOrderApiService(mockEventStoreClient)
    const result = await service.placeOrder(mockIncomingRequest)
    const expectedOutput: PlaceOrderApiServiceOutput = { ...mockIncomingRequest }
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(Result.makeSuccess(expectedOutput))
  })
})
