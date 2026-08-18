import { Failure, Result, Success } from '../../../errors/Result'
import { IEventStoreClient } from '../../../event-store/EventStoreClient'
import { TypeUtilsPretty } from '../../../shared/TypeUtils'
import { OrderPlacedEvent, OrderPlacedEventData } from '../../events/OrderPlacedEvent'
import { IncomingPlaceOrderRequest } from '../model/IncomingPlaceOrderRequest'

export interface IPlaceOrderApiService {
  placeOrder: (
    incomingRequest: IncomingPlaceOrderRequest,
  ) => Promise<Success<PlaceOrderApiServiceOutput> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>>
}

export type PlaceOrderApiServiceOutput = TypeUtilsPretty<IncomingPlaceOrderRequest>

/**
 *
 */
export class PlaceOrderApiService implements IPlaceOrderApiService {
  /**
   *
   */
  constructor(private readonly eventStoreClient: IEventStoreClient) {}

  /**
   *
   */
  public async placeOrder(
    incomingRequest: IncomingPlaceOrderRequest,
  ): Promise<Success<PlaceOrderApiServiceOutput> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'PlaceOrderApiService.placeOrder'
    console.info(`${logCtx} init:`, { incomingRequest })

    const inputValidationResult = this.validateInput(incomingRequest)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, incomingRequest })
      return inputValidationResult
    }

    const publishEventResult = await this.publishOrderPlacedEvent(incomingRequest)
    if (Result.isSuccess(publishEventResult)) {
      const serviceOutput: PlaceOrderApiServiceOutput = { ...incomingRequest }
      const serviceOutputResult = Result.makeSuccess(serviceOutput)
      console.info(`${logCtx} exit success:`, { serviceOutputResult, incomingRequest })
      return serviceOutputResult
    }

    if (Result.isFailureOfKind(publishEventResult, 'DuplicateEventError')) {
      const serviceOutput: PlaceOrderApiServiceOutput = { ...incomingRequest }
      const serviceOutputResult = Result.makeSuccess(serviceOutput)
      console.info(`${logCtx} exit success: from-error:`, {
        publishEventResult,
        serviceOutputResult,
        incomingRequest,
      })
      return serviceOutputResult
    }

    console.error(`${logCtx} exit failure:`, { publishEventResult, incomingRequest })
    return publishEventResult
  }

  /**
   *
   */
  private validateInput(incomingRequest: IncomingPlaceOrderRequest): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'PlaceOrderApiService.validateInput'
    console.info(`${logCtx} init:`, { incomingRequest })

    if (incomingRequest instanceof IncomingPlaceOrderRequest === false) {
      const message = `Expected IncomingPlaceOrderRequest but got ${incomingRequest}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, incomingRequest })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async publishOrderPlacedEvent(
    incomingRequest: IncomingPlaceOrderRequest,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'PlaceOrderApiService.publishOrderPlacedEvent'
    console.info(`${logCtx} init:`, { incomingRequest })

    const { orderId, customerId, currency, items } = incomingRequest
    const eventData: OrderPlacedEventData = { orderId, customerId, currency, items, placed: true }
    const buildEventResult = OrderPlacedEvent.fromData(eventData)
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
