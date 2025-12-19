import { Result } from '../../errors/Result'
import { EventStoreEventName } from '../../event-store/EventStoreEventName'
import { JobFinalizedEvent, JobFinalizedEventData } from './JobFinalizedEvent'

jest.useFakeTimers().setSystemTime(new Date('2024-10-19T03:24:00Z'))

const mockDate = new Date().toISOString()
const mockJobId = 'mockJobId'
const mockFinalized = true
const mockIdempotencyKey = `jobId:${mockJobId}`

function buildTestInputData(): JobFinalizedEventData {
  return {
    jobId: mockJobId,
    finalized: mockFinalized,
  }
}

function buildReconstituteInput(): {
  eventData: {
    jobId: string
    finalized: true
  }
  idempotencyKey: string
  createdAt: string
} {
  return {
    eventData: {
      jobId: mockJobId,
      finalized: mockFinalized,
    },
    idempotencyKey: mockIdempotencyKey,
    createdAt: mockDate,
  }
}

describe(`Test JobFinalizedEvent`, () => {
  /*
   *
   *
   ************************************************************
   * Test JobFinalizedEvent.fromData
   ************************************************************/
  describe(`Test JobFinalizedEvent.fromData`, () => {
    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEventData edge cases
     ************************************************************/
    it(`does not return a Failure if the input JobFinalizedEventData is valid`, () => {
      const testInput = buildTestInputData()
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData is undefined`, () => {
      const testInput = undefined as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData is null`, () => {
      const testInput = null as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEventData.jobId edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.jobId is undefined`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = undefined as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.jobId is null`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = null as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.jobId is empty`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = ''
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.jobId is blank`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = '      '
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.jobId length < 6`, () => {
      const testInput = buildTestInputData()
      testInput.jobId = '12345'
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEventData.finalized edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.finalized is undefined`, () => {
      const testInput = buildTestInputData()
      testInput.finalized = undefined as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.finalized is null`, () => {
      const testInput = buildTestInputData()
      testInput.finalized = null as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.finalized is false`, () => {
      const testInput = buildTestInputData()
      testInput.finalized = false as never
      const result = JobFinalizedEvent.fromData(testInput)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEventData.finalized is not a boolean`, () => {
      const testInput = buildTestInputData()
      testInput.finalized = 'true' as never
      const result = JobFinalizedEvent.fromData(testInput)
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
    it(`returns the expected Success<JobFinalizedEvent> if the execution path is
        successful`, () => {
      const mockJobFinalizedEventData = buildTestInputData()
      const result = JobFinalizedEvent.fromData(mockJobFinalizedEventData)

      const expectedEvent: JobFinalizedEvent = {
        idempotencyKey: mockIdempotencyKey,
        eventName: EventStoreEventName.JOB_FINALIZED_EVENT,
        eventData: {
          jobId: mockJobFinalizedEventData.jobId,
          finalized: mockJobFinalizedEventData.finalized,
        },
        createdAt: mockDate,
      }
      Object.setPrototypeOf(expectedEvent, JobFinalizedEvent.prototype)
      const expectedResult = Result.makeSuccess(expectedEvent)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })

  /*
   *
   *
   ************************************************************
   * Test JobFinalizedEvent.reconstitute
   ************************************************************/
  describe(`Test JobFinalizedEvent.reconstitute`, () => {
    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEvent edge cases
     ************************************************************/
    it(`does not return a Failure if the input JobFinalizedEvent is valid`, () => {
      const testInput = buildReconstituteInput()
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEvent.idempotencyKey edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.idempotencyKey is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.idempotencyKey = undefined as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.idempotencyKey is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.idempotencyKey = null as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEvent.createdAt edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.createdAt is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.createdAt = undefined as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.createdAt is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.createdAt = null as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEvent.eventData edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData = undefined as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData = null as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEvent.eventData.jobId edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.jobId is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = undefined as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.jobId is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = null as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.jobId is empty`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = ''
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.jobId is blank`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = '      '
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.jobId length < 6`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.jobId = '12345'
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    /*
     *
     *
     ************************************************************
     * Test JobFinalizedEvent.eventData.finalized edge cases
     ************************************************************/
    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.finalized is undefined`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.finalized = undefined as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.finalized is null`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.finalized = null as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.finalized is false`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.finalized = false as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
      expect(Result.isFailure(result)).toBe(true)
      expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
      expect(Result.isFailureTransient(result)).toBe(false)
    })

    it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
        JobFinalizedEvent.eventData.finalized is not a boolean`, () => {
      const testInput = buildReconstituteInput()
      testInput.eventData.finalized = 'true' as never
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)
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
    it(`returns the expected Success<JobFinalizedEvent> if the execution path is
        successful`, () => {
      const testInput = buildReconstituteInput()
      const result = JobFinalizedEvent.reconstitute(testInput.eventData, testInput.idempotencyKey, testInput.createdAt)

      const expectedEvent: JobFinalizedEvent = {
        idempotencyKey: testInput.idempotencyKey,
        eventName: EventStoreEventName.JOB_FINALIZED_EVENT,
        eventData: {
          jobId: testInput.eventData.jobId,
          finalized: testInput.eventData.finalized,
        },
        createdAt: testInput.createdAt,
      }
      Object.setPrototypeOf(expectedEvent, JobFinalizedEvent.prototype)
      const expectedResult = Result.makeSuccess(expectedEvent)

      expect(Result.isSuccess(result)).toBe(true)
      expect(result).toStrictEqual(expectedResult)
    })
  })
})
