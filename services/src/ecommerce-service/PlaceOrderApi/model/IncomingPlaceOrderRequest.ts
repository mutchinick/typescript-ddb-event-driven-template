import { z } from 'zod'
import { Failure, Result, Success } from '../../../errors/Result'

const orderItemInputSchema = z.object({
  productId: z.string().trim().min(6),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
})

const incomingPlaceOrderRequestInputSchema = z.object({
  orderId: z.string().trim().min(6),
  customerId: z.string().trim().min(6),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(orderItemInputSchema).min(1),
})

export type IncomingPlaceOrderRequestInput = z.infer<typeof incomingPlaceOrderRequestInputSchema>

type IncomingPlaceOrderRequestProps = IncomingPlaceOrderRequestInput

/**
 *
 */
export class IncomingPlaceOrderRequest implements IncomingPlaceOrderRequestProps {
  /**
   *
   */
  private constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly currency: string,
    public readonly items: IncomingPlaceOrderRequestInput['items'],
  ) {}

  /**
   *
   */
  public static fromInput(
    incomingPlaceOrderRequestInput: IncomingPlaceOrderRequestInput,
  ): Success<IncomingPlaceOrderRequest> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'IncomingPlaceOrderRequest.fromInput'
    console.info(`${logCtx} init:`, { incomingPlaceOrderRequestInput })

    const propsResult = this.buildProps(incomingPlaceOrderRequestInput)
    if (Result.isFailure(propsResult)) {
      console.error(`${logCtx} exit failure:`, { propsResult, incomingPlaceOrderRequestInput })
      return propsResult
    }

    const { orderId, customerId, currency, items } = propsResult.value
    const incomingPlaceOrderRequest = new IncomingPlaceOrderRequest(orderId, customerId, currency, items)
    const incomingPlaceOrderRequestResult = Result.makeSuccess(incomingPlaceOrderRequest)
    console.info(`${logCtx} exit success:`, { incomingPlaceOrderRequestResult })
    return incomingPlaceOrderRequestResult
  }

  /**
   *
   */
  private static buildProps(
    incomingPlaceOrderRequestInput: IncomingPlaceOrderRequestInput,
  ): Success<IncomingPlaceOrderRequestProps> | Failure<'InvalidArgumentsError'> {
    const inputValidationResult = this.parseValidateInput(incomingPlaceOrderRequestInput)
    if (Result.isFailure(inputValidationResult)) {
      return inputValidationResult
    }

    const props: IncomingPlaceOrderRequestProps = { ...inputValidationResult.value }
    return Result.makeSuccess(props)
  }

  /**
   *
   */
  private static parseValidateInput(
    input: IncomingPlaceOrderRequestInput,
  ): Success<IncomingPlaceOrderRequestInput> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'IncomingPlaceOrderRequest.parseValidateInput'

    try {
      const validInput = incomingPlaceOrderRequestInputSchema.parse(input)
      return Result.makeSuccess(validInput)
    } catch (error) {
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, input })
      return failure
    }
  }
}
