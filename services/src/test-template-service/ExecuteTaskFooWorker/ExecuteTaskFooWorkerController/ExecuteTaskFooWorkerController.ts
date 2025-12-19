import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Failure, Result, Success } from '../../../errors/Result'
import {
  EventClassMap,
  EventStoreEventBuilder,
  IncomingEventBridgeEvent,
} from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { StepProcessedEvent } from '../../events/StepProcessedEvent'
import { IExecuteTaskFooWorkerService } from '../ExecuteTaskFooWorkerService/ExecuteTaskFooWorkerService'

export interface IExecuteTaskFooWorkerController {
  executeTasks: (sqsEvent: SQSEvent) => Promise<SQSBatchResponse>
}

const validEventsMap: EventClassMap = {
  [EventStoreEventName.STEP_PROCESSED_EVENT]: StepProcessedEvent,
}

/**
 *
 */
export class ExecuteTaskFooWorkerController implements IExecuteTaskFooWorkerController {
  /**
   *
   */
  constructor(private readonly executeTaskFooWorkerService: IExecuteTaskFooWorkerService) {}

  /**
   *
   */
  public async executeTasks(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const logCtx = 'ExecuteTaskFooWorkerController.executeTasks'
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
      const executeTaskResult = await this.executeTaskSafe(record)
      if (Result.isFailureTransient(executeTaskResult)) {
        sqsBatchResponse.batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }

    console.info(`${logCtx} exit success:`, { sqsBatchResponse })
    return sqsBatchResponse
  }

  /**
   *
   */
  private async executeTaskSafe(
    sqsRecord: SQSRecord,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'ExecuteTaskFooWorkerController.executeTaskSafe'
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
    if (!(incomingEvent instanceof StepProcessedEvent)) {
      const message = `Expected StepProcessedEvent but got ${incomingEvent}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingEvent })
      return failure
    }

    // TypeScript narrows the type after the instanceof check
    const executeTaskResult = await this.executeTaskFooWorkerService.executeTask(incomingEvent)
    Result.isFailure(executeTaskResult)
      ? console.error(`${logCtx} exit failure:`, { executeTaskResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { executeTaskResult, incomingEvent })

    return executeTaskResult
  }

  /**
   *
   */
  private parseInputEvent(sqsRecord: SQSRecord): Success<unknown> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'ExecuteTaskFooWorkerController.parseInputEvent'

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
