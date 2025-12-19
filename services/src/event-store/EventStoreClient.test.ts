import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { Result } from '../errors/Result'
import { TypeUtilsMutable } from '../shared/TypeUtils'
import { EventStoreClient } from './EventStoreClient'
import { EventStoreEvent } from './EventStoreEvent'
import { EventStoreEventName } from './EventStoreEventName'

const mockEventStoreTableName = 'mockEventStoreTableName'

process.env.EVENT_STORE_TABLE_NAME = mockEventStoreTableName

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

function buildMockEventStoreEvent(): EventStoreEvent {
  const mockClass = {
    eventName: 'mockEventName' as unknown as EventStoreEventName,
    idempotencyKey: 'mockIdempotencyKey',
    eventData: {
      foo: 'bar',
      baz: 42,
      qux: [1, 2, 3],
    },
    createdAt: new Date().toISOString(),
  }
  Object.setPrototypeOf(mockClass, EventStoreEvent.prototype)
  return mockClass as unknown as EventStoreEvent
}

const mockEventStoreEvent = buildMockEventStoreEvent()

function buildMockDdbCommand(): PutCommand {
  const ddbCommand = new PutCommand({
    TableName: mockEventStoreTableName,
    Item: {
      pk: `EVENTS#${mockEventStoreEvent.idempotencyKey}`,
      sk: `EVENTS#${mockEventStoreEvent.eventName}`,
      idempotencyKey: mockEventStoreEvent.idempotencyKey,
      _tn: `EVENTS#EVENT`,
      _sn: `EVENTS`,
      eventName: mockEventStoreEvent.eventName,
      eventData: { ...mockEventStoreEvent.eventData },
      createdAt: mockEventStoreEvent.createdAt,
      gsi1pk: `EVENTS#EVENT`,
      gsi1sk: `CREATED_AT#${mockEventStoreEvent.createdAt}`,
    },
    ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
  })
  return ddbCommand
}

const expectedDdbCommand = buildMockDdbCommand()

/*
 *
 *
 ************************************************************
 * Mock clients
 ************************************************************/
function buildMockDdbDocClient_resolves(): DynamoDBDocumentClient {
  return { send: jest.fn() } as unknown as DynamoDBDocumentClient
}

function buildMockDdbDocClient_throws(error?: unknown): DynamoDBDocumentClient {
  return { send: jest.fn().mockRejectedValue(error ?? new Error()) } as unknown as DynamoDBDocumentClient
}

