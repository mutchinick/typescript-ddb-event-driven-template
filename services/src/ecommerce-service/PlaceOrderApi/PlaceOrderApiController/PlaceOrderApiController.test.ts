import { APIGatewayProxyEventV2 } from 'aws-lambda'
import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { HttpResponse } from '../../../shared/HttpResponse'
import { IncomingPlaceOrderRequest } from '../model/IncomingPlaceOrderRequest'
import { IPlaceOrderApiService, PlaceOrderApiServiceOutput } from '../PlaceOrderApiService/PlaceOrderApiService'
import { PlaceOrderApiController } from './PlaceOrderApiController'

function buildMockApiEventBody(): {
  orderId: string
  customerId: string
  currency: string
  items: { productId: string; quantity: number; unitPrice: number }[]
} {
  return {
    orderId: 'mockOrderId',
    customerId: 'mockCustomerId',
    currency: 'USD',
    items: [{ productId: 'mockProductId', quantity: 1, unitPrice: 10 }],
  }
}

function buildMockApiEvent(body: object): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2
}

function buildMockPlaceOrderApiService_succeeds(): IPlaceOrderApiService {
  const mockServiceOutput: PlaceOrderApiServiceOutput = buildMockApiEventBody()
  return { placeOrder: jest.fn().mockResolvedValue(Result.makeSuccess(mockServiceOutput)) }
}

function buildMockPlaceOrderApiService_fails(failureKind: FailureKind): IPlaceOrderApiService {
  const mockFailure = Result.makeFailure(failureKind, failureKind, false)
  return { placeOrder: jest.fn().mockResolvedValue(mockFailure) }
}

describe(`Ecommerce Service PlaceOrderApi PlaceOrderApiController tests`, () => {
  it(`does not call PlaceOrderApiService.placeOrder if the body is malformed JSON`, async () => {
    const mockService = buildMockPlaceOrderApiService_succeeds()
    const controller = new PlaceOrderApiController(mockService)
    const mockApiEvent = { body: 'mockInvalidValue' } as unknown as APIGatewayProxyEventV2
    await controller.placeOrder(mockApiEvent)
    expect(mockService.placeOrder).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the body is malformed JSON`, async () => {
    const mockService = buildMockPlaceOrderApiService_succeeds()
    const controller = new PlaceOrderApiController(mockService)
    const mockApiEvent = { body: 'mockInvalidValue' } as unknown as APIGatewayProxyEventV2
    const response = await controller.placeOrder(mockApiEvent)
    expect(response).toStrictEqual(HttpResponse.BadRequestError())
  })

  it(`does not call PlaceOrderApiService.placeOrder if request validation fails`, async () => {
    const mockService = buildMockPlaceOrderApiService_succeeds()
    const controller = new PlaceOrderApiController(mockService)
    const mockApiEventBody = buildMockApiEventBody()
    mockApiEventBody.currency = 'usd'
    await controller.placeOrder(buildMockApiEvent(mockApiEventBody))
    expect(mockService.placeOrder).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if request validation fails`, async () => {
    const mockService = buildMockPlaceOrderApiService_succeeds()
    const controller = new PlaceOrderApiController(mockService)
    const mockApiEventBody = buildMockApiEventBody()
    mockApiEventBody.items = []
    const response = await controller.placeOrder(buildMockApiEvent(mockApiEventBody))
    expect(response).toStrictEqual(HttpResponse.BadRequestError())
  })

  it(`calls PlaceOrderApiService.placeOrder with an IncomingPlaceOrderRequest instance`, async () => {
    const mockService = buildMockPlaceOrderApiService_succeeds()
    const controller = new PlaceOrderApiController(mockService)
    const mockApiEventBody = buildMockApiEventBody()
    await controller.placeOrder(buildMockApiEvent(mockApiEventBody))
    const expectedRequest = Result.getSuccessValueOrThrow(IncomingPlaceOrderRequest.fromInput(mockApiEventBody))
    expect(mockService.placeOrder).toHaveBeenCalledWith(expectedRequest)
    expect(mockService.placeOrder).toHaveBeenCalledTimes(1)
  })

  it(`responds with 500 Internal Server Error if service returns UnrecognizedError`, async () => {
    const mockService = buildMockPlaceOrderApiService_fails('UnrecognizedError')
    const controller = new PlaceOrderApiController(mockService)
    const response = await controller.placeOrder(buildMockApiEvent(buildMockApiEventBody()))
    expect(response).toStrictEqual(HttpResponse.InternalServerError())
  })

  it(`responds with 400 Bad Request if service returns InvalidArgumentsError`, async () => {
    const mockService = buildMockPlaceOrderApiService_fails('InvalidArgumentsError')
    const controller = new PlaceOrderApiController(mockService)
    const response = await controller.placeOrder(buildMockApiEvent(buildMockApiEventBody()))
    expect(response).toStrictEqual(HttpResponse.BadRequestError())
  })

  it(`responds with the expected HttpResponse.Accepted response`, async () => {
    const mockService = buildMockPlaceOrderApiService_succeeds()
    const controller = new PlaceOrderApiController(mockService)
    const response = await controller.placeOrder(buildMockApiEvent(buildMockApiEventBody()))
    expect(response).toStrictEqual(HttpResponse.Accepted(buildMockApiEventBody()))
  })
})
