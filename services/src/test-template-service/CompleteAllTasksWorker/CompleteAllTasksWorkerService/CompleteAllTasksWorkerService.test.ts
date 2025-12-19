import { FailureKind } from '../../../errors/FailureKind'
import { Result } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { TypeUtilsMutable } from '../../../shared/TypeUtils'
import { TaskFooExecutedEvent } from '../../events/TaskFooExecutedEvent'
import { TaskQuxExecutedEvent } from '../../events/TaskQuxExecutedEvent'
import { TaskBarExecutedEvent } from '../../events/TaskBarExecutedEvent'
import { AllTasksCompletedEvent } from '../../events/AllTasksCompletedEvent'
import { CompleteAllTasksWorkerService } from './CompleteAllTasksWorkerService'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockIdempotencyKey = 'jobId:mockJobId'
const mockJobId = 'mockJobId'
const mockExecuted = true

function buildMockIncomingTaskFooExecutedEvent(): TypeUtilsMutable<TaskFooExecutedEvent> {
  const mockClass: TaskFooExecutedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_FOO_EXECUTED_EVENT,
    eventData: {
      jobId: mockJobId,
      executed: mockExecuted,
    },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(mockClass, TaskFooExecutedEvent.prototype)
  return mockClass
}

function buildMockIncomingTaskQuxExecutedEvent(): TypeUtilsMutable<TaskQuxExecutedEvent> {
  const mockClass: TaskQuxExecutedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_QUX_EXECUTED_EVENT,
    eventData: {
      jobId: mockJobId,
      executed: mockExecuted,
    },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(mockClass, TaskQuxExecutedEvent.prototype)
  return mockClass
}

function buildMockIncomingTaskBarExecutedEvent(): TypeUtilsMutable<TaskBarExecutedEvent> {
  const mockClass: TaskBarExecutedEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_BAR_EXECUTED_EVENT,
    eventData: {
      jobId: mockJobId,
      executed: mockExecuted,
    },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(mockClass, TaskBarExecutedEvent.prototype)
  return mockClass
}

const mockIncomingTaskFooExecutedEvent = buildMockIncomingTaskFooExecutedEvent()
const mockIncomingTaskQuxExecutedEvent = buildMockIncomingTaskQuxExecutedEvent()
const mockIncomingTaskBarExecutedEvent = buildMockIncomingTaskBarExecutedEvent()

function buildExpectedAllTasksCompletedEvent(): TypeUtilsMutable<AllTasksCompletedEvent> {
  const mockClass = AllTasksCompletedEvent.fromData({
    jobId: mockJobId,
    completed: true,
  })
  return Result.getSuccessValueOrThrow(mockClass)
}

const expectedAllTasksCompletedEvent = buildExpectedAllTasksCompletedEvent()

function buildMockEventStoreEvents(allTasksPresent: boolean): EventStoreEvent[] {
  const taskFooEvent: EventStoreEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_FOO_EXECUTED_EVENT,
    eventData: { jobId: mockJobId, executed: true },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(taskFooEvent, EventStoreEvent.prototype)

  const taskQuxEvent: EventStoreEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_QUX_EXECUTED_EVENT,
    eventData: { jobId: mockJobId, executed: true },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(taskQuxEvent, EventStoreEvent.prototype)

  const taskBarEvent: EventStoreEvent = {
    idempotencyKey: mockIdempotencyKey,
    eventName: EventStoreEventName.TASK_BAR_EXECUTED_EVENT,
    eventData: { jobId: mockJobId, executed: true },
    createdAt: mockDate,
  }
  Object.setPrototypeOf(taskBarEvent, EventStoreEvent.prototype)

  if (allTasksPresent) {
    return [taskFooEvent, taskQuxEvent, taskBarEvent]
  } else {
    // Return only TaskFoo and TaskQux, missing TaskBar
    return [taskFooEvent, taskQuxEvent]
  }
}

/*
 *
 *
 ************************************************************
 * Mock Clients
 ************************************************************/
function buildEventStoreClient_succeeds(allTasksPresent: boolean = true): IEventStoreClient {
  return {
    publish: jest.fn().mockResolvedValue(Result.makeSuccess()),
    getEventsByKey: jest.fn().mockResolvedValue(Result.makeSuccess(buildMockEventStoreEvents(allTasksPresent))),
  }
}

