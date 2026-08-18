import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { JobFinalizedEvent } from '../../events/JobFinalizedEvent'
import { IFinalizedJobRecordClient } from '../FinalizedJobRecordClient/FinalizedJobRecordClient'
import { RecordFinalizedJobWorkerService } from './RecordFinalizedJobWorkerService'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'jobId:mockJobId'
const mockJobId = 'mockJobId'
const mockFinalized = true

function buildMockIncomingJobFinalizedEvent(): TypeUtilsMutable<JobFinalizedEvent> {
  const mockClass: JobFinalizedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.JOB_FINALIZED_EVENT,
    eventData: {
      jobId: mockJobId,
      finalized: mockFinalized,
    },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(mockClass, JobFinalizedEvent.prototype)
  return mockClass
}

const mockIncomingJobFinalizedEvent = buildMockIncomingJobFinalizedEvent()

/*
 *
 *
 ************************************************************
 * Mock Clients
 ************************************************************/
function buildFinalizedJobRecordClient_succeeds(): IFinalizedJobRecordClient {
  return {
    putFinalizedJobRecord: jest.fn().mockResolvedValue(Result.makeSuccess()),
  }
}

function buildFinalizedJobRecordClient_fails(
  failureKind?: FailureKind,
  error?: unknown,
  transient?: boolean,
): IFinalizedJobRecordClient {
  return {
    putFinalizedJobRecord: jest
      .fn()
      .mockResolvedValue(
        Result.makeFailure(
          failureKind ?? 'FinalizedJobWriteError',
          error ?? 'FinalizedJobWriteError',
          transient ?? true,
        ),
      ),
  }
}

describe(`Test Template Service RecordFinalizedJobWorker RecordFinalizedJobWorkerService
          tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test JobFinalizedEvent edge cases
   ************************************************************/
  it(`does not return a Failure if the input JobFinalizedEvent is valid`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    const result = await recordFinalizedJobWorkerService.recordFinalizedJob(mockIncomingJobFinalizedEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      JobFinalizedEvent is undefined`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    const mockTestEvent = undefined as never
    const result = await recordFinalizedJobWorkerService.recordFinalizedJob(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      JobFinalizedEvent is null`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    const mockTestEvent = null as never
    const result = await recordFinalizedJobWorkerService.recordFinalizedJob(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      JobFinalizedEvent is not an instance of the class`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    const mockTestEvent = { ...mockIncomingJobFinalizedEvent }
    const result = await recordFinalizedJobWorkerService.recordFinalizedJob(mockTestEvent)
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
  it(`calls FinalizedJobRecordClient.putFinalizedJobRecord a single time`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    await recordFinalizedJobWorkerService.recordFinalizedJob(mockIncomingJobFinalizedEvent)
    expect(mockFinalizedJobRecordClient.putFinalizedJobRecord).toHaveBeenCalledTimes(1)
  })

  it(`calls FinalizedJobRecordClient.putFinalizedJobRecord with the expected jobId`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    await recordFinalizedJobWorkerService.recordFinalizedJob(mockIncomingJobFinalizedEvent)
    expect(mockFinalizedJobRecordClient.putFinalizedJobRecord).toHaveBeenCalledWith(mockJobId)
  })

  it(`propagates the Failure if FinalizedJobRecordClient.putFinalizedJobRecord returns
      a Failure`, async () => {
    const mockFailureKind = 'FinalizedJobWriteError' as never
    const mockError = 'mockError' as never
    const mockTransient = true as never
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_fails(mockFailureKind, mockError, mockTransient)
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    const result = await recordFinalizedJobWorkerService.recordFinalizedJob(mockIncomingJobFinalizedEvent)
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
  it(`returns the expected Success<void> if the execution path is successful`, async () => {
    const mockFinalizedJobRecordClient = buildFinalizedJobRecordClient_succeeds()
    const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(mockFinalizedJobRecordClient)
    const result = await recordFinalizedJobWorkerService.recordFinalizedJob(mockIncomingJobFinalizedEvent)
    const expectedResult = Result.makeSuccess()
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
