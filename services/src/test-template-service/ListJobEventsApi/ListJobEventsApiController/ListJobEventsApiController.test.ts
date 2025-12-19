import { APIGatewayProxyEventV2 } from 'aws-lambda'
import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { HttpResponse } from '../../../shared/HttpResponse'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import {
  IListJobEventsApiService,
  ListJobEventsApiServiceOutput,
} from '../ListJobEventsApiService/ListJobEventsApiService'
import { IncomingGetJobEventsRequest } from '../model/IncomingGetJobEventsRequest'
import { ListJobEventsApiController } from './ListJobEventsApiController'

const mockJobId = 'mockJobId'

function buildMockApiEventBody(): TypeUtilsMutable<IncomingGetJobEventsRequest> {
  const mockValidRequest: IncomingGetJobEventsRequest = {
    jobId: mockJobId,
  }
  return mockValidRequest
}

function buildMockApiEvent(incomingGetJobEventsRequest: IncomingGetJobEventsRequest): APIGatewayProxyEventV2 {
  const mockApiEvent = {
    body: JSON.stringify(incomingGetJobEventsRequest),
  } as unknown as APIGatewayProxyEventV2
  return mockApiEvent
}

function buildMockEventStoreEvent(): EventStoreEvent {
  const mockEvent: EventStoreEvent = {
    idempotencyKey: 'jobId:mockJobId',
    eventName: EventStoreEventName.JOB_CREATED_EVENT,
    eventData: { jobId: 'mockJobId', created: true },
    createdAt: '2024-10-19T03:24:00.000Z',
  }
  Object.setPrototypeOf(mockEvent, EventStoreEvent.prototype)
  return mockEvent
}

const mockEvent = buildMockEventStoreEvent()

/*
 *
 *
 ************************************************************
 * Mock services
 ************************************************************/
function buildMockListJobEventsApiService_succeeds(): IListJobEventsApiService {
  const mockServiceOutput: ListJobEventsApiServiceOutput = {
    jobId: mockJobId,
    events: [
      {
        idempotencyKey: mockEvent.idempotencyKey,
        eventName: mockEvent.eventName,
        eventData: mockEvent.eventData,
        createdAt: mockEvent.createdAt,
      },
    ],
  }
  const mockServiceOutputResult = Result.makeSuccess(mockServiceOutput)
  return { listJobEvents: jest.fn().mockResolvedValue(mockServiceOutputResult) }
}

function buildMockListJobEventsApiService_fails(failureKind: FailureKind): IListJobEventsApiService {
  const mockFailure = Result.makeFailure(failureKind, failureKind, false)
  return { listJobEvents: jest.fn().mockResolvedValue(mockFailure) }
}

describe(`Test Template Service ListJobEventsApi ListJobEventsApiController tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test APIGatewayProxyEventV2 edge cases
   ************************************************************/
  it(`does not throw if the input APIGatewayProxyEventV2 is valid`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    await expect(listJobEventsApiController.listJobEvents(mockApiEvent)).resolves.not.toThrow()
  })

  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2 is undefined`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = undefined as unknown as APIGatewayProxyEventV2
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2 is undefined`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = undefined as unknown as APIGatewayProxyEventV2
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2 is invalid`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = 'mockInvalidValue' as unknown as APIGatewayProxyEventV2
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2 is invalid`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = 'mockInvalidValue' as unknown as APIGatewayProxyEventV2
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test APIGatewayProxyEventV2.body edge cases
   ************************************************************/
  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2.body is undefined`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = { body: undefined } as unknown as APIGatewayProxyEventV2
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2.body is
      undefined`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = { body: undefined } as unknown as APIGatewayProxyEventV2
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2.body is null`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = { body: null } as unknown as APIGatewayProxyEventV2
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2.body is null`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = { body: null } as unknown as APIGatewayProxyEventV2
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2.body is not a valid JSON`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = { body: 'mockInvalidValue' } as unknown as APIGatewayProxyEventV2
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2.body is not a
      valid JSON`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEvent = { body: 'mockInvalidValue' } as unknown as APIGatewayProxyEventV2
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test APIGatewayProxyEventV2.body.jobId edge cases
   ************************************************************/
  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2.body.jobId is undefined`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    mockApiEventBody.jobId = undefined as never
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2.body.jobId is
      undefined`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    mockApiEventBody.jobId = undefined as never
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ListJobEventsApiService.listJobEvents if the input
      APIGatewayProxyEventV2.body.jobId is null`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    mockApiEventBody.jobId = null as never
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).not.toHaveBeenCalled()
  })

  it(`responds with 400 Bad Request if the input APIGatewayProxyEventV2.body.jobId is
      null`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    mockApiEventBody.jobId = null as never
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls ListJobEventsApiService.listJobEvents with the expected input`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(mockListJobEventsApiService.listJobEvents).toHaveBeenCalledTimes(1)
  })

  it(`responds with 500 Internal Server Error if ListJobEventsApiService.listJobEvents
      returns a Failure of kind not accounted for`, async () => {
    const mockFailureKind = 'mockFailureKind' as FailureKind
    const mockListJobEventsApiService = buildMockListJobEventsApiService_fails(mockFailureKind)
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.InternalServerError()
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`responds with 500 Internal Server Error if ListJobEventsApiService.listJobEvents
      returns a Failure of kind UnrecognizedError`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_fails('UnrecognizedError')
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.InternalServerError()
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`responds with 400 Bad Request if ListJobEventsApiService.listJobEvents returns a
      Failure of kind InvalidArgumentsError`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_fails('InvalidArgumentsError')
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedResponse = HttpResponse.BadRequestError()
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test expected results
   ************************************************************/
  it(`responds with status code 200 OK`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    expect(response.statusCode).toBe(200)
  })

  it(`responds with the expected HttpResponse.OK response`, async () => {
    const mockListJobEventsApiService = buildMockListJobEventsApiService_succeeds()
    const listJobEventsApiController = new ListJobEventsApiController(mockListJobEventsApiService)
    const mockApiEventBody = buildMockApiEventBody()
    const mockApiEvent = buildMockApiEvent(mockApiEventBody)
    const response = await listJobEventsApiController.listJobEvents(mockApiEvent)
    const expectedServiceOutput: ListJobEventsApiServiceOutput = {
      jobId: mockJobId,
      events: [
        {
          idempotencyKey: mockEvent.idempotencyKey,
          eventName: mockEvent.eventName,
          eventData: mockEvent.eventData,
          createdAt: mockEvent.createdAt,
        },
      ],
    }
    const expectedResponse = HttpResponse.OK(expectedServiceOutput)
    expect(response).toStrictEqual(expectedResponse)
  })
})