describe(`Events EventStoreClient tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test EventStoreEvent edge cases
   ************************************************************/
  it(`does not return a Failure if the input EventStoreEvent is valid`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const result = await eventStoreClient.publish(mockEventStoreEvent as unknown as EventStoreEvent)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      EventStoreEvent is undefined`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const mockTestEvent = undefined as never
    const result = await eventStoreClient.publish(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      EventStoreEvent is null`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const mockTestEvent = null as never
    const result = await eventStoreClient.publish(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      EventStoreEvent is not an instance of the class`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const { idempotencyKey, eventName, eventData, createdAt } = mockEventStoreEvent
    const result = await eventStoreClient.publish({ idempotencyKey, eventName, eventData, createdAt } as never)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  /*
   *
   *
   ************************************************************
   * Test EventStoreEvent.eventData edge cases
   ************************************************************/
  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      EventStoreEvent.eventData is undefined`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const mockTestEvent = buildMockEventStoreEvent()
    ;(mockTestEvent.eventData as TypeUtilsMutable<EventStoreEvent>) = undefined as never
    const result = await eventStoreClient.publish(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      EventStoreEvent.eventData is null`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const mockTestEvent = buildMockEventStoreEvent()
    ;(mockTestEvent.eventData as TypeUtilsMutable<EventStoreEvent>) = null as never
    const result = await eventStoreClient.publish(mockTestEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  /*
   *
   *
   ************************************************************
   * Test internal logic
   ************************************************************/
  it(`calls DynamoDBDocumentClient.send a single time`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    await eventStoreClient.publish(mockEventStoreEvent)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDdbDocClient.send).toHaveBeenCalledTimes(1)
  })

  it(`calls DynamoDBDocumentClient.send with the expected input`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    await eventStoreClient.publish(mockEventStoreEvent)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDdbDocClient.send).toHaveBeenCalledWith(expect.objectContaining({ input: expectedDdbCommand.input }))
  })

  it(`returns a transient Failure of kind UnrecognizedError if
      DynamoDBDocumentClient.send throws an unrecognized Error`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_throws()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const result = await eventStoreClient.publish(mockEventStoreEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'UnrecognizedError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(true)
  })

  it(`returns a non-transient Failure of kind DuplicateEventRaisedError if
      DynamoDBDocumentClient.send throws a ConditionalCheckFailedException`, async () => {
    const mockError = new ConditionalCheckFailedException({ $metadata: {}, message: 'ConditionalCheckFailed' })
    const mockDdbDocClient = buildMockDdbDocClient_throws(mockError)
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const result = await eventStoreClient.publish(mockEventStoreEvent)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'DuplicateEventError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  /*
   *
   *
   ************************************************************
   * Test expected result
   ************************************************************/
  it(`returns the expected Success<void> if the execution path is successful`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const eventStoreClient = new EventStoreClient(mockDdbDocClient)
    const result = await eventStoreClient.publish(mockEventStoreEvent)
    const expectedResult = Result.makeSuccess()
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })

  /*
   *
   *
   ************************************************************
   * Test getEventsByKey
   ************************************************************/
  describe(`Test EventStoreClient.getEventsByKey`, () => {
    const mockPk = `EVENTS#${mockEventStoreEvent.idempotencyKey}`

    function buildMockQueryCommand(): QueryCommand {
      const queryCommand = new QueryCommand({
        TableName: mockEventStoreTableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': mockPk,
        },
      })
      return queryCommand
    }

    const expectedQueryCommand = buildMockQueryCommand()

    function buildMockDdbDocClient_resolvesWithItems(items: unknown[]): DynamoDBDocumentClient {
      return {
        send: jest.fn().mockResolvedValue({
          Items: items,
        }),
      } as unknown as DynamoDBDocumentClient
    }

    /*
     *
     *
     ************************************************************
     * Test pk edge cases
     ************************************************************/
    it(`does not return a Failure if the input pk is valid`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolvesWithItems([])
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const result = await eventStoreClient.getEventsByKey(mockPk)
      expect(Result.isFailure(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input pk is
        undefined`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolves()
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const mockTestPk = undefined as never
      const result = await eventStoreClient.getEventsByKey(mockTestPk)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input pk is
        null`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolves()
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const mockTestPk = null as never
      const result = await eventStoreClient.getEventsByKey(mockTestPk)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input pk is
        empty`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolves()
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const mockTestPk = ''
      const result = await eventStoreClient.getEventsByKey(mockTestPk)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input pk is
        blank`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolves()
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const mockTestPk = '      '
      const result = await eventStoreClient.getEventsByKey(mockTestPk)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input pk is
        not a string`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolves()
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const mockTestPk = 123 as never
      const result = await eventStoreClient.getEventsByKey(mockTestPk)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test internal logic
     ************************************************************/
    it(`calls DynamoDBDocumentClient.send a single time`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolvesWithItems([])
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      await eventStoreClient.getEventsByKey(mockPk)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockDdbDocClient.send).toHaveBeenCalledTimes(1)
    })

    it(`calls DynamoDBDocumentClient.send with the expected input`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolvesWithItems([])
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      await eventStoreClient.getEventsByKey(mockPk)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockDdbDocClient.send).toHaveBeenCalledWith(expect.objectContaining({ input: expectedQueryCommand.input }))
    })

    it(`returns a transient Failure of kind UnrecognizedError if
        DynamoDBDocumentClient.send throws an unrecognized Error`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_throws()
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const result = await eventStoreClient.getEventsByKey(mockPk)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'UnrecognizedError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(true)
    })

    /*
     *
     *
     ************************************************************
     * Test expected results
     ************************************************************/
    it(`returns the expected Success<EventStoreEvent[]> with empty array if no items are
        found`, async () => {
      const mockDdbDocClient = buildMockDdbDocClient_resolvesWithItems([])
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const result = await eventStoreClient.getEventsByKey(mockPk)
      const expectedResult = Result.makeSuccess<EventStoreEvent[]>([])
      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })

    it(`returns the expected Success<EventStoreEvent[]> with single event if one item is
        found`, async () => {
      const mockEvent = {
        pk: mockPk,
        sk: `EVENTS#${mockEventStoreEvent.eventName}`,
        idempotencyKey: mockEventStoreEvent.idempotencyKey,
        eventName: mockEventStoreEvent.eventName,
        eventData: mockEventStoreEvent.eventData,
        createdAt: mockEventStoreEvent.createdAt,
      }
      const mockDdbDocClient = buildMockDdbDocClient_resolvesWithItems([mockEvent])
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const result = await eventStoreClient.getEventsByKey(mockPk)

      const expectedEvent: EventStoreEvent = {
        idempotencyKey: mockEventStoreEvent.idempotencyKey,
        eventName: mockEventStoreEvent.eventName,
        eventData: mockEventStoreEvent.eventData,
        createdAt: mockEventStoreEvent.createdAt,
      }
      Object.setPrototypeOf(expectedEvent, EventStoreEvent.prototype)
      const expectedResult = Result.makeSuccess<EventStoreEvent[]>([expectedEvent])

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })

    it(`returns the expected Success<EventStoreEvent[]> with events sorted by createdAt
        descending`, async () => {
      const mockDate1 = '2024-10-19T01:00:00.000Z'
      const mockDate2 = '2024-10-19T02:00:00.000Z'
      const mockDate3 = '2024-10-19T03:00:00.000Z'

      const mockEvent1 = {
        pk: mockPk,
        sk: `EVENTS#EVENT1`,
        idempotencyKey: 'key1',
        eventName: 'EVENT1',
        eventData: { foo: 'bar1' },
        createdAt: mockDate1,
      }
      const mockEvent2 = {
        pk: mockPk,
        sk: `EVENTS#EVENT2`,
        idempotencyKey: 'key2',
        eventName: 'EVENT2',
        eventData: { foo: 'bar2' },
        createdAt: mockDate2,
      }
      const mockEvent3 = {
        pk: mockPk,
        sk: `EVENTS#EVENT3`,
        idempotencyKey: 'key3',
        eventName: 'EVENT3',
        eventData: { foo: 'bar3' },
        createdAt: mockDate3,
      }
      const mockEvents = [mockEvent2, mockEvent3, mockEvent1]

      const mockDdbDocClient = buildMockDdbDocClient_resolvesWithItems(mockEvents)
      const eventStoreClient = new EventStoreClient(mockDdbDocClient)
      const result = await eventStoreClient.getEventsByKey(mockPk)

      const expectedEvent1 = Object.setPrototypeOf(
        {
          idempotencyKey: mockEvent1.idempotencyKey,
          eventName: mockEvent1.eventName,
          eventData: mockEvent1.eventData,
          createdAt: mockEvent1.createdAt,
        } as EventStoreEvent,
        EventStoreEvent.prototype,
      )
      const expectedEvent2 = Object.setPrototypeOf(
        {
          idempotencyKey: mockEvent2.idempotencyKey,
          eventName: mockEvent2.eventName,
          eventData: mockEvent2.eventData,
          createdAt: mockEvent2.createdAt,
        } as EventStoreEvent,
        EventStoreEvent.prototype,
      )
      const expectedEvent3 = Object.setPrototypeOf(
        {
          idempotencyKey: mockEvent3.idempotencyKey,
          eventName: mockEvent3.eventName,
          eventData: mockEvent3.eventData,
          createdAt: mockEvent3.createdAt,
        } as EventStoreEvent,
        EventStoreEvent.prototype,
      )

      const mockEventClasses: EventStoreEvent[] = [expectedEvent1, expectedEvent2, expectedEvent3]
      const expectedResult = Result.makeSuccess<EventStoreEvent[]>(mockEventClasses)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })
})
