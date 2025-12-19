import { z } from 'zod'
import { Failure, Result, Success } from '../../errors/Result'
import { EventStoreEvent, EventStoreEventConstructor } from '../../event-store/EventStoreEvent'
import { EventStoreEventName } from '../../event-store/EventStoreEventName'

/**
 *
 */
const dataSchema = z.object({
  jobId: z.string().trim().min(6),
  executed: z.literal(true),
})

export type TaskBarExecutedEventData = z.infer<typeof dataSchema>

const eventSchema = z.object({
  eventData: dataSchema,
  idempotencyKey: z.string().trim().min(6),
  createdAt: z.string().datetime(),
})

/**
 *
 */
export class TaskBarExecutedEvent extends EventStoreEvent<TaskBarExecutedEventData> {
  public static readonly eventName = EventStoreEventName.TASK_BAR_EXECUTED_EVENT

  /**
   *
   */
  private constructor(eventData: TaskBarExecutedEventData, idempotencyKey: string, createdAt: string) {
    super(TaskBarExecutedEvent.eventName, eventData, idempotencyKey, createdAt)
  }

  /**
   *
   */
  static fromData(
    eventData: TaskBarExecutedEventData,
  ): Success<TaskBarExecutedEvent> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'TaskBarExecutedEvent.fromData'

    try {
      const validData = dataSchema.parse(eventData)
      const idempotencyKey = this.generateIdempotencyKey(validData)
      const event = new TaskBarExecutedEvent(validData, idempotencyKey, new Date().toISOString())
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
  private static generateIdempotencyKey(eventData: TaskBarExecutedEventData): string {
    return `jobId:${eventData.jobId}`
  }

  /**
   *
   */
  static reconstitute(
    eventData: TaskBarExecutedEventData,
    idempotencyKey: string,
    createdAt: string,
  ): Success<TaskBarExecutedEvent> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'TaskBarExecutedEvent.reconstitute'

    try {
      const validEvent = eventSchema.parse({ eventData, idempotencyKey, createdAt })
      const event = new TaskBarExecutedEvent(validEvent.eventData, idempotencyKey, createdAt)
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

/**
 * This check ensures the class adheres to the static contract defined
 * by EventStoreEventConstructor. It will cause a compile-time error if
 * fromData or reconstitute are missing or have the wrong signature.
 */
const _ConstructorCheck: EventStoreEventConstructor = TaskBarExecutedEvent
