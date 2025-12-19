import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { StepProcessedEvent } from '../../events/StepProcessedEvent'
import { TaskBarExecutedEvent } from '../../events/TaskBarExecutedEvent'
import { ExecuteTaskBarWorkerService } from './ExecuteTaskBarWorkerService'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'mockIdempotencyKey'
const mockJobId = 'mockJobId'
const mockProcessed = true

function buildMockIncomingStepProcessedEvent(): TypeUtilsMutable<StepProcessedEvent> {
  const mockClass: StepProcessedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.STEP_PROCESSED_EVENT,
    eventData: {
      jobId: mockJobId,
      processed: mockProcessed,
    },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(mockClass, StepProcessedEvent.prototype)
  return mockClass
}

const mockIncomingStepProcessedEvent = buildMockIncomingStepProcessedEvent()

function buildExpectedTaskBarExecutedEvent(): TypeUtilsMutable<TaskBarExecutedEvent> {
  const mockClass = TaskBarExecutedEvent.fromData({
    jobId: mockJobId,
    executed: true,
  })
  return Result.getSuccessValueOrThrow(mockClass)
}

const expectedTaskBarExecutedEvent = buildExpectedTaskBarExecutedEvent()

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

describe(`Test Template Service ExecuteTaskBarWorker ExecuteTaskBarWorkerService tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test StepProcessedEvent edge cases
   ************************************************************/
  it(`does not return a Failure if the input StepProcessedEvent is valid`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const result = await executeTaskBarWorkerService.executeTask(mockIncomingStepProcessedEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      StepProcessedEvent is undefined`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const mockTestEvent = undefined as never
    const result = await executeTaskBarWorkerService.executeTask(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      StepProcessedEvent is null`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const mockTestEvent = null as never
    const result = await executeTaskBarWorkerService.executeTask(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      StepProcessedEvent is not an instance of the class`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const mockTestEvent = { ...mockIncomingStepProcessedEvent }
    const result = await executeTaskBarWorkerService.executeTask(mockTestEvent)
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
  it(`propagates the Failure if TaskBarExecutedEvent.fromData returns a Failure`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError'
    const mockTransient = 'mockTransient' as never
    const expectedResult = Result.makeFailure(mockFailureKind, mockError, mockTransient)
    jest.spyOn(TaskBarExecutedEvent, 'fromData').mockReturnValueOnce(expectedResult)
    const result = await executeTaskBarWorkerService.executeTask(mockIncomingStepProcessedEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  it(`calls EventStoreClient.publish a single time`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    await executeTaskBarWorkerService.executeTask(mockIncomingStepProcessedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledTimes(1)
  })

  it(`calls EventStoreClient.publish with the expected TaskBarExecutedEvent`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds()
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    await executeTaskBarWorkerService.executeTask(mockIncomingStepProcessedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledWith(expectedTaskBarExecutedEvent)
  })

  it(`propagates the Failure if EventStoreClient.publish returns a Failure`, async () => {
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError' as never
    const mockTransient = 'mockTransient' as never
    const mockEventStoreClient = buildEventStoreClient_fails(mockFailureKind, mockError, mockTransient)
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const result = await executeTaskBarWorkerService.executeTask(mockIncomingStepProcessedEvent)
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
    const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(mockEventStoreClient)
    const result = await executeTaskBarWorkerService.executeTask(mockIncomingStepProcessedEvent)
    const expectedResult = Result.makeSuccess()
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
