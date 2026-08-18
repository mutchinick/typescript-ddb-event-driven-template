import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { Failure, Result, Success } from '../../../errors/Result'
import { HttpResponse } from '../../../shared/HttpResponse'
import { IPlaceOrderApiService } from '../PlaceOrderApiService/PlaceOrderApiService'
import { IncomingPlaceOrderRequest, IncomingPlaceOrderRequestInput } from '../model/IncomingPlaceOrderRequest'

export interface IPlaceOrderApiController {
  placeOrder: (apiEvent: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>
}

/**
 *
 */
export class PlaceOrderApiController implements IPlaceOrderApiController {
  /**
   *
   */
  constructor(private readonly placeOrderApiService: IPlaceOrderApiService) {}

  /**
   *
   */
  public async placeOrder(apiEvent: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logCtx = 'PlaceOrderApiController.placeOrder'
    console.info(`${logCtx} init:`, { apiEvent })

    const placeOrderResult = await this.placeOrderSafe(apiEvent)
    if (Result.isSuccess(placeOrderResult)) {
      const placeOrderOutput = placeOrderResult.value
      const successResponse = HttpResponse.Accepted(placeOrderOutput)
      console.info(`${logCtx} exit success:`, { successResponse, apiEvent })
      return successResponse
    }

    if (Result.isFailureOfKind(placeOrderResult, 'InvalidArgumentsError')) {
      const badRequestError = HttpResponse.BadRequestError()
      console.error(`${logCtx} failure exit:`, { badRequestError, apiEvent })
      return badRequestError
    }

    const internalServerError = HttpResponse.InternalServerError()
    console.error(`${logCtx} failure exit:`, { internalServerError, apiEvent })
    return internalServerError
  }

  /**
   *
   */
  private async placeOrderSafe(
    apiEvent: APIGatewayProxyEventV2,
  ): Promise<Success<IncomingPlaceOrderRequest> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'PlaceOrderApiController.placeOrderSafe'
    console.info(`${logCtx} init:`, { apiEvent })

    const parseInputRequestResult = this.parseInputRequest(apiEvent)
    if (Result.isFailure(parseInputRequestResult)) {
      console.error(`${logCtx} failure exit:`, { parseInputRequestResult, apiEvent })
      return parseInputRequestResult
    }

    const unverifiedRequest = parseInputRequestResult.value as IncomingPlaceOrderRequestInput
    const incomingPlaceOrderRequestResult = IncomingPlaceOrderRequest.fromInput(unverifiedRequest)
    if (Result.isFailure(incomingPlaceOrderRequestResult)) {
      console.error(`${logCtx} failure exit:`, { incomingPlaceOrderRequestResult, unverifiedRequest })
      return incomingPlaceOrderRequestResult
    }

    const incomingPlaceOrderRequest = incomingPlaceOrderRequestResult.value
    const placeOrderResult = await this.placeOrderApiService.placeOrder(incomingPlaceOrderRequest)
    Result.isFailure(placeOrderResult)
      ? console.error(`${logCtx} exit failure:`, { placeOrderResult, incomingPlaceOrderRequest })
      : console.info(`${logCtx} exit success:`, { placeOrderResult, incomingPlaceOrderRequest })

    return placeOrderResult
  }

  /**
   *
   */
  private parseInputRequest(apiEvent: APIGatewayProxyEventV2): Success<unknown> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'PlaceOrderApiController.parseInputRequest'

    try {
      const unverifiedRequest = JSON.parse(apiEvent.body!)
      return Result.makeSuccess<unknown>(unverifiedRequest)
    } catch (error) {
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, apiEvent })
      return failure
    }
  }
}
