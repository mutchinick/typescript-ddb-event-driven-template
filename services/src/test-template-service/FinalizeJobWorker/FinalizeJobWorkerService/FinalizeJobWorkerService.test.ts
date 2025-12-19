import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { AllTasksCompletedEvent } from '../../events/AllTasksCompletedEvent'
import { JobFinalizedEvent } from '../../events/JobFinalizedEvent'
import { FinalizeJobWorkerService } from './FinalizeJobWorkerService'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'mockIdempotencyKey'
const mockJobId = 'mockJobId'
const mockCompleted = true

function buildMockIncomingAllTasksCompletedEvent(): TypeUtilsMutable<AllTasksCompletedEvent> {
  const mockClass: AllTasksCompletedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.ALL_TASKS_COMPLETED_EVENT,
    eventData: {
      jobId: mockJobId,
      completed: mockCompleted,
    },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(mockClass, AllTasksCompletedEvent.prototype)
  return mockClass
}

const mockIncomingAllTasksCompletedEvent = buildMockIncomingAllTasksCompletedEvent()

function buildExpectedJobFinalizedEvent(): TypeUtilsMutable<JobFinalizedEvent> {
  const mockClass = JobFinalizedEvent.fromData({
    jobId: mockJobId,
    finalized: true,
  })
  return Result.getSuccessValueOrThrow(mockClass)
}

const expectedJobFinalizedEvent = buildExpectedJobFinalizedEvent()

/*
 *
 *
 ************************************************************
 * Mock Clients
 ************************************************************/
function buildEventStoreClient_succeeds(): IEventStoreClient {
  return {
    publish: jest.fn().mockResolvedValue(Result.makeSuccess()),
    getEventsByKey: jest.fn().mockResolvedValue(Result.makeSuccess([])),
  }
}

function buildEventStoreClient_fails(
  failureKind?: FailureKind,
  error?: unknown,
  transient?: boolean,
): IEventStoreClient {
  return {
    publish: jest
      .fn()
      .mockResolvedValue(
        Result.makeFailure(failureKind ?? 'UnrecognizedError', error ?? 'UnrecognizedError', transient ?? false),
      ),
    getEventsByKey: jest.fn().mockResolvedValue(Result.makeSuccess([])),
  }
}

describe(`Test Template Service FinalizeJobWorker FinalizeJobWorkerService tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test AllTasksCompletedEvent edge cases
   ************************************************************/
  it(`does not return a Failure if the input AllTasksCompletedEvent is valid`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const result = await finalizeJobWorkerService.finalizeJob(mockIncomingAllTasksCompletedEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      AllTasksCompletedEvent is undefined`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const mockTestEvent = undefined as never
    const result = await finalizeJobWorkerService.finalizeJob(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      AllTasksCompletedEvent is null`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const mockTestEvent = null as never
    const result = await finalizeJobWorkerService.finalizeJob(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      AllTasksCompletedEvent is not an instance of the class`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const mockTestEvent = { ...mockIncomingAllTasksCompletedEvent }
    const result = await finalizeJobWorkerService.finalizeJob(mockTestEvent)
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
  it(`propagates the Failure if JobFinalizedEvent.fromData returns a Failure`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError'
    const mockTransient = 'mockTransient' as never
    const expectedResult = Result.makeFailure(mockFailureKind, mockError, mockTransient)
    jest.spyOn(JobFinalizedEvent, 'fromData').mockReturnValueOnce(expectedResult)
    const result = await finalizeJobWorkerService.finalizeJob(mockIncomingAllTasksCompletedEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  it(`calls EventStoreClient.publish a single time`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    await finalizeJobWorkerService.finalizeJob(mockIncomingAllTasksCompletedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledTimes(1)
  })

  it(`calls EventStoreClient.publish with the expected JobFinalizedEvent`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    await finalizeJobWorkerService.finalizeJob(mockIncomingAllTasksCompletedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledWith(expectedJobFinalizedEvent)
  })

  it(`propagates the Failure if EventStoreClient.publish returns a Failure`, async () => {
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError' as never
    const mockTransient = 'mockTransient' as never
    const mockEventStoreClient = buildEventStoreClient_fails(mockFailureKind, mockError, mockTransient)
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const result = await finalizeJobWorkerService.finalizeJob(mockIncomingAllTasksCompletedEvent)
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
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const finalizeJobWorkerService = new FinalizeJobWorkerService(mockEventStoreClient)
    const result = await finalizeJobWorkerService.finalizeJob(mockIncomingAllTasksCompletedEvent)
    const expectedResult = Result.makeSuccess()
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
