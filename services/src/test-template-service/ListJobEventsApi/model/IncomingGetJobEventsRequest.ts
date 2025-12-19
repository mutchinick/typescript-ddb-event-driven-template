import { z } from 'zod'
import { Failure, Result, Success } from '../../../errors/Result'

export type IncomingGetJobEventsRequestInput = {
  jobId: string
}

type IncomingGetJobEventsRequestProps = {
  jobId: string
}

/**
 *
 */
export class IncomingGetJobEventsRequest implements IncomingGetJobEventsRequestProps {
  /**
   *
   */
  private constructor(public readonly jobId: string) {}

  /**
   *
   */
  public static fromInput(
    incomingGetJobEventsRequestInput: IncomingGetJobEventsRequestInput,
  ): Success<IncomingGetJobEventsRequest> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'IncomingGetJobEventsRequest.fromInput'
    console.info(`${logCtx} init:`, { incomingGetJobEventsRequestInput })

    const propsResult = this.buildProps(incomingGetJobEventsRequestInput)
    if (Result.isFailure(propsResult)) {
      console.error(`${logCtx} exit failure:`, { propsResult, incomingGetJobEventsRequestInput })
      return propsResult
    }

    const { jobId } = propsResult.value
    const incomingGetJobEventsRequest = new IncomingGetJobEventsRequest(jobId)
    const incomingGetJobEventsRequestResult = Result.makeSuccess(incomingGetJobEventsRequest)
    console.info(`${logCtx} exit success:`, { incomingGetJobEventsRequestResult })
    return incomingGetJobEventsRequestResult
  }

  /**
   *
   */
  private static buildProps(
    incomingGetJobEventsRequestInput: IncomingGetJobEventsRequestInput,
  ): Success<IncomingGetJobEventsRequestProps> | Failure<'InvalidArgumentsError'> {
    const inputValidationResult = this.parseValidateInput(incomingGetJobEventsRequestInput)
    if (Result.isFailure(inputValidationResult)) {
      return inputValidationResult
    }

    const { jobId } = incomingGetJobEventsRequestInput
    const props: IncomingGetJobEventsRequestProps = { jobId }
    return Result.makeSuccess(props)
  }

  /**
   *
   */
  private static parseValidateInput(
    input: IncomingGetJobEventsRequestInput,
  ): Success<IncomingGetJobEventsRequestInput> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'IncomingGetJobEventsRequest.parseValidateInput'

    const schema = z.object({
      jobId: z.string().trim().min(1),
    })

    try {
      const validInput = schema.parse(input)
      return Result.makeSuccess(validInput)
    } catch (error) {
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, input })
      return failure
    }
  }
}
