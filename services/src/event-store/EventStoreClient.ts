import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { Failure, Result, Success } from '../errors/Result'
import { EventStoreEvent } from './EventStoreEvent'
import { EventStoreEventData } from './EventStoreEventData'
import { EventStoreEventName } from './EventStoreEventName'

export interface IEventStoreClient {
  publish: (
    event: EventStoreEvent,
  ) => Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  >
  getEventsByKey: (
    pk: string,
  ) => Promise<Success<EventStoreEvent[]> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>>
}

/**
 *
 */
export class EventStoreClient implements IEventStoreClient {
  /**
   *
   */
  constructor(private readonly ddbDocClient: DynamoDBDocumentClient) {}

  /*
   *
   *
   * ========================================================================
   * SECTION: publish method
   * ========================================================================
   *
   */

  /**
   *
   */
  public async publish(
    event: EventStoreEvent,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'EventStoreClient.publish'
    console.info(`${logCtx} init:`)

    const inputValidationResult = this.validatePublishInput(event)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, event })
      return inputValidationResult
    }

    const publishEventResult = await this.executeDdbPublishEvent(event)
    Result.isFailure(publishEventResult)
      ? console.error(`${logCtx} exit failure:`, { publishEventResult, event })
      : console.info(`${logCtx} exit success:`, { publishEventResult, event })

    return publishEventResult
  }

  /**
   *
   */
  private validatePublishInput(event: EventStoreEvent): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'EventStoreClient.validatePublishInput'

    if (event instanceof EventStoreEvent === false) {
      const message = `Expected EventStoreEvent but got ${event}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, event })
      return failure
    }

    if (event.eventData == null) {
      const message = `Expected EventStoreEvent.eventData but got ${event.eventData}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, event })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async executeDdbPublishEvent(
    event: EventStoreEvent,
  ): Promise<
    Success<void> | Failure<'InvalidArgumentsError'> | Failure<'DuplicateEventError'> | Failure<'UnrecognizedError'>
  > {
    const logCtx = 'EventStoreClient.executeDdbPublishEvent'

    let ddbCommand: PutCommand
    try {
      const tableName = process.env.EVENT_STORE_TABLE_NAME

      const { eventName, eventData, createdAt, idempotencyKey } = event

      const pk = `EVENTS#${idempotencyKey}`
      const sk = `EVENTS#${eventName}`
      const _tn = `EVENTS#EVENT`
      const _sn = `EVENTS`
      const gsi1pk = `EVENTS#EVENT`
      const gsi1sk = `CREATED_AT#${createdAt}`

      ddbCommand = new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk,
          idempotencyKey,
          eventName,
          eventData,
          createdAt,
          _tn,
          _sn,
          gsi1pk,
          gsi1sk,
        },
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      })
    } catch (error) {
      console.error(`${logCtx} error caught:`, { error, event })
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, event })
      return failure
    }

    try {
      await this.ddbDocClient.send(ddbCommand)
      const publishEventResult = Result.makeSuccess()
      console.info(`${logCtx} exit success:`, { publishEventResult, ddbCommand })
      return publishEventResult
    } catch (error) {
      console.error(`${logCtx} error caught:`, { error, event })

      if (error instanceof ConditionalCheckFailedException) {
        const duplicationFailure = Result.makeFailure('DuplicateEventError', error, false)
        console.error(`${logCtx} exit failure:`, { duplicationFailure, event })
        return duplicationFailure
      }

      const failure = Result.makeFailure('UnrecognizedError', error, true)
      console.error(`${logCtx} exit failure:`, { failure, event })
      return failure
    }
  }

  /*
   *
   *
   * ========================================================================
   * SECTION: getEventsByKey method
   * ========================================================================
   *
   */

  /**
   *
   */
  public async getEventsByKey(
    pk: string,
  ): Promise<Success<EventStoreEvent[]> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'EventStoreClient.getEventsByKey'
    console.info(`${logCtx} init:`)

    const inputValidationResult = this.validateGetEventsByKeyInput(pk)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, pk })
      return inputValidationResult
    }

    const getEventsResult = await this.executeDdbGetEventsByKey(pk)
    Result.isFailure(getEventsResult)
      ? console.error(`${logCtx} exit failure:`, { getEventsResult, pk })
      : console.info(`${logCtx} exit success:`, { getEventsResult, pk })

    return getEventsResult
  }

  /**
   *
   */
  private validateGetEventsByKeyInput(pk: string): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'EventStoreClient.validateGetEventsByKeyInput'

    if (pk == null || typeof pk !== 'string' || pk.trim().length === 0) {
      const message = `Expected pk but got ${pk}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, pk })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async executeDdbGetEventsByKey(
    pk: string,
  ): Promise<Success<EventStoreEvent[]> | Failure<'InvalidArgumentsError'> | Failure<'UnrecognizedError'>> {
    const logCtx = 'EventStoreClient.executeDdbGetEventsByKey'

    let ddbCommand: QueryCommand
    try {
      const tableName = process.env.EVENT_STORE_TABLE_NAME

      ddbCommand = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': pk,
        },
      })
    } catch (error) {
      console.error(`${logCtx} error building QueryCommand:`, { error, pk })
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, pk })
      return failure
    }

    try {
      const response = await this.ddbDocClient.send(ddbCommand)

      if (!response.Items || response.Items.length === 0) {
        const getEventsResult = Result.makeSuccess<EventStoreEvent[]>([])
        console.info(`${logCtx} exit success:`, { getEventsResult, ddbCommand })
        return getEventsResult
      }

      // Sort by createdAt ascending
      const sortedItems = response.Items.sort((a, b) => {
        const createdAtA = a.createdAt as string
        const createdAtB = b.createdAt as string
        return createdAtA.localeCompare(createdAtB)
      })

      // Transform DynamoDB items to EventStoreEvent objects
      const events: EventStoreEvent[] = sortedItems.map((item) => {
        const event: EventStoreEvent = {
          idempotencyKey: item.idempotencyKey as string,
          eventName: item.eventName as EventStoreEventName,
          eventData: item.eventData as EventStoreEventData,
          createdAt: item.createdAt as string,
        }
        Object.setPrototypeOf(event, EventStoreEvent.prototype)
        return event
      })

      const getEventsResult = Result.makeSuccess(events)
      console.info(`${logCtx} exit success:`, { getEventsResult, ddbCommand })
      return getEventsResult
    } catch (error) {
      console.error(`${logCtx} error executing QueryCommand:`, { error, ddbCommand })
      const unrecognizedFailure = Result.makeFailure('UnrecognizedError', error, true)
      console.error(`${logCtx} exit failure:`, { unrecognizedFailure, ddbCommand })
      return unrecognizedFailure
    }
  }
}
