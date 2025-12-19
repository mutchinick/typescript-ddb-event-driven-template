import { Failure, Result, Success } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { AllTasksCompletedEvent, AllTasksCompletedEventData } from '../../events/AllTasksCompletedEvent'
import { TaskBarExecutedEvent } from '../../events/TaskBarExecutedEvent'
import { TaskFooExecutedEvent } from '../../events/TaskFooExecutedEvent'
import { TaskQuxExecutedEvent } from '../../events/TaskQuxExecutedEvent'

export interface ICompleteAllTasksWorkerService {
  completeTask: (
    incomingEvent: TaskFooExecutedEvent | TaskQuxExecutedEvent | TaskBarExecutedEvent,
  ) => Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  >
}

/**
 *
 */
export class CompleteAllTasksWorkerService implements ICompleteAllTasksWorkerService {
  /**
   *
   */
  constructor(private readonly eventStoreClient: IEventStoreClient) {}

  /**
   *
   */
  public async completeTask(
    incomingEvent: TaskFooExecutedEvent | TaskQuxExecutedEvent | TaskBarExecutedEvent,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'CompleteAllTasksWorkerService.completeTask'
    console.info(`${logCtx} init:`, { incomingEvent })

    const inputValidationResult = this.validateInput(incomingEvent)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, incomingEvent })
      return inputValidationResult
    }

    const jobId = incomingEvent.eventData.jobId
    const checkAllTasksResult = await this.checkAllTasksCompleted(jobId)
    if (Result.isFailure(checkAllTasksResult)) {
      console.error(`${logCtx} exit failure:`, { checkAllTasksResult, incomingEvent })
      return checkAllTasksResult
    }

    if (!checkAllTasksResult.value) {
      // Not all tasks are completed yet, exit successfully without publishing
      console.info(`${logCtx} exit success: not all tasks completed yet`, { incomingEvent, jobId })
      return Result.makeSuccess()
    }

    const publishEventResult = await this.publishAllTasksCompletedEvent(jobId)
    Result.isFailure(publishEventResult)
      ? console.error(`${logCtx} exit failure:`, { publishEventResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { publishEventResult, incomingEvent })

    return publishEventResult
  }

  /**
   *
   */
  private validateInput(
    incomingEvent: TaskFooExecutedEvent | TaskQuxExecutedEvent | TaskBarExecutedEvent,
  ): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'CompleteAllTasksWorkerService.validateInput'
    console.info(`${logCtx} init:`, { incomingEvent })

    if (
      !(incomingEvent instanceof TaskFooExecutedEvent) &&
      !(incomingEvent instanceof TaskQuxExecutedEvent) &&
      !(incomingEvent instanceof TaskBarExecutedEvent)
    ) {
      const message = `Expected TaskFooExecutedEvent, TaskQuxExecutedEvent, or TaskBarExecutedEvent but got ${incomingEvent}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingEvent })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async checkAllTasksCompleted(
    jobId: string,
  ): Promise<Success<boolean> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'CompleteAllTasksWorkerService.checkAllTasksCompleted'
    console.info(`${logCtx} init:`, { jobId })

    const pk = `EVENTS#jobId:${jobId}`
    const getEventsResult = await this.eventStoreClient.getEventsByKey(pk)
    if (Result.isFailure(getEventsResult)) {
      console.error(`${logCtx} exit failure:`, { getEventsResult, jobId, pk })
      return getEventsResult
    }

    const events = getEventsResult.value

    // TODO: Review EventStoreEvent types - consider typing eventName as EventStoreEventName instead of string
    // This would allow direct enum comparison without type casting
    const requiredCompletionEventNames = [
      EventStoreEventName.TASK_FOO_EXECUTED_EVENT,
      EventStoreEventName.TASK_QUX_EXECUTED_EVENT,
      EventStoreEventName.TASK_BAR_EXECUTED_EVENT,
    ]
    const eventNamesSet = new Set(events.map((event) => event.eventName))
    const allTasksCompleted = requiredCompletionEventNames.every((eventName) => eventNamesSet.has(eventName))

    console.info(`${logCtx} exit success:`, {
      allTasksCompleted,
      requiredCompletionEventNames,
      eventNames: Array.from(eventNamesSet),
      jobId,
    })

    return Result.makeSuccess(allTasksCompleted)
  }

  /**
   *
   */
  private async publishAllTasksCompletedEvent(
    jobId: string,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'CompleteAllTasksWorkerService.publishAllTasksCompletedEvent'
    console.info(`${logCtx} init:`, { jobId })

    const eventData: AllTasksCompletedEventData = { jobId, completed: true }
    const buildEventResult = AllTasksCompletedEvent.fromData(eventData)
    if (Result.isFailure(buildEventResult)) {
      console.error(`${logCtx} exit failure:`, { buildEventResult, eventData })
      return buildEventResult
    }

    const event = buildEventResult.value
    const publishEventResult = await this.eventStoreClient.publish(event)
    Result.isFailure(publishEventResult)
      ? console.error(`${logCtx} exit failure:`, { publishEventResult, event })
      : console.info(`${logCtx} exit success:`, { publishEventResult, event })

    return publishEventResult
  }
}
