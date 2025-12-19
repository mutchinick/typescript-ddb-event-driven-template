import { Failure, Result, Success } from '../../../errors/Result'
import { EventStoreEvent } from '../../../event-store/EventStoreEvent'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { TypeUtilsPretty } from '../../../shared/TypeUtils'
import { IncomingGetJobEventsRequest } from '../model/IncomingGetJobEventsRequest'

export interface IListJobEventsApiService {
  listJobEvents: (
    incomingRequest: IncomingGetJobEventsRequest,
  ) => Promise<Success<ListJobEventsApiServiceOutput> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>>
}

export type ListJobEventsApiServiceOutput = {
  jobId: string
  events: TypeUtilsPretty<EventStoreEvent>[]
}

/**
 *
 */
export class ListJobEventsApiService implements IListJobEventsApiService {
  /**
   *
   */
  constructor(private readonly eventStoreClient: IEventStoreClient) {}

  /**
   *
   */
  public async listJobEvents(
    incomingRequest: IncomingGetJobEventsRequest,
  ): Promise<Success<ListJobEventsApiServiceOutput> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'ListJobEventsApiService.listJobEvents'
    console.info(`${logCtx} init:`, { incomingRequest })

    const inputValidationResult = this.validateInput(incomingRequest)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, incomingRequest })
      return inputValidationResult
    }

    const getEventsResult = await this.getEventsByJobId(incomingRequest)
    if (Result.isFailure(getEventsResult)) {
      console.error(`${logCtx} exit failure:`, { getEventsResult, incomingRequest })
      return getEventsResult
    }

    const events = getEventsResult.value
    const serviceOutput: ListJobEventsApiServiceOutput = {
      jobId: incomingRequest.jobId,
      events: events.map((event) => ({
        idempotencyKey: event.idempotencyKey,
        eventName: event.eventName,
        eventData: event.eventData,
        createdAt: event.createdAt,
      })),
    }
    const serviceOutputResult = Result.makeSuccess(serviceOutput)
    console.info(`${logCtx} exit success:`, { serviceOutputResult, incomingRequest })
    return serviceOutputResult
  }

  /**
   *
   */
  private validateInput(
    incomingRequest: IncomingGetJobEventsRequest,
  ): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'ListJobEventsApiService.validateInput'
    console.info(`${logCtx} init:`, { incomingRequest })

    if (incomingRequest instanceof IncomingGetJobEventsRequest === false) {
      const message = `Expected IncomingGetJobEventsRequest but got ${incomingRequest}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingRequest })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async getEventsByJobId(
    incomingRequest: IncomingGetJobEventsRequest,
  ): Promise<Success<EventStoreEvent[]> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'ListJobEventsApiService.getEventsByJobId'
    console.info(`${logCtx} init:`, { incomingRequest })

    const { jobId } = incomingRequest
    const pk = `EVENTS#jobId:${jobId}`
    const getEventsResult = await this.eventStoreClient.getEventsByKey(pk)
    Result.isFailure(getEventsResult)
      ? console.error(`${logCtx} exit failure:`, { getEventsResult, incomingRequest, pk })
      : console.info(`${logCtx} exit success:`, { getEventsResult, incomingRequest, pk })

    return getEventsResult
  }
}
