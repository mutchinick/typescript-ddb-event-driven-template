import { Result } from '../../errors/Result'
import { EventStoreEventName } from '../../event-store/EventStoreEventName'
import { TaskQuxExecutedEvent, TaskQuxExecutedEventData } from './TaskQuxExecutedEvent'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockJobId = 'mockJobId'
const mockExecuted = true
const mockIdempotencyKey = `jobId:${mockJobId}`

function buildTestInputData(): TaskQuxExecutedEventData {
  return {
    jobId: mockJobId,
    executed: mockExecuted,
  }
}

function buildReconstituteInput(): {
  eventData: {
    jobId: string
    executed: true
  }
  idempotencyKey: string
  createdAt: string
} {
  return {
    eventData: {
      jobId: mockJobId,
      executed: mockExecuted,
    },
    idempotencyKey: mockIdempotencyKey,
    createdAt: mockDate,
  }
}

describe(`Test TaskQuxExecutedEvent`, () => {
  /*
   *
   *
   ************************************************************
   * Test TaskQuxExecutedEvent.fromData
   ************************************************************/
  describe(`Test TaskQuxExecutedEvent.fromData`, () => {
    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEventData edge cases
     ************************************************************/
    it(`does not return a Failure if the input TaskQuxExecutedEventData is valid`, () => {
      const testInput = buildTestInputData()
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData is undefined`, () => {
      const testInput = undefined as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData is null`, () => {
      const testInput = null as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEventData.jobId edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.jobId is undefined`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = undefined as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.jobId is null`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = null as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.jobId is empty`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = ''
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.jobId is blank`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = '      '
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.jobId length < 6`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = '12345'
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEventData.executed edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.executed is undefined`, () => {
      const testInput = buildTestInputData()
      testInput.executed = undefined as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.executed is null`, () => {
      const testInput = buildTestInputData()
      testInput.executed = null as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.executed is false`, () => {
      const testInput = buildTestInputData()
      testInput.executed = false as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEventData.executed is not a boolean`, () => {
      const testInput = buildTestInputData()
      testInput.executed = 'true' as never
      const result = TaskQuxExecutedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test expected results
     ************************************************************/
    it(`returns the expected Success<TaskQuxExecutedEvent> if the execution path is
        successful`, () => {
      const mockTaskQuxExecutedEventData = buildTestInputData()
      const result = TaskQuxExecutedEvent.fromData(mockTaskQuxExecutedEventData)

      const expectedEvent: TaskQuxExecutedEvent = {
        idempotencyKey: mockIdempotencyKey,
        eventName: EventStoreEventName.TASK_QUX_EXECUTED_EVENT,
        eventData: {
          jobId: mockTaskQuxExecutedEventData.jobId,
          executed: mockTaskQuxExecutedEventData.executed,
        },
        createdAt: mockDate,
      }
      Object.setPrototypeOf(expectedEvent, TaskQuxExecutedEvent.prototype)
      const expectedResult = Result.makeSuccess(expectedEvent)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })

  /*
   *
   *
   ************************************************************
   * Test TaskQuxExecutedEvent.reconstitute
   ************************************************************/
  describe(`Test TaskQuxExecutedEvent.reconstitute`, () => {
    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEvent edge cases
     ************************************************************/
    it(`does not return a Failure if the input TaskQuxExecutedEvent is valid`, () => {
      const testInput = buildReconstituteInput()
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEvent.idempotencyKey edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.idempotencyKey is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.idempotencyKey = undefined as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.idempotencyKey is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.idempotencyKey = null as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEvent.createdAt edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.createdAt is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.createdAt = undefined as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.createdAt is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.createdAt = null as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEvent.eventData edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData = undefined as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData = null as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEvent.eventData.jobId edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.jobId is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = undefined as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.jobId is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = null as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.jobId is empty`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = ''
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.jobId is blank`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = '      '
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.jobId length < 6`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = '12345'
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test TaskQuxExecutedEvent.eventData.executed edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.executed is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.executed = undefined as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.executed is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.executed = null as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.executed is false`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.executed = false as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        TaskQuxExecutedEvent.eventData.executed is not a boolean`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.executed = 'true' as never
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test expected results
     ************************************************************/
    it(`returns the expected Success<TaskQuxExecutedEvent> if the execution path is
        successful`, () => {
      const testInput = buildReconstituteInput()
      const result = TaskQuxExecutedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )

      const expectedEvent: TaskQuxExecutedEvent = {
        idempotencyKey: testInput.idempotencyKey,
        eventName: EventStoreEventName.TASK_QUX_EXECUTED_EVENT,
        eventData: {
          jobId: testInput.eventData.jobId,
          executed: testInput.eventData.executed,
        },
        createdAt: testInput.createdAt,
      }
      Object.setPrototypeOf(expectedEvent, TaskQuxExecutedEvent.prototype)
      const expectedResult = Result.makeSuccess(expectedEvent)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })
})