function buildEventStoreClient_getEventsByKeyFails(
  failureKind?: FailureKind,
  error?: unknown,
  transient?: boolean,
): IEventStoreClient {
  return {
    publish: jest.fn().mockResolvedValue(Result.makeSuccess()),
    getEventsByKey: jest
      .fn()
      .mockResolvedValue(
        Result.makeFailure(failureKind ?? 'UnrecognizedError', error ?? 'UnrecognizedError', transient ?? false),
      ),
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

describe(`Test Template Service CompleteAllTasksWorker CompleteAllTasksWorkerService tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test input edge cases
   ************************************************************/
  it(`does not return a Failure if the input TaskFooExecutedEvent is valid`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`does not return a Failure if the input TaskQuxExecutedEvent is valid`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskQuxExecutedEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`does not return a Failure if the input TaskBarExecutedEvent is valid`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskBarExecutedEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input event
      is undefined`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const mockTestEvent = undefined as never
    const result = await completeAllTasksWorkerService.completeTask(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input event
      is null`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const mockTestEvent = null as never
    const result = await completeAllTasksWorkerService.completeTask(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input event
      is not an instance of any task event class`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const mockTestEvent = { ...mockIncomingTaskFooExecutedEvent }
    const result = await completeAllTasksWorkerService.completeTask(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  /*
   *
   *
   ************************************************************
   * Test reading events from the event store
   ************************************************************/
  it(`calls EventStoreClient.getEventsByKey a single time`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(mockEventStoreClient.getEventsByKey).toHaveBeenCalledTimes(1)
  })

  it(`calls EventStoreClient.getEventsByKey with the expected pk`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    const expectedPk = `EVENTS#jobId:${mockJobId}`
    expect(mockEventStoreClient.getEventsByKey).toHaveBeenCalledWith(expectedPk)
  })

  it(`propagates the Failure if EventStoreClient.getEventsByKey returns a Failure`, async () => {
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError' as never
    const mockTransient = 'mockTransient' as never
    const mockEventStoreClient = buildEventStoreClient_getEventsByKeyFails(mockFailureKind, mockError, mockTransient)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    const expectedResult = Result.makeFailure(mockFailureKind, mockError, mockTransient)
    expect(Result.isFailure(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  /*
   *
   *
   ************************************************************
   * Test all tasks completion logic
   ************************************************************/
  it(`does not call EventStoreClient.publish if not all three task events are present`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(false) // Only 2 tasks present
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(mockEventStoreClient.publish).not.toHaveBeenCalled()
  })

  it(`returns Success<void> without publishing if not all three task events are
      present`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(false) // Only 2 tasks present
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(Result.isSuccess(result)).toBe(true)
    expect(mockEventStoreClient.publish).not.toHaveBeenCalled()
  })

  it(`calls EventStoreClient.publish a single time if all three task events are
      present`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true) // All 3 tasks present
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledTimes(1)
  })

  it(`calls EventStoreClient.publish with the expected AllTasksCompletedEvent if all
      three task events are present`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true) // All 3 tasks present
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(mockEventStoreClient.publish).toHaveBeenCalledWith(expectedAllTasksCompletedEvent)
  })

  it(`propagates the Failure if AllTasksCompletedEvent.fromData returns a Failure`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError'
    const mockTransient = 'mockTransient' as never
    const expectedResult = Result.makeFailure(mockFailureKind, mockError, mockTransient)
    jest.spyOn(AllTasksCompletedEvent, 'fromData').mockReturnValueOnce(expectedResult)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  it(`propagates the Failure if EventStoreClient.publish returns a Failure`, async () => {
    const mockFailureKind = 'mockFailureKind' as never
    const mockError = 'mockError' as never
    const mockTransient = 'mockTransient' as never
    const mockEventStoreClient = buildEventStoreClient_fails(mockFailureKind, mockError, mockTransient)
    // Override getEventsByKey to return all tasks
    mockEventStoreClient.getEventsByKey = jest
      .fn()
      .mockResolvedValue(Result.makeSuccess(buildMockEventStoreEvents(true)))
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
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
  it(`returns the expected Success<void> if all three task events are present and
      execution is successful`, async () => {
    const mockEventStoreClient = buildEventStoreClient_succeeds(true)
    const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(mockEventStoreClient)
    const result = await completeAllTasksWorkerService.completeTask(mockIncomingTaskFooExecutedEvent)
    const expectedResult = Result.makeSuccess()
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
