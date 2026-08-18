import { marshall } from '@aws-sdk/util-dynamodb'
import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Result } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventBuilder, IncomingEventBridgeEvent } from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { JobFinalizedEvent } from '../../events/JobFinalizedEvent'
import { IRecordFinalizedJobWorkerService } from '../RecordFinalizedJobWorkerService/RecordFinalizedJobWorkerService'
import { RecordFinalizedJobWorkerController } from './RecordFinalizedJobWorkerController'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'jobId:mockJobId'
const mockJobId = 'mockJobId'
const mockFinalized = true

function buildMockJobFinalizedEvent(id: string): TypeUtilsMutable<JobFinalizedEvent> {
  const incomingEvent: JobFinalizedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.JOB_FINALIZED_EVENT,
    eventData: {
      jobId: `${mockJobId}-${id}`,
      finalized: mockFinalized,
    },
    createdAt: mockDate,
  }
  return incomingEvent
}

function buildMockJobFinalizedEvents(ids: string[]): TypeUtilsMutable<JobFinalizedEvent>[] {
  return ids.map((id) => buildMockJobFinalizedEvent(id))
}

function buildMockEventBridgeEvent(id: string, incomingEvent: JobFinalizedEvent): IncomingEventBridgeEvent {
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
  incomingJobFinalizedEvents: JobFinalizedEvent[],
): IncomingEventBridgeEvent[] {
  return ids.map((id, index) => buildMockEventBridgeEvent(id, incomingJobFinalizedEvents[index]))
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
  mockJobFinalizedEvents: TypeUtilsMutable<JobFinalizedEvent>[]
  mockEventBridgeEvents: IncomingEventBridgeEvent[]
  mockSqsRecords: SQSRecord[]
  mockSqsEvent: SQSEvent
} {
  const mockJobFinalizedEvents = buildMockJobFinalizedEvents(ids)
  const mockEventBridgeEvents = buildMockEventBridgeEvents(ids, mockJobFinalizedEvents)
  const mockSqsRecords = buildMockSqsRecords(ids, mockEventBridgeEvents)
  const mockSqsEvent = buildMockSqsEvent(mockSqsRecords)
  return {
    mockJobFinalizedEvents,
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
function buildMockRecordFinalizedJobWorkerService_succeeds(): IRecordFinalizedJobWorkerService {
  return { recordFinalizedJob: jest.fn().mockResolvedValue(Result.makeSuccess()) }
}

function buildMockRecordFinalizedJobWorkerService_failsOnData({
  transient,
}: {
  transient: boolean
}): IRecordFinalizedJobWorkerService {
  return {
    recordFinalizedJob: jest.fn().mockImplementation((incomingJobFinalizedEvent: JobFinalizedEvent) => {
      const shouldFail = Object.values(incomingJobFinalizedEvent.eventData).reduce(
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

describe(`Test Template Service RecordFinalizedJobWorker
          RecordFinalizedJobWorkerController tests`, () => {
  it(`does not throw if the input SQSEvent is valid`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const { mockSqsEvent } = buildMockTestObjects([])
    await expect(recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)).resolves.not.toThrow()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent is undefined`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const mockSqsEvent = undefined as never
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockRecordFinalizedJobWorkerService.recordFinalizedJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSEvent records are missing`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const mockSqsEvent = {} as never
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockRecordFinalizedJobWorkerService.recordFinalizedJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures and does not call the
      service if the input SQSRecord.body is invalid JSON`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const mockSqsRecord = { messageId: 'mockMessageId', body: 'not-json' } as unknown as SQSRecord
    const mockSqsEvent = buildMockSqsEvent([mockSqsRecord])
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
    expect(mockRecordFinalizedJobWorkerService.recordFinalizedJob).not.toHaveBeenCalled()
  })

  it(`calls RecordFinalizedJobWorkerService.recordFinalizedJob a single time for a
      valid record`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const { mockSqsEvent } = buildMockTestObjects(['A'])
    await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    expect(mockRecordFinalizedJobWorkerService.recordFinalizedJob).toHaveBeenCalledTimes(1)
  })

  it(`does not call RecordFinalizedJobWorkerService.recordFinalizedJob if
      EventStoreEventBuilder.fromEventBridge fails`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const invalidIncomingEvent = buildMockJobFinalizedEvent('A')
    invalidIncomingEvent.eventName = EventStoreEventName.STEP_PROCESSED_EVENT as never
    const mockEventBridgeEvent = buildMockEventBridgeEvent('A', invalidIncomingEvent)
    const mockSqsEvent = buildMockSqsEvent([buildMockSqsRecord('A', mockEventBridgeEvent)])
    await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    expect(mockRecordFinalizedJobWorkerService.recordFinalizedJob).not.toHaveBeenCalled()
  })

  it(`does not call RecordFinalizedJobWorkerService.recordFinalizedJob if the
      reconstituted event is not a JobFinalizedEvent instance`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_succeeds()
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )

    const mockEventBridgeEvent = buildMockEventBridgeEvent('A', buildMockJobFinalizedEvent('A'))
    const mockWrongEvent = {
      idempotencyKey: mockIdempotencyKey,
      eventName: EventStoreEventName.JOB_FINALIZED_EVENT,
      eventData: {
        jobId: mockJobId,
        finalized: mockFinalized,
      },
      createdAt: mockDate,
    }
    Object.setPrototypeOf(mockWrongEvent, EventStoreEvent.prototype)

    jest.spyOn(EventStoreEventBuilder, 'fromEventBridge').mockReturnValueOnce(Result.makeSuccess(mockWrongEvent))

    const mockSqsEvent = buildMockSqsEvent([buildMockSqsRecord('A', mockEventBridgeEvent)])
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)

    expect(response).toStrictEqual({ batchItemFailures: [] })
    expect(mockRecordFinalizedJobWorkerService.recordFinalizedJob).not.toHaveBeenCalled()
  })

  it(`returns an empty SQSBatchResponse.batchItemFailures if service returns a
      non-transient Failure`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_failsOnData({
      transient: false,
    })
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const { mockSqsEvent } = buildMockTestObjects(['NON-TRANSIENT-FAILURE'])
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = { batchItemFailures: [] }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns a SQSBatchResponse.batchItemFailures with one item if service returns a
      transient Failure`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_failsOnData({
      transient: true,
    })
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )
    const { mockSqsEvent, mockSqsRecords } = buildMockTestObjects(['TRANSIENT-FAILURE'])
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs(mockSqsEvent)
    const expectedResponse: SQSBatchResponse = {
      batchItemFailures: [{ itemIdentifier: mockSqsRecords[0].messageId }],
    }
    expect(response).toStrictEqual(expectedResponse)
  })

  it(`returns a SQSBatchResponse.batchItemFailures with only the transient failures
      when processing multiple records`, async () => {
    const mockRecordFinalizedJobWorkerService = buildMockRecordFinalizedJobWorkerService_failsOnData({
      transient: true,
    })
    const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(
      mockRecordFinalizedJobWorkerService,
    )

    const { mockSqsRecords } = buildMockTestObjects(['SUCCESS', 'TRANSIENT-FAILURE'])
    const response = await recordFinalizedJobWorkerController.recordFinalizedJobs({ Records: mockSqsRecords })

    const expectedResponse: SQSBatchResponse = {
      batchItemFailures: [{ itemIdentifier: mockSqsRecords[1].messageId }],
    }
    expect(response).toStrictEqual(expectedResponse)
  })
})
