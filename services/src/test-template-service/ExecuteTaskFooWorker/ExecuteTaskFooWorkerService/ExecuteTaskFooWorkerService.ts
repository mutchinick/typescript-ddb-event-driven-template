import { Failure, Result, Success } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { StepProcessedEvent } from '../../events/StepProcessedEvent'
import { TaskFooExecutedEvent, TaskFooExecutedEventData } from '../../events/TaskFooExecutedEvent'

export interface IExecuteTaskFooWorkerService {
  executeTask: (
    incomingEvent: StepProcessedEvent,
  ) => Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  >
}

/**
 *
 */
export class ExecuteTaskFooWorkerService implements IExecuteTaskFooWorkerService {
  /**
   *
   */
  constructor(private readonly eventStoreClient: IEventStoreClient) {}

  /**
   *
   */
  public async executeTask(
    incomingEvent: StepProcessedEvent,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'ExecuteTaskFooWorkerService.executeTask'
    console.info(`${logCtx} init:`, { incomingEvent })

    const inputValidationResult = this.validateInput(incomingEvent)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, incomingEvent })
      return inputValidationResult
    }

    const jobId = incomingEvent.eventData.jobId
    const publishEventResult = await this.publishTaskExecutedEvent(jobId)
    Result.isFailure(publishEventResult)
      ? console.error(`${logCtx} exit failure:`, { publishEventResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { publishEventResult, incomingEvent })

    return publishEventResult
  }

  /**
   *
   */
  private validateInput(incomingEvent: StepProcessedEvent): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'ExecuteTaskFooWorkerService.validateInput'
    console.info(`${logCtx} init:`, { incomingEvent })

    if (incomingEvent instanceof StepProcessedEvent === false) {
      const message = `Expected StepProcessedEvent but got ${incomingEvent}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingEvent })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async publishTaskExecutedEvent(
    jobId: string,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'ExecuteTaskFooWorkerService.publishTaskExecutedEvent'
    console.info(`${logCtx} init:`, { jobId })

    const eventData: TaskFooExecutedEventData = { jobId, executed: true }
    const buildEventResult = TaskFooExecutedEvent.fromData(eventData)
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
