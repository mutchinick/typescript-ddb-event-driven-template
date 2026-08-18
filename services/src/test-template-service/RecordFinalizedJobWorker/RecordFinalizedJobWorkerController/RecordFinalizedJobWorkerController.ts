import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda'
import { Failure, Result, Success } from '../../../errors/Result'
import {
  EventClassMap,
  EventStoreEventBuilder,
  IncomingEventBridgeEvent,
} from '../../../event-store/EventStoreEventBuilder'
import { EventStoreEventName } from '../../../event-store/EventStoreEventName'
import { JobFinalizedEvent } from '../../events/JobFinalizedEvent'
import { IRecordFinalizedJobWorkerService } from '../RecordFinalizedJobWorkerService/RecordFinalizedJobWorkerService'

export interface IRecordFinalizedJobWorkerController {
  recordFinalizedJobs: (sqsEvent: SQSEvent) => Promise<SQSBatchResponse>
}

const validEventsMap: EventClassMap = {
  [EventStoreEventName.JOB_FINALIZED_EVENT]: JobFinalizedEvent,
}

/**
 *
 */
export class RecordFinalizedJobWorkerController implements IRecordFinalizedJobWorkerController {
  /**
   *
   */
  constructor(private readonly recordFinalizedJobWorkerService: IRecordFinalizedJobWorkerService) {}

  /**
   *
   */
  public async recordFinalizedJobs(sqsEvent: SQSEvent): Promise<SQSBatchResponse> {
    const logCtx = 'RecordFinalizedJobWorkerController.recordFinalizedJobs'
    console.info(`${logCtx} init:`, { sqsEvent })

    const sqsBatchResponse: SQSBatchResponse = { batchItemFailures: [] }

    if (!sqsEvent || !sqsEvent.Records) {
      const error = new Error(`Expected SQSEvent but got ${sqsEvent}`)
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, sqsEvent })
      return sqsBatchResponse
    }

    for (const record of sqsEvent.Records) {
      // Retry only transient failures via SQS partial batch response.
      const recordFinalizedJobResult = await this.recordFinalizedJobSafe(record)
      if (Result.isFailureTransient(recordFinalizedJobResult)) {
        sqsBatchResponse.batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }

    console.info(`${logCtx} exit success:`, { sqsBatchResponse })
    return sqsBatchResponse
  }

  /**
   *
   */
  private async recordFinalizedJobSafe(
    sqsRecord: SQSRecord,
  ): Promise<
    | Success<void>
    | Failure<'InvalidArgumentsError'>
    | Failure<'DuplicateFinalizedJobError'>
    | Failure<'FinalizedJobWriteError'>
  > {
    const logCtx = 'RecordFinalizedJobWorkerController.recordFinalizedJobSafe'
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
    if (!(incomingEvent instanceof JobFinalizedEvent)) {
      const message = `Expected JobFinalizedEvent but got ${incomingEvent}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingEvent })
      return failure
    }

    const recordFinalizedJobResult = await this.recordFinalizedJobWorkerService.recordFinalizedJob(incomingEvent)
    Result.isFailure(recordFinalizedJobResult)
      ? console.error(`${logCtx} exit failure:`, { recordFinalizedJobResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { recordFinalizedJobResult, incomingEvent })

    return recordFinalizedJobResult
  }

  /**
   *
   */
  private parseInputEvent(sqsRecord: SQSRecord): Success<unknown> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'RecordFinalizedJobWorkerController.parseInputEvent'

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
