import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { Failure, Result, Success } from '../../../errors/Result'
import { HttpResponse } from '../../../shared/HttpResponse'
import { IListJobEventsApiService } from '../ListJobEventsApiService/ListJobEventsApiService'
import { IncomingGetJobEventsRequest, IncomingGetJobEventsRequestInput } from '../model/IncomingGetJobEventsRequest'

export interface IListJobEventsApiController {
  listJobEvents: (apiEvent: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>
}

/**
 *
 */
export class ListJobEventsApiController implements IListJobEventsApiController {
  /**
   *
   */
  constructor(private readonly listJobEventsApiService: IListJobEventsApiService) {}

  /**
   *
   */
  public async listJobEvents(apiEvent: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logCtx = 'ListJobEventsApiController.listJobEvents'
    console.info(`${logCtx} init:`, { apiEvent })

    const listJobEventsResult = await this.listJobEventsSafe(apiEvent)
    if (Result.isSuccess(listJobEventsResult)) {
      const listJobEventsOutput = listJobEventsResult.value
      const successResponse = HttpResponse.OK(listJobEventsOutput)
      console.info(`${logCtx} exit success:`, { successResponse, apiEvent })
      return successResponse
    }

    if (Result.isFailureOfKind(listJobEventsResult, 'InvalidArgumentsError')) {
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
  private async listJobEventsSafe(
    apiEvent: APIGatewayProxyEventV2,
  ): Promise<Success<IncomingGetJobEventsRequest> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'ListJobEventsApiController.listJobEventsSafe'
    console.info(`${logCtx} init:`, { apiEvent })

    const parseInputRequestResult = this.parseInputRequest(apiEvent)
    if (Result.isFailure(parseInputRequestResult)) {
      console.error(`${logCtx} failure exit:`, { parseInputRequestResult, apiEvent })
      return parseInputRequestResult
    }

    const unverifiedRequest = parseInputRequestResult.value as IncomingGetJobEventsRequestInput
    const incomingGetJobEventsRequestResult = IncomingGetJobEventsRequest.fromInput(unverifiedRequest)
    if (Result.isFailure(incomingGetJobEventsRequestResult)) {
      console.error(`${logCtx} failure exit:`, { incomingGetJobEventsRequestResult, unverifiedRequest })
      return incomingGetJobEventsRequestResult
    }

    const incomingGetJobEventsRequest = incomingGetJobEventsRequestResult.value
    const listJobEventsResult = await this.listJobEventsApiService.listJobEvents(incomingGetJobEventsRequest)
    Result.isFailure(listJobEventsResult)
      ? console.error(`${logCtx} exit failure:`, { listJobEventsResult, incomingGetJobEventsRequest })
      : console.info(`${logCtx} exit success:`, { listJobEventsResult, incomingGetJobEventsRequest })

    return listJobEventsResult
  }

  /**
   *
   */
  private parseInputRequest(apiEvent: APIGatewayProxyEventV2): Success<unknown> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'ListJobEventsApiController.parseInputRequest'

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
