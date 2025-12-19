import { marshall } from '@aws-sdk/util-dynamodb'
import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Result } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventBuilder, IncomingEventBridgeEvent } from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { TaskFooExecutedEvent } from '../../events/TaskFooExecutedEvent'
import { TaskQuxExecutedEvent } from '../../events/TaskQuxExecutedEvent'
import { TaskBarExecutedEvent } from '../../events/TaskBarExecutedEvent'
import { ICompleteAllTasksWorkerService } from '../CompleteAllTasksWorkerService/CompleteAllTasksWorkerService'
import { CompleteAllTasksWorkerController } from './CompleteAllTasksWorkerController'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'mockIdempotencyKey'
const mockJobId = 'mockJobId'
const mockExecuted = true

function buildMockTaskFooExecutedEvent(id: string): TypeUtilsMutable<TaskFooExecutedEvent> {
  const incomingEvent: TaskFooExecutedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_FOO_EXECUTED_EVENT,
    eventData: {
      jobId: `${mockJobId}-${id}`,
      executed: mockExecuted,
    },
    createdAt: mockDate,
  }
  return incomingEvent
}

function buildMockTaskFooExecutedEvents(ids: string[]): TypeUtilsMutable<TaskFooExecutedEvent>[] {
  return ids.map((id) => buildMockTaskFooExecutedEvent(id))
}

