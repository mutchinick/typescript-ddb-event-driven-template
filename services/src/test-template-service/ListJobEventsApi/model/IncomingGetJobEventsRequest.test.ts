import { Result } from '../../../errors/Result'
import { IncomingGetJobEventsRequest, IncomingGetJobEventsRequestInput } from './IncomingGetJobEventsRequest'

const mockJobId = 'mockJobId'

function buildMockIncomingGetJobEventsRequestInput(): IncomingGetJobEventsRequestInput {
  const mockValidRequestInput: IncomingGetJobEventsRequestInput = {
    jobId: mockJobId,
  }
  return mockValidRequestInput
}

describe(`Test Template Service ListJobEventsApi IncomingGetJobEventsRequest tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test IncomingGetJobEventsRequestInput edge cases
   ************************************************************/
  it(`does not return a Failure if the input IncomingGetJobEventsRequestInput is valid`, () => {
    const mockIncomingGetJobEventsRequestInput = buildMockIncomingGetJobEventsRequestInput()
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequestInput is undefined`, () => {
    const mockIncomingGetJobEventsRequestInput = undefined as never
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequestInput is null`, () => {
    const mockIncomingGetJobEventsRequestInput = null as never
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  /*
   *
   *
   ************************************************************
   * Test IncomingGetJobEventsRequestInput.jobId edge cases
   ************************************************************/
  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequestInput.jobId is undefined`, () => {
    const mockIncomingGetJobEventsRequestInput = buildMockIncomingGetJobEventsRequestInput()
    mockIncomingGetJobEventsRequestInput.jobId = undefined as never
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequestInput.jobId is null`, () => {
    const mockIncomingGetJobEventsRequestInput = buildMockIncomingGetJobEventsRequestInput()
    mockIncomingGetJobEventsRequestInput.jobId = null as never
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequestInput.jobId is empty`, () => {
    const mockIncomingGetJobEventsRequestInput = buildMockIncomingGetJobEventsRequestInput()
    mockIncomingGetJobEventsRequestInput.jobId = '' as never
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input
      IncomingGetJobEventsRequestInput.jobId is blank`, () => {
    const mockIncomingGetJobEventsRequestInput = buildMockIncomingGetJobEventsRequestInput()
    mockIncomingGetJobEventsRequestInput.jobId = '      ' as never
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
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
  it(`returns the expected Success<IncomingGetJobEventsRequest> if the execution path
      is successful`, () => {
    const mockIncomingGetJobEventsRequestInput = buildMockIncomingGetJobEventsRequestInput()
    const result = IncomingGetJobEventsRequest.fromInput(mockIncomingGetJobEventsRequestInput)
    const expectedRequest: IncomingGetJobEventsRequest = {
      jobId: mockIncomingGetJobEventsRequestInput.jobId,
    }
    Object.setPrototypeOf(expectedRequest, IncomingGetJobEventsRequest.prototype)
    const expectedResult = Result.makeSuccess(expectedRequest)
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
