import { marshall } from '@aws-sdk/util-dynamodb'
import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Result } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventBuilder, IncomingEventBridgeEvent } from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { StepProcessedEvent } from '../../events/StepProcessedEvent'
import { IExecuteTaskQuxWorkerService } from '../ExecuteTaskQuxWorkerService/ExecuteTaskQuxWorkerService'
import { ExecuteTaskQuxWorkerController } from './ExecuteTaskQuxWorkerController'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'mockIdempotencyKey'
const mockJobId = 'mockJobId'
const mockProcessed = true

function buildMockStepProcessedEvent(id: string): TypeUtilsMutable<StepProcessedEvent> {
  const incomingEvent: StepProcessedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.STEP_PROCESSED_EVENT,
    eventData: {
      jobId: `${mockJobId}-${id}`,
      processed: mockProcessed,
    },
    createdAt: mockDate,
  }
  return incomingEvent
}

function buildMockStepProcessedEvents(ids: string[]): TypeUtilsMutable<StepProcessedEvent>[] {
  return ids.map((id) => buildMockStepProcessedEvent(id))
}

function buildMockEventBridgeEvent(id: string, incomingEvent: StepProcessedEvent): IncomingEventBridgeEvent {
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
  incomingStepProcessedEvents: StepProcessedEvent[],
): IncomingEventBridgeEvent[] {
  return ids.map((id, index) => buildMockEventBridgeEvent(id, incomingStepProcessedEvents[index]))
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
  mockStepProcessedEvents: TypeUtilsMutable<StepProcessedEvent>[]
  mockEventBridgeEvents: IncomingEventBridgeEvent[]
  mockSqsRecords: SQSRecord[]
  mockSqsEvent: SQSEvent
} {
  const mockStepProcessedEvents = buildMockStepProcessedEvents(ids)
  const mockEventBridgeEvents = buildMockEventBridgeEvents(ids, mockStepProcessedEvents)
  const mockSqsRecords = buildMockSqsRecords(ids, mockEventBridgeEvents)
  const mockSqsEvent = buildMockSqsEvent(mockSqsRecords)
  return {
    mockStepProcessedEvents,
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
function buildMockExecuteTaskQuxWorkerService_succeeds(): IExecuteTaskQuxWorkerService {
  return { executeTask: jest.fn().mockResolvedValue(Result.makeSuccess()) }
}

function buildMockExecuteTaskQuxWorkerService_failsOnData({
  transient,
}: {
  transient: boolean
}): IExecuteTaskQuxWorkerService {
  return {
    executeTask: jest.fn().mockImplementation((incomingStepProcessedEvent: StepProcessedEvent) => {
      const shouldFail = Object.values(incomingStepProcessedEvent.eventData).reduce(
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

describe(`Test Template Service ExecuteTaskQuxWorker ExecuteTaskQuxWorkerController tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test SQSEvent edge cases
   ************************************************************/
  it(`does not throw if the input SQSEvent is valid`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const { mockSqsEvent } = buildMockTestObjects([])
    await expect(executeTaskQuxWorkerController.executeTasks(mockSqsEvent)).resolves.not.toThrow()
  })

  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input SQSEvent is
      undefined`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = undefined as never
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSEvent is
      undefined`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = undefined as never
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input SQSEvent is
      null`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = null as never
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSEvent is
      null`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = null as never
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test SQSEvent.Records edge cases
   ************************************************************/
  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input SQSEvent
      records are missing`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = {} as never
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are missing`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = {} as never
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are undefined`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = buildMockSqsEvent(undefined as never)
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are null`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = buildMockSqsEvent(null as never)
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are empty`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsEvent = buildMockSqsEvent([])
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  /*
   *
   *
   ************************************************************
   * Test SQSRecord.body edge cases
   ************************************************************/
  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input
      SQSRecord.body is undefined`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsRecord = { body: undefined } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is undefined`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsRecord = { body: undefined } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input
      SQSRecord.body is null`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsRecord = { body: null } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is null`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsRecord = { body: null } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input
      SQSRecord.body is not a valid JSON`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsRecord = {} as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    mockSqsEvent.Records[0].body = 'mockInvalidValue'
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is not a valid JSON`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockSqsRecord = {} as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    mockSqsEvent.Records[0].body = 'mockInvalidValue'
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test StepProcessedEvent edge cases
   ************************************************************/
  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input
      StepProcessedEvent is invalid`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockId = 'AA'
    const mockStepProcessedEvent = 'mockInvalidValue' as unknown as StepProcessedEvent
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockStepProcessedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns no SQSBatchItemFailures if the input StepProcessedEvent is invalid`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockId = 'AA'
    const mockStepProcessedEvent = 'mockInvalidValue' as unknown as StepProcessedEvent
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockStepProcessedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call ExecuteTaskQuxWorkerService.executeTask if the input
      StepProcessedEvent is not an instance of the class`, async () => {
    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockImplementationOnce(() => {
      class UnknownEvent extends EventStoreEvent {
        static create(): EventStoreEvent {
          return new UnknownEvent('UNKNOWN_EVENT' as never, {}, mockIdempotencyKey, mockDate)
        }
      }
      return Result.makeSuccess(UnknownEvent.create())
    })

    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockId = 'AA'
    const mockStepProcessedEvent = buildMockStepProcessedEvent(mockId)
    mockStepProcessedEvent.eventName = undefined as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockStepProcessedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).not.toHaveBeenCalled()
  })

  it(`returns no SQSBatchItemFailures if the input StepProcessedEvent is not an
      instance of the class`, async () => {
    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockImplementationOnce(() => {
      class UnknownEvent extends EventStoreEvent {
        static create(): EventStoreEvent {
          return new UnknownEvent('UNKNOWN_EVENT' as never, {}, mockIdempotencyKey, mockDate)
        }
      }
      return Result.makeSuccess(UnknownEvent.create())
    })

    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockId = 'AA'
    const mockStepProcessedEvent = buildMockStepProcessedEvent(mockId)
    mockStepProcessedEvent.eventName = undefined as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockStepProcessedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls ExecuteTaskQuxWorkerService.executeTask a single time for an SQSEvent with
      a single record`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).toHaveBeenCalledTimes(1)
  })

  it(`calls ExecuteTaskQuxWorkerService.executeTask a multiple times for an SQSEvent
      with a multiple records`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).toHaveBeenCalledTimes(mockSqsRecords.length)
  })

  it(`calls ExecuteTaskQuxWorkerService.executeTask with the expected input`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockStepProcessedEvents, mockSqsEvent } = buildMockTestObjects(mockIds)
    await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    expect(mockExecuteTaskQuxWorkerService.executeTask).toHaveBeenNthCalledWith(1, mockStepProcessedEvents[0])
    expect(mockExecuteTaskQuxWorkerService.executeTask).toHaveBeenNthCalledWith(2, mockStepProcessedEvents[1])
    expect(mockExecuteTaskQuxWorkerService.executeTask).toHaveBeenNthCalledWith(3, mockStepProcessedEvents[2])
  })

  /*
   *
   *
   ************************************************************
   * Test transient/non-transient edge cases
   ************************************************************/
  it(`returns no SQSBatchItemFailures if the ExecuteTaskQuxWorkerService returns no
      Failure`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_succeeds()
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns no SQSBatchItemFailures if the ExecuteTaskQuxWorkerService returns a
      non-transient Failure (test 1)`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_failsOnData({ transient: false })
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns expected SQSBatchItemFailures if the ExecuteTaskQuxWorkerService returns
      a transient Failure (test 1)`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_failsOnData({ transient: true })
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = {
      batchItemFailures: [
        { itemIdentifier: mockSqsRecords[0].messageId },
        { itemIdentifier: mockSqsRecords[1].messageId },
      ],
    }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns all SQSBatchItemFailures if the ExecuteTaskQuxWorkerService throws all
      and only transient Failure`, async () => {
    const mockExecuteTaskQuxWorkerService = buildMockExecuteTaskQuxWorkerService_failsOnData({ transient: true })
    const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(mockExecuteTaskQuxWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC-FAILURE']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await executeTaskQuxWorkerController.executeTasks(mockSqsEvent)
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
