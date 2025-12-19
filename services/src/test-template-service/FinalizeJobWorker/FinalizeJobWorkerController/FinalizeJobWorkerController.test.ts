import { marshall } from '@aws-sdk/util-dynamodb'
import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Result } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventBuilder, IncomingEventBridgeEvent } from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { AllTasksCompletedEvent } from '../../events/AllTasksCompletedEvent'
import { IFinalizeJobWorkerService } from '../FinalizeJobWorkerService/FinalizeJobWorkerService'
import { FinalizeJobWorkerController } from './FinalizeJobWorkerController'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'mockIdempotencyKey'
const mockJobId = 'mockJobId'
const mockCompleted = true

function buildMockAllTasksCompletedEvent(id: string): TypeUtilsMutable<AllTasksCompletedEvent> {
  const incomingEvent: AllTasksCompletedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.ALL_TASKS_COMPLETED_EVENT,
    eventData: {
      jobId: `${mockJobId}-${id}`,
      completed: mockCompleted,
    },
    createdAt: mockDate,
  }
  return incomingEvent
}

function buildMockAllTasksCompletedEvents(ids: string[]): TypeUtilsMutable<AllTasksCompletedEvent>[] {
  return ids.map((id) => buildMockAllTasksCompletedEvent(id))
}

function buildMockEventBridgeEvent(id: string, incomingEvent: AllTasksCompletedEvent): IncomingEventBridgeEvent {
  const mockEventBridgeEvent: IncomingEventBridgeEvent = {
    'detail-type': 'mockDetailType',
    account: 'mockAccount',
    id: `mockId-${id}`,
    region: 'mockRegion',
    resources: ['mockResource'],
    source: 'mockSource',
    time: 'mockTime',
    version: 'mockVersion',
    detail: {
      awsRegion: 'mockAwsRegion',
      eventID: 'mockEventId',
      eventName: 'INSERT',
      eventSource: 'aws:dynamodb',
      eventVersion: 'mockEventVersion',
      dynamodb: {
        NewImage: marshall(incomingEvent, { removeUndefinedValues: true }),
      },
    },
  }

  return mockEventBridgeEvent
}

function buildMockEventBridgeEvents(
  ids: string[],
  incomingAllTasksCompletedEvents: AllTasksCompletedEvent[],
): IncomingEventBridgeEvent[] {
  return ids.map((id, index) => buildMockEventBridgeEvent(id, incomingAllTasksCompletedEvents[index]))
}

function buildMockSqsRecord(id: string, eventBridgeEvent: IncomingEventBridgeEvent): SQSRecord {
  return {
    messageId: `mockMessageId-${id}`,
    body: JSON.stringify(eventBridgeEvent),
  } as unknown as SQSRecord
}

function buildMockSqsRecords(ids: string[], eventBridgeEvents: IncomingEventBridgeEvent[]): SQSRecord[] {
  return ids.map((id, index) => buildMockSqsRecord(id, eventBridgeEvents[index]))
}

function buildMockSqsEvent(sqsRecords: SQSRecord[]): SQSEvent {
  return { Records: sqsRecords }
}

function buildMockTestObjects(ids: string[]): {
  mockAllTasksCompletedEvents: TypeUtilsMutable<AllTasksCompletedEvent>[]
  mockEventBridgeEvents: IncomingEventBridgeEvent[]
  mockSqsRecords: SQSRecord[]
  mockSqsEvent: SQSEvent
} {
  const mockAllTasksCompletedEvents = buildMockAllTasksCompletedEvents(ids)
  const mockEventBridgeEvents = buildMockEventBridgeEvents(ids, mockAllTasksCompletedEvents)
  const mockSqsRecords = buildMockSqsRecords(ids, mockEventBridgeEvents)
  const mockSqsEvent = buildMockSqsEvent(mockSqsRecords)
  return {
    mockAllTasksCompletedEvents,
    mockEventBridgeEvents,
    mockSqsRecords,
    mockSqsEvent,
  }
}

/*
 *
 *
 ************************************************************
 * Mock services
 ************************************************************/
function buildMockFinalizeJobWorkerService_succeeds(): IFinalizeJobWorkerService {
  return { finalizeJob: jest.fn().mockResolvedValue(Result.makeSuccess()) }
}

function buildMockFinalizeJobWorkerService_failsOnData({
  transient,
}: {
  transient: boolean
}): IFinalizeJobWorkerService {
  return {
    finalizeJob: jest.fn().mockImplementation((incomingAllTasksCompletedEvent: AllTasksCompletedEvent) => {
      const shouldFail = Object.values(incomingAllTasksCompletedEvent.eventData).reduce(
        (acc, cur) => (acc = acc || String(cur).endsWith('-FAILURE')),
        false,
      )
      if (shouldFail) {
        const mockFailure = Result.makeFailure('mockFailureKind' as never, 'Error message', transient)
        return Promise.resolve(mockFailure)
      }
      const mockSuccess = Result.makeSuccess()
      return Promise.resolve(mockSuccess)
    }),
  }
}

