import { Failure, Result, Success } from '../../../errors/Result'
import { JobFinalizedEvent } from '../../events/JobFinalizedEvent'
import { IFinalizedJobRecordClient } from '../FinalizedJobRecordClient/FinalizedJobRecordClient'

export interface IRecordFinalizedJobWorkerService {
  recordFinalizedJob: (
    incomingEvent: JobFinalizedEvent,
  ) => Promise<
    | Success<void>
    | Failure<'InvalidArgumentsError'>
    | Failure<'DuplicateFinalizedJobError'>
    | Failure<'FinalizedJobWriteError'>
  >
}

/**
 *
 */
export class RecordFinalizedJobWorkerService implements IRecordFinalizedJobWorkerService {
  /**
   *
   */
  constructor(private readonly finalizedJobRecordClient: IFinalizedJobRecordClient) {}

  /**
   *
   */
  public async recordFinalizedJob(
    incomingEvent: JobFinalizedEvent,
  ): Promise<
    | Success<void>
    | Failure<'InvalidArgumentsError'>
    | Failure<'DuplicateFinalizedJobError'>
    | Failure<'FinalizedJobWriteError'>
  > {
    const logCtx = 'RecordFinalizedJobWorkerService.recordFinalizedJob'
    console.info(`${logCtx} init:`, { incomingEvent })

    const inputValidationResult = this.validateInput(incomingEvent)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, incomingEvent })
      return inputValidationResult
    }

    const jobId = incomingEvent.eventData.jobId
    const putFinalizedJobRecordResult = await this.finalizedJobRecordClient.putFinalizedJobRecord(jobId)
    Result.isFailure(putFinalizedJobRecordResult)
      ? console.error(`${logCtx} exit failure:`, { putFinalizedJobRecordResult, incomingEvent })
      : console.info(`${logCtx} exit success:`, { putFinalizedJobRecordResult, incomingEvent })

    return putFinalizedJobRecordResult
  }

  /**
   *
   */
  private validateInput(incomingEvent: JobFinalizedEvent): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'RecordFinalizedJobWorkerService.validateInput'
    console.info(`${logCtx} init:`, { incomingEvent })

    if (incomingEvent instanceof JobFinalizedEvent === false) {
      const message = `Expected JobFinalizedEvent but got ${incomingEvent}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingEvent })
      return failure
    }

    return Result.makeSuccess()
  }
}
