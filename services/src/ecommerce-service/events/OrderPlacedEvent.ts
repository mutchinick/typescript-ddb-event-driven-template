import { z } from 'zod'
import { Failure, Result, Success } from '../../errors/Result'
import { EventStoreEvent, EventStoreEventConstructor } from '../../event-store/EventStoreEvent'
import { EventStoreEventName } from '../../event-store/EventStoreEventName'

const orderItemSchema = z.object({
  productId: z.string().trim().min(6),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
})

const dataSchema = z.object({
  orderId: z.string().trim().min(6),
  customerId: z.string().trim().min(6),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(orderItemSchema).min(1),
  placed: z.literal(true),
})

export type OrderPlacedEventData = z.infer<typeof dataSchema>

const eventSchema = z.object({
  eventData: dataSchema,
  idempotencyKey: z.string().trim().min(6),
  createdAt: z.string().datetime(),
})

/**
 *
 */
export class OrderPlacedEvent extends EventStoreEvent<OrderPlacedEventData> {
  public static readonly eventName = EventStoreEventName.ORDER_PLACED_EVENT

  /**
   *
   */
  private constructor(eventData: OrderPlacedEventData, idempotencyKey: string, createdAt: string) {
    super(OrderPlacedEvent.eventName, eventData, idempotencyKey, createdAt)
  }

  /**
   *
   */
  static fromData(eventData: OrderPlacedEventData): Success<OrderPlacedEvent> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'OrderPlacedEvent.fromData'

    try {
      const validData = dataSchema.parse(eventData)
      const idempotencyKey = this.generateIdempotencyKey(validData)
      const event = new OrderPlacedEvent(validData, idempotencyKey, new Date().toISOString())
      const eventResult = Result.makeSuccess(event)
      console.info(`${logCtx} exit success:`, { eventResult, eventData })
      return eventResult
    } catch (error) {
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, eventData })
      return failure
    }
  }

  /**
   *
   */
  private static generateIdempotencyKey(eventData: OrderPlacedEventData): string {
    return `orderId:${eventData.orderId}`
  }

  /**
   *
   */
  static reconstitute(
    eventData: OrderPlacedEventData,
    idempotencyKey: string,
    createdAt: string,
  ): Success<OrderPlacedEvent> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'OrderPlacedEvent.reconstitute'

    try {
      const validEvent = eventSchema.parse({ eventData, idempotencyKey, createdAt })
      const event = new OrderPlacedEvent(validEvent.eventData, idempotencyKey, createdAt)
      const eventResult = Result.makeSuccess(event)
      console.info(`${logCtx} exit success:`, { eventResult, eventData })
      return eventResult
    } catch (error) {
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, eventData })
      return failure
    }
  }
}

const _ConstructorCheck: EventStoreEventConstructor = OrderPlacedEvent