describe(`Test Template Service FinalizeJobWorker FinalizeJobWorkerController tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test SQSEvent edge cases
   ************************************************************/
  it(`does not throw if the input SQSEvent is valid`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const { mockSqsEvent } = buildMockTestObjects([])
    await expect(finalizeJobWorkerController.finalizeJobs(mockSqsEvent)).resolves.not.toThrow()
  })

  it(`does not call FinalizeJobWorkerService.finalizeJob if the input SQSEvent is
      undefined`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = undefined as never
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSEvent is
      undefined`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = undefined as never
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call FinalizeJobWorkerService.finalizeJob if the input SQSEvent is null`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = null as never
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSEvent is
      null`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = null as never
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test SQSEvent.Records edge cases
   ************************************************************/
  it(`does not call FinalizeJobWorkerService.finalizeJob if the input SQSEvent records
      are missing`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = {} as never
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are missing`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = {} as never
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are undefined`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = buildMockSqsEvent(undefined as never)
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are null`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = buildMockSqsEvent(null as never)
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are empty`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsEvent = buildMockSqsEvent([])
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  /*
   *
   *
   ************************************************************
   * Test SQSRecord.body edge cases
   ************************************************************/
  it(`does not call FinalizeJobWorkerService.finalizeJob if the input SQSRecord.body
      is undefined`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsRecord = { body: undefined } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is undefined`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsRecord = { body: undefined } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call FinalizeJobWorkerService.finalizeJob if the input SQSRecord.body
      is null`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsRecord = { body: null } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is null`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsRecord = { body: null } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call FinalizeJobWorkerService.finalizeJob if the input SQSRecord.body
      is not a valid JSON`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsRecord = {} as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    mockSqsEvent.Records[0].body = 'mockInvalidValue'
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is not a valid JSON`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockSqsRecord = {} as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    mockSqsEvent.Records[0].body = 'mockInvalidValue'
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test AllTasksCompletedEvent edge cases
   ************************************************************/
  it(`does not call FinalizeJobWorkerService.finalizeJob if the input
      AllTasksCompletedEvent is invalid`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockId = 'AA'
    const mockAllTasksCompletedEvent = 'mockInvalidValue' as unknown as AllTasksCompletedEvent
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockAllTasksCompletedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns no SQSBatchItemFailures if the input AllTasksCompletedEvent is invalid`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockId = 'AA'
    const mockAllTasksCompletedEvent = 'mockInvalidValue' as unknown as AllTasksCompletedEvent
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockAllTasksCompletedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call FinalizeJobWorkerService.finalizeJob if the input
      AllTasksCompletedEvent is not an instance of the class`, async () => {
    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockImplementationOnce(() => {
      class UnknownEvent extends EventStoreEvent {
        static create(): EventStoreEvent {
          return new UnknownEvent('UNKNOWN_EVENT' as never, {}, mockIdempotencyKey, mockDate)
        }
      }
      return Result.makeSuccess(UnknownEvent.create())
    })

    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockId = 'AA'
    const mockAllTasksCompletedEvent = buildMockAllTasksCompletedEvent(mockId)
    mockAllTasksCompletedEvent.eventName = undefined as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockAllTasksCompletedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).not.toHaveBeenCalled()
  })

  it(`returns no SQSBatchItemFailures if the input AllTasksCompletedEvent is not an
      instance of the class`, async () => {
    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockImplementationOnce(() => {
      class UnknownEvent extends EventStoreEvent {
        static create(): EventStoreEvent {
          return new UnknownEvent('UNKNOWN_EVENT' as never, {}, mockIdempotencyKey, mockDate)
        }
      }
      return Result.makeSuccess(UnknownEvent.create())
    })

    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockId = 'AA'
    const mockAllTasksCompletedEvent = buildMockAllTasksCompletedEvent(mockId)
    mockAllTasksCompletedEvent.eventName = undefined as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockAllTasksCompletedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls FinalizeJobWorkerService.finalizeJob a single time for an SQSEvent with a
      single record`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).toHaveBeenCalledTimes(1)
  })

  it(`calls FinalizeJobWorkerService.finalizeJob a multiple times for an SQSEvent with
      a multiple records`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).toHaveBeenCalledTimes(mockSqsRecords.length)
  })

  it(`calls FinalizeJobWorkerService.finalizeJob with the expected input`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockAllTasksCompletedEvents, mockSqsEvent } = buildMockTestObjects(mockIds)
    await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    expect(mockFinalizeJobWorkerService.finalizeJob).toHaveBeenNthCalledWith(1, mockAllTasksCompletedEvents[0])
    expect(mockFinalizeJobWorkerService.finalizeJob).toHaveBeenNthCalledWith(2, mockAllTasksCompletedEvents[1])
    expect(mockFinalizeJobWorkerService.finalizeJob).toHaveBeenNthCalledWith(3, mockAllTasksCompletedEvents[2])
  })

  /*
   *
   *
   ************************************************************
   * Test transient/non-transient edge cases
   ************************************************************/
  it(`returns no SQSBatchItemFailures if the FinalizeJobWorkerService returns no
      Failure`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_succeeds()
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns no SQSBatchItemFailures if the FinalizeJobWorkerService returns a
      non-transient Failure (test 1)`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_failsOnData({ transient: false })
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns expected SQSBatchItemFailures if the FinalizeJobWorkerService returns a
      transient Failure (test 1)`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_failsOnData({ transient: true })
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = {
      batchItemFailures: [
        { itemIdentifier: mockSqsRecords[0].messageId },
        { itemIdentifier: mockSqsRecords[1].messageId },
      ],
    }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns all SQSBatchItemFailures if the FinalizeJobWorkerService throws all and
      only transient Failure`, async () => {
    const mockFinalizeJobWorkerService = buildMockFinalizeJobWorkerService_failsOnData({ transient: true })
    const finalizeJobWorkerController = new FinalizeJobWorkerController(mockFinalizeJobWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC-FAILURE']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await finalizeJobWorkerController.finalizeJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = {
      batchItemFailures: [
        { itemIdentifier: mockSqsRecords[0].messageId },
        { itemIdentifier: mockSqsRecords[1].messageId },
        { itemIdentifier: mockSqsRecords[2].messageId },
      ],
    }
    expect(response).toStrictEqual(expectedResponse)
  })
})