function buildMockEventBridgeEvent(
  id: string,
  incomingEvent: TaskFooExecutedEvent | TaskQuxExecutedEvent | TaskBarExecutedEvent,
): IncomingEventBridgeEvent {
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
  incomingTaskFooExecutedEvents: TaskFooExecutedEvent[],
): IncomingEventBridgeEvent[] {
  return ids.map((id, index) => buildMockEventBridgeEvent(id, incomingTaskFooExecutedEvents[index]))
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
  mockTaskFooExecutedEvents: TypeUtilsMutable<TaskFooExecutedEvent>[]
  mockEventBridgeEvents: IncomingEventBridgeEvent[]
  mockSqsRecords: SQSRecord[]
  mockSqsEvent: SQSEvent
} {
  const mockTaskFooExecutedEvents = buildMockTaskFooExecutedEvents(ids)
  const mockEventBridgeEvents = buildMockEventBridgeEvents(ids, mockTaskFooExecutedEvents)
  const mockSqsRecords = buildMockSqsRecords(ids, mockEventBridgeEvents)
  const mockSqsEvent = buildMockSqsEvent(mockSqsRecords)
  return {
    mockTaskFooExecutedEvents,
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
function buildMockCompleteAllTasksWorkerService_succeeds(): ICompleteAllTasksWorkerService {
  return { completeTask: jest.fn().mockResolvedValue(Result.makeSuccess()) }
}

function buildMockCompleteAllTasksWorkerService_failsOnData({
  transient,
}: {
  transient: boolean
}): ICompleteAllTasksWorkerService {
  return {
    completeTask: jest
      .fn()
      .mockImplementation((incomingEvent: TaskFooExecutedEvent | TaskQuxExecutedEvent | TaskBarExecutedEvent) => {
        const shouldFail = Object.values(incomingEvent.eventData).reduce(
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

describe(`Test Template Service CompleteAllTasksWorker CompleteAllTasksWorkerController
          tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test SQSEvent edge cases
   ************************************************************/
  it(`does not throw if the input SQSEvent is valid`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const { mockSqsEvent } = buildMockTestObjects([])
    await expect(completeAllTasksWorkerController.completeTasks(mockSqsEvent)).resolves.not.toThrow()
  })

  it(`does not call CompleteAllTasksWorkerService.completeTask if the input SQSEvent
      is undefined`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = undefined as never
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSEvent is
      undefined`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = undefined as never
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call CompleteAllTasksWorkerService.completeTask if the input SQSEvent
      is null`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = null as never
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSEvent is
      null`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = null as never
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test SQSEvent.Records edge cases
   ************************************************************/
  it(`does not call CompleteAllTasksWorkerService.completeTask if the input SQSEvent
      records are missing`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = {} as never
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are missing`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = {} as never
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are undefined`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = buildMockSqsEvent(undefined as never)
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are null`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = buildMockSqsEvent(null as never)
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are empty`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsEvent = buildMockSqsEvent([])
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  /*
   *
   *
   ************************************************************
   * Test SQSRecord.body edge cases
   ************************************************************/
  it(`does not call CompleteAllTasksWorkerService.completeTask if the input
      SQSRecord.body is undefined`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsRecord = { body: undefined } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is undefined`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsRecord = { body: undefined } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call CompleteAllTasksWorkerService.completeTask if the input
      SQSRecord.body is null`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsRecord = { body: null } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is null`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsRecord = { body: null } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call CompleteAllTasksWorkerService.completeTask if the input
      SQSRecord.body is not a valid JSON`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsRecord = {} as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    mockSqsEvent.Records[0].body = 'mockInvalidValue'
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if the input SQSRecord.body
      is not a valid JSON`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockSqsRecord = {} as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    mockSqsEvent.Records[0].body = 'mockInvalidValue'
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test task event edge cases (TaskFooExecutedEvent, TaskQuxExecutedEvent, TaskBarExecutedEvent)
   ************************************************************/
  it(`does not call CompleteAllTasksWorkerService.completeTask if the input task event
      is invalid`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockId = 'AA'
    const mockTaskFooExecutedEvent = 'mockInvalidValue' as unknown as TaskFooExecutedEvent
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockTaskFooExecutedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns no SQSBatchItemFailures if the input task event is invalid`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockId = 'AA'
    const mockTaskFooExecutedEvent = 'mockInvalidValue' as unknown as TaskFooExecutedEvent
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockTaskFooExecutedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`does not call CompleteAllTasksWorkerService.completeTask if the input task event
      is not an instance of any task event class`, async () => {
    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockImplementationOnce(() => {
      class UnknownEvent extends EventStoreEvent {
        static create(): EventStoreEvent {
          return new UnknownEvent('UNKNOWN_EVENT' as never, {}, mockIdempotencyKey, mockDate)
        }
      }
      return Result.makeSuccess(UnknownEvent.create())
    })

    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockId = 'AA'
    const mockTaskFooExecutedEvent = buildMockTaskFooExecutedEvent(mockId)
    mockTaskFooExecutedEvent.eventName = undefined as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockTaskFooExecutedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).not.toHaveBeenCalled()
  })

  it(`returns no SQSBatchItemFailures if the input task event is not an instance of
      any task event class`, async () => {
    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockImplementationOnce(() => {
      class UnknownEvent extends EventStoreEvent {
        static create(): EventStoreEvent {
          return new UnknownEvent('UNKNOWN_EVENT' as never, {}, mockIdempotencyKey, mockDate)
        }
      }
      return Result.makeSuccess(UnknownEvent.create())
    })

    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockId = 'AA'
    const mockTaskFooExecutedEvent = buildMockTaskFooExecutedEvent(mockId)
    mockTaskFooExecutedEvent.eventName = undefined as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent(mockId, mockTaskFooExecutedEvent)
    const mockSqsRecord = buildMockSqsRecord(mockId, mockEventBridgeEvent)
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls CompleteAllTasksWorkerService.completeTask a single time for an SQSEvent
      with a single record`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).toHaveBeenCalledTimes(1)
  })

  it(`calls CompleteAllTasksWorkerService.completeTask a multiple times for an
      SQSEvent with a multiple records`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).toHaveBeenCalledTimes(mockSqsRecords.length)
  })

  it(`calls CompleteAllTasksWorkerService.completeTask with the expected input`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockTaskFooExecutedEvents, mockSqsEvent } = buildMockTestObjects(mockIds)
    await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    expect(mockCompleteAllTasksWorkerService.completeTask).toHaveBeenNthCalledWith(1, mockTaskFooExecutedEvents[0])
    expect(mockCompleteAllTasksWorkerService.completeTask).toHaveBeenNthCalledWith(2, mockTaskFooExecutedEvents[1])
    expect(mockCompleteAllTasksWorkerService.completeTask).toHaveBeenNthCalledWith(3, mockTaskFooExecutedEvents[2])
  })

  /*
   *
   *
   ************************************************************
   * Test transient/non-transient edge cases
   ************************************************************/
  it(`returns no SQSBatchItemFailures if the CompleteAllTasksWorkerService returns no
      Failure`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_succeeds()
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA', 'BB', 'CC']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns no SQSBatchItemFailures if the CompleteAllTasksWorkerService returns a
      non-transient Failure (test 1)`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_failsOnData({ transient: false })
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC']
    const { mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns expected SQSBatchItemFailures if the CompleteAllTasksWorkerService
      returns a transient Failure (test 1)`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_failsOnData({ transient: true })
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = {
      batchItemFailures: [
        { itemIdentifier: mockSqsRecords[0].messageId },
        { itemIdentifier: mockSqsRecords[1].messageId },
      ],
    }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns all SQSBatchItemFailures if the CompleteAllTasksWorkerService throws all
      and only transient Failure`, async () => {
    const mockCompleteAllTasksWorkerService = buildMockCompleteAllTasksWorkerService_failsOnData({ transient: true })
    const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(mockCompleteAllTasksWorkerService)
    const mockIds = ['AA-FAILURE', 'BB-FAILURE', 'CC-FAILURE']
    const { mockSqsRecords, mockSqsEvent } = buildMockTestObjects(mockIds)
    const response = await completeAllTasksWorkerController.completeTasks(mockSqsEvent)
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
