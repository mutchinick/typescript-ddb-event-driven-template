import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Failure, Result, Success } from '../../../errors/Result'
import {
  EventClassMap,
  EventStoreEventBuilder,
  IncomingEventBridgeEvent,
} from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { AllTasksCompletedEvent } from '../../events/AllTasksCompletedEvent'
import { IFinalizeJobWorkerService } from '../FinalizeJobWorkerService/FinalizeJobWorkerService'

export interface IFinalizeJobWorkerController {
  finalizeJobs: (sqsEvent: SQSEvent) => Promise<SQSBatchResponse>
}

const validEventsMap: EventClassMap = {
  [EventStoreEventName.ALL_TASKS_COMPLETED_EVENT]: AllTasksCompletedEvent,
}

/**
 *
 */
export class FinalizeJobWorkerController implements IFinalizeJobWorkerController {
  /**
   *
   */
  constructor(private readonly finalizeJobWorkerService: IFinalizeJobWorkerService) {}

  /**
   *
   */
  public async finalizeJobs(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const logCtx = 'FinalizeJobWorkerController.finalizeJobs'
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
      const finalizeJobResult = await this.finalizeJobSafe(record)
      if (Result.isFailureTransient(finalizeJobResult)) {
        sqsBatchResponse.batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }

    console.info(`${logCtx} exit success:`, { sqsBatchResponse })
    return sqsBatchResponse
  }

  /**
   *
   */
  private async finalizeJobSafe(
    sqsRecord: SQSRecord,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'FinalizeJobWorkerController.finalizeJobSafe'
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
    if (!(incomingEvent instanceof AllTasksCompletedEvent)) {
      const message = `Expected AllTasksCompletedEvent but got ${incomingEvent}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingEvent })
      return failure
    }

    // TypeScript narrows the type after the instanceof check
    const finalizeJobResult = await this.finalizeJobWorkerService.finalizeJob(incomingEvent)
    Result.isFailure(finalizeJobResult)
      ? console.error(`${logCtx} exit failure:`, { finalizeJobResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { finalizeJobResult, incomingEvent })

    return finalizeJobResult
  }

  /**
   *
   */
  private parseInputEvent(sqsRecord: SQSRecord): Success<unknown> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'FinalizeJobWorkerController.parseInputEvent'

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
