import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Failure, Result, Success } from '../../../errors/Result'
import {
  EventClassMap,
  EventStoreEventBuilder,
  IncomingEventBridgeEvent,
} from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { TaskFooExecutedEvent } from '../../events/TaskFooExecutedEvent'
import { TaskQuxExecutedEvent } from '../../events/TaskQuxExecutedEvent'
import { TaskBarExecutedEvent } from '../../events/TaskBarExecutedEvent'
import { ICompleteAllTasksWorkerService } from '../CompleteAllTasksWorkerService/CompleteAllTasksWorkerService'

export interface ICompleteAllTasksWorkerController {
  completeTasks: (sqsEvent: SQSEvent) => Promise<SQSBatchResponse>
}

const validEventsMap: EventClassMap = {
  [EventStoreEventName.TASK_FOO_EXECUTED_EVENT]: TaskFooExecutedEvent,
  [EventStoreEventName.TASK_QUX_EXECUTED_EVENT]: TaskQuxExecutedEvent,
  [EventStoreEventName.TASK_BAR_EXECUTED_EVENT]: TaskBarExecutedEvent,
}

/**
 *
 */
export class CompleteAllTasksWorkerController implements ICompleteAllTasksWorkerController {
  /**
   *
   */
  constructor(private readonly completeAllTasksWorkerService: ICompleteAllTasksWorkerService) {}

  /**
   *
   */
  public async completeTasks(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const logCtx = 'CompleteAllTasksWorkerController.completeTasks'
    console.info(`${logCtx} init:`, { sqsEvent })

    const sqsBatchResponse: SQSBatchResponse = { batchItemFailures: [] }

    if (!sqsEvent || !sqsEvent.Records) {
      const error = new Error(`Expected SQSEvent but got ${sqsEvent}`)
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, sqsEvent })
      return sqsBatchResponse
    }

    for (const record of sqsEvent.Records) {
      // If the failure is transient then we add it to the batch errors to requeue and retry
      // If the failure is non-transient then we ignore it to remove it from the queue
      const completeTaskResult = await this.completeTaskSafe(record)
      if (Result.isFailureTransient(completeTaskResult)) {
        sqsBatchResponse.batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }

    console.info(`${logCtx} exit success:`, { sqsBatchResponse })
    return sqsBatchResponse
  }

  /**
   *
   */
  private async completeTaskSafe(
    sqsRecord: SQSRecord,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'CompleteAllTasksWorkerController.completeTaskSafe'
    console.info(`${logCtx} init:`, { sqsRecord })

    const parseInputEventResult = this.parseInputEvent(sqsRecord)
    if (Result.isFailure(parseInputEventResult)) {
      console.error(`${logCtx} failure exit:`, { parseInputEventResult, sqsRecord })
      return parseInputEventResult
    }

    const unverifiedEvent = parseInputEventResult.value as IncomingEventBridgeEvent
    const incomingEventResult = EventStoreEventBuilder.fromEventBridge(validEventsMap, unverifiedEvent)
    if (Result.isFailure(incomingEventResult)) {
      console.error(`${logCtx} failure exit:`, { incomingEventResult, unverifiedEvent })
      return incomingEventResult
    }

    const incomingEvent = incomingEventResult.value
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

    // TypeScript narrows the type after the instanceof checks
    const completeTaskResult = await this.completeAllTasksWorkerService.completeTask(incomingEvent)
    Result.isFailure(completeTaskResult)
      ? console.error(`${logCtx} exit failure:`, { completeTaskResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { completeTaskResult, incomingEvent })

    return completeTaskResult
  }

  /**
   *
   */
  private parseInputEvent(sqsRecord: SQSRecord): Success<unknown> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'CompleteAllTasksWorkerController.parseInputEvent'

    try {
      const unverifiedEvent = JSON.parse(sqsRecord.body)
      return Result.makeSuccess<unknown>(unverifiedEvent)
    } catch (error) {
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, sqsRecord })
      return failure
    }
  }
}
