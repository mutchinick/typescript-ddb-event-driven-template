import { Result } from '../../../errors/Result'
import { IncomingPlaceOrderRequest, IncomingPlaceOrderRequestInput } from './IncomingPlaceOrderRequest'

function buildMockIncomingPlaceOrderRequestInput(): IncomingPlaceOrderRequestInput {
  return {
    orderId: 'mockOrderId',
    customerId: 'mockCustomerId',
    currency: 'USD',
    items: [{ productId: 'mockProductId', quantity: 1, unitPrice: 10 }],
  }
}

describe(`Ecommerce Service PlaceOrderApi IncomingPlaceOrderRequest tests`, () => {
  it(`does not return a Failure if the input IncomingPlaceOrderRequestInput is valid`, () => {
    const result = IncomingPlaceOrderRequest.fromInput(buildMockIncomingPlaceOrderRequestInput())
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input is
      undefined`, () => {
    const result = IncomingPlaceOrderRequest.fromInput(undefined as never)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if orderId length
      < 6`, () => {
    const input = buildMockIncomingPlaceOrderRequestInput()
    input.orderId = '12345'
    const result = IncomingPlaceOrderRequest.fromInput(input)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if currency is
      invalid`, () => {
    const input = buildMockIncomingPlaceOrderRequestInput()
    input.currency = 'usd'
    const result = IncomingPlaceOrderRequest.fromInput(input)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if items is empty`, () => {
    const input = buildMockIncomingPlaceOrderRequestInput()
    input.items = []
    const result = IncomingPlaceOrderRequest.fromInput(input)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if item quantity
      is not positive`, () => {
    const input = buildMockIncomingPlaceOrderRequestInput()
    input.items[0].quantity = 0
    const result = IncomingPlaceOrderRequest.fromInput(input)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns the expected Success<IncomingPlaceOrderRequest> if the execution path is
      successful`, () => {
    const input = buildMockIncomingPlaceOrderRequestInput()
    const result = IncomingPlaceOrderRequest.fromInput(input)
    const expectedRequest: IncomingPlaceOrderRequest = { ...input }
    Object.setPrototypeOf(expectedRequest, IncomingPlaceOrderRequest.prototype)
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(Result.makeSuccess(expectedRequest))
  })
})
