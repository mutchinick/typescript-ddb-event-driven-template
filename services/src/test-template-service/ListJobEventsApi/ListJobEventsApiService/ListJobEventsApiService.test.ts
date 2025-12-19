import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { IncomingGetJobEventsRequest } from '../model/IncomingGetJobEventsRequest'
import { ListJobEventsApiService, ListJobEventsApiServiceOutput } from './ListJobEventsApiService'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

function buildMockIncomingRequest(): TypeUtilsMutable<IncomingGetJobEventsRequest> {
  const mockClass = IncomingGetJobEventsRequest.fromInput({
    jobId: 'mockJobId',
  })
  return Result.getSuccessValueOrThrow(mockClass)
}

const mockIncomingRequest = buildMockIncomingRequest()

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
 * Mock clients
 ************************************************************/
function buildMockEventStoreClient_succeeds(events?: EventStoreEvent[]): IEventStoreClient {
  const mockEvents = events ?? []
  return {
    publish: jest.fn().mockResolvedValue(Result.makeSuccess()),
    getEventsByKey: jest.fn().mockResolvedValue(Result.makeSuccess(mockEvents)),
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
    publish: jest.fn().mockResolvedValue(Result.makeSuccess()),
    getEventsByKey: jest.fn().mockResolvedValue(mockFailure),
  }
}

describe(`Test Template Service ListJobEventsApi ListJobEventsApiService tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test IncomingGetJobEventsRequest edge cases
   ************************************************************/
  it(`does not return a Failure if the input IncomingGetJobEventsRequest is valid`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const result = await listJobEventsApiService.listJobEvents(mockIncomingRequest)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequest is undefined`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const mockTestRequest = undefined as never
    const result = await listJobEventsApiService.listJobEvents(mockTestRequest)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequest is null`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const mockTestRequest = null as never
    const result = await listJobEventsApiService.listJobEvents(mockTestRequest)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequest is not an instance of the class`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const mockTestRequest = { ...mockIncomingRequest }
    const result = await listJobEventsApiService.listJobEvents(mockTestRequest)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls EventStoreClient.getEventsByKey a single time`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    await listJobEventsApiService.listJobEvents(mockIncomingRequest)
    expect(mockEventStoreClient.getEventsByKey).toHaveBeenCalledTimes(1)
  })

  it(`calls EventStoreClient.getEventsByKey with the expected pk`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    await listJobEventsApiService.listJobEvents(mockIncomingRequest)
    const expectedPk = `EVENTS#jobId:${mockIncomingRequest.jobId}`
    expect(mockEventStoreClient.getEventsByKey).toHaveBeenCalledWith(expectedPk)
  })

  it(`propagates the Failure if EventStoreClient.getEventsByKey returns a Failure`, async () => {
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError'
    const mockTransient = 'mockTransient' as never
    const mockEventStoreClient = buildMockEventStoreClient_fails(mockFailureKind, mockError, mockTransient)
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const result = await listJobEventsApiService.listJobEvents(mockIncomingRequest)
    const expectedResult = Result.makeFailure(mockFailureKind, mockError, mockTransient)
    expect(Result.isFailure(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  /*
   *
   *
   ************************************************************
   * Test expected results
   ************************************************************/
  it(`returns the expected Success<ListJobEventsApiServiceOutput> with empty array if
      no events are found`, async () => {
    const mockEventStoreClient = buildMockEventStoreClient_succeeds([])
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const result = await listJobEventsApiService.listJobEvents(mockIncomingRequest)
    const expectedOutput: ListJobEventsApiServiceOutput = {
      jobId: mockIncomingRequest.jobId,
      events: [],
    }
    const expectedResult = Result.makeSuccess(expectedOutput)
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  it(`returns the expected Success<ListJobEventsApiServiceOutput> with events if
      events are found`, async () => {
    const mockEvents = [mockEvent]
    const mockEventStoreClient = buildMockEventStoreClient_succeeds(mockEvents)
    const listJobEventsApiService = new ListJobEventsApiService(mockEventStoreClient)
    const result = await listJobEventsApiService.listJobEvents(mockIncomingRequest)
    const expectedOutput: ListJobEventsApiServiceOutput = {
      jobId: mockIncomingRequest.jobId,
      events: [
        {
          idempotencyKey: mockEvent.idempotencyKey,
          eventName: mockEvent.eventName,
          eventData: mockEvent.eventData,
          createdAt: mockEvent.createdAt,
        },
      ],
    }
    const expectedResult = Result.makeSuccess(expectedOutput)
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
