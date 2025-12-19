import { Result } from '../../errors/Result'
import { EventStoreEventName } from '../../event-store/EventStoreEventName'
import { AllTasksCompletedEvent, AllTasksCompletedEventData } from './AllTasksCompletedEvent'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockJobId = 'mockJobId'
const mockCompleted = true
const mockIdempotencyKey = `jobId:${mockJobId}`

function buildTestInputData(): AllTasksCompletedEventData {
  return {
    jobId: mockJobId,
    completed: mockCompleted,
  }
}

function buildReconstituteInput(): {
  eventData: {
    jobId: string
    completed: true
  }
  idempotencyKey: string
  createdAt: string
} {
  return {
    eventData: {
      jobId: mockJobId,
      completed: mockCompleted,
    },
    idempotencyKey: mockIdempotencyKey,
    createdAt: mockDate,
  }
}

describe(`Test AllTasksCompletedEvent`, () => {
  /*
   *
   *
   ************************************************************
   * Test AllTasksCompletedEvent.fromData
   ************************************************************/
  describe(`Test AllTasksCompletedEvent.fromData`, () => {
    /*
     *
     *
     ************************************************************
     * Test AllTasksCompletedEventData edge cases
     ************************************************************/
    it(`does not return a Failure if the input AllTasksCompletedEventData is valid`, () => {
      const testInput = buildTestInputData()
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData is undefined`, () => {
      const testInput = undefined as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData is null`, () => {
      const testInput = null as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test AllTasksCompletedEventData.jobId edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.jobId is undefined`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = undefined as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.jobId is null`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = null as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.jobId is empty`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = ''
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.jobId is blank`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = '      '
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.jobId length < 6`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = '12345'
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test AllTasksCompletedEventData.completed edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.completed is undefined`, () => {
      const testInput = buildTestInputData()
      testInput.completed = undefined as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.completed is null`, () => {
      const testInput = buildTestInputData()
      testInput.completed = null as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.completed is false`, () => {
      const testInput = buildTestInputData()
      testInput.completed = false as never
      const result = AllTasksCompletedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEventData.completed is not a boolean`, () => {
      const testInput = buildTestInputData()
      testInput.completed = 'true' as never
      const result = AllTasksCompletedEvent.fromData(testInput)
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
    it(`returns the expected Success<AllTasksCompletedEvent> if the execution path is
        successful`, () => {
      const mockAllTasksCompletedEventData = buildTestInputData()
      const result = AllTasksCompletedEvent.fromData(mockAllTasksCompletedEventData)

      const expectedEvent: AllTasksCompletedEvent = {
        idempotencyKey: mockIdempotencyKey,
        eventName: EventStoreEventName.ALL_TASKS_COMPLETED_EVENT,
        eventData: {
          jobId: mockAllTasksCompletedEventData.jobId,
          completed: mockAllTasksCompletedEventData.completed,
        },
        createdAt: mockDate,
      }
      Object.setPrototypeOf(expectedEvent, AllTasksCompletedEvent.prototype)
      const expectedResult = Result.makeSuccess(expectedEvent)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })

  /*
   *
   *
   ************************************************************
   * Test AllTasksCompletedEvent.reconstitute
   ************************************************************/
  describe(`Test AllTasksCompletedEvent.reconstitute`, () => {
    /*
     *
     *
     ************************************************************
     * Test AllTasksCompletedEvent edge cases
     ************************************************************/
    it(`does not return a Failure if the input AllTasksCompletedEvent is valid`, () => {
      const testInput = buildReconstituteInput()
      const result = AllTasksCompletedEvent.reconstitute(
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
     * Test AllTasksCompletedEvent.idempotencyKey edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.idempotencyKey is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.idempotencyKey = undefined as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.idempotencyKey is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.idempotencyKey = null as never
      const result = AllTasksCompletedEvent.reconstitute(
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
     * Test AllTasksCompletedEvent.createdAt edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.createdAt is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.createdAt = undefined as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.createdAt is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.createdAt = null as never
      const result = AllTasksCompletedEvent.reconstitute(
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
     * Test AllTasksCompletedEvent.eventData edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData = undefined as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData = null as never
      const result = AllTasksCompletedEvent.reconstitute(
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
     * Test AllTasksCompletedEvent.eventData.jobId edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.jobId is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = undefined as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.jobId is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = null as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.jobId is empty`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = ''
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.jobId is blank`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = '      '
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.jobId length < 6`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = '12345'
      const result = AllTasksCompletedEvent.reconstitute(
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
     * Test AllTasksCompletedEvent.eventData.completed edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.completed is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.completed = undefined as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.completed is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.completed = null as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.completed is false`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.completed = false as never
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        AllTasksCompletedEvent.eventData.completed is not a boolean`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.completed = 'true' as never
      const result = AllTasksCompletedEvent.reconstitute(
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
    it(`returns the expected Success<AllTasksCompletedEvent> if the execution path is
        successful`, () => {
      const testInput = buildReconstituteInput()
      const result = AllTasksCompletedEvent.reconstitute(
        testInput.eventData,
        testInput.idempotencyKey,
        testInput.createdAt,
      )

      const expectedEvent: AllTasksCompletedEvent = {
        idempotencyKey: testInput.idempotencyKey,
        eventName: EventStoreEventName.ALL_TASKS_COMPLETED_EVENT,
        eventData: {
          jobId: testInput.eventData.jobId,
          completed: testInput.eventData.completed,
        },
        createdAt: testInput.createdAt,
      }
      Object.setPrototypeOf(expectedEvent, AllTasksCompletedEvent.prototype)
      const expectedResult = Result.makeSuccess(expectedEvent)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })
})
