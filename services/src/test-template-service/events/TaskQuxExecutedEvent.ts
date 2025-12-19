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

export type TaskQuxExecutedEventData = z.infer<typeof dataSchema>

const eventSchema = z.object({
  eventData: dataSchema,
  idempotencyKey: z.string().trim().min(6),
  createdAt: z.string().datetime(),
})

/**
 *
 */
export class TaskQuxExecutedEvent extends EventStoreEvent<TaskQuxExecutedEventData> {
  public static readonly eventName = EventStoreEventName.TASK_QUX_EXECUTED_EVENT

  /**
   *
   */
  private constructor(eventData: TaskQuxExecutedEventData, idempotencyKey: string, createdAt: string) {
    super(TaskQuxExecutedEvent.eventName, eventData, idempotencyKey, createdAt)
  }

  /**
   *
   */
  static fromData(
    eventData: TaskQuxExecutedEventData,
  ): Success<TaskQuxExecutedEvent> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'TaskQuxExecutedEvent.fromData'

    try {
      const validData = dataSchema.parse(eventData)
      const idempotencyKey = this.generateIdempotencyKey(validData)
      const event = new TaskQuxExecutedEvent(validData, idempotencyKey, new Date().toISOString())
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
  private static generateIdempotencyKey(eventData: TaskQuxExecutedEventData): string {
    return `jobId:${eventData.jobId}`
  }

  /**
   *
   */
  static reconstitute(
    eventData: TaskQuxExecutedEventData,
    idempotencyKey: string,
    createdAt: string,
  ): Success<TaskQuxExecutedEvent> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'TaskQuxExecutedEvent.reconstitute'

    try {
      const validEvent = eventSchema.parse({ eventData, idempotencyKey, createdAt })
      const event = new TaskQuxExecutedEvent(validEvent.eventData, idempotencyKey, createdAt)
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
const _ConstructorCheck: EventStoreEventConstructor = TaskQuxExecutedEvent
