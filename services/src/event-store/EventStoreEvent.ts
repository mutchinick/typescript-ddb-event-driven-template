import { Failure, Success } from '../errors/Result'
import { EventStoreEventData } from './EventStoreEventData'
import { EventStoreEventName } from './EventStoreEventName'

/**
 *
 */
export abstract class EventStoreEvent<TEventStoreData extends EventStoreEventData = EventStoreEventData> {
  public readonly idempotencyKey: string
  public readonly eventName: EventStoreEventName
  public readonly eventData: TEventStoreData
  public readonly createdAt: string

  /**
   *
   */
  protected constructor(
    eventName: EventStoreEventName,
    eventData: TEventStoreData,
    idempotencyKey: string,
    createdAt: string,
  ) {
    this.idempotencyKey = idempotencyKey
    this.eventName = eventName
    this.eventData = eventData
    this.createdAt = createdAt
  }
}

/**
 *
 */
export interface EventStoreEventConstructor {
  fromData(eventData: EventStoreEventData): Success<EventStoreEvent> | Failure<'InvalidArgumentsError'>

  reconstitute(
    eventData: EventStoreEventData,
    idempotencyKey: string,
    createdAt: string,
  ): Success<EventStoreEvent> | Failure<'InvalidArgumentsError'>
}
