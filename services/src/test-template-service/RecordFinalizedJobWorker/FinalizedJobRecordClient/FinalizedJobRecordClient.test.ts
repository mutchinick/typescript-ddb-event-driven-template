import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Result } from '../../../errors/Result'
import { FinalizedJobRecordClient } from './FinalizedJobRecordClient'

const mockEventStoreTableName = 'mockEventStoreTableName'
const mockDate = '2024-10-19T03:24:00.000Z'
const mockJobId = 'mockJobId'

process.env.EVENT_STORE_TABLE_NAME = mockEventStoreTableName

jest.useFakeTimers().setSystemTime(new Date(mockDate))

function buildMockDdbCommand(): PutCommand {
  const ddbCommand = new PutCommand({
    TableName: mockEventStoreTableName,
    Item: {
      pk: `FINALIZED_JOBS#jobId:${mockJobId}`,
      sk: 'FINALIZED_JOB',
      jobId: mockJobId,
      finalized: true,
      finalizedAt: mockDate,
      createdAt: mockDate,
      updatedAt: mockDate,
      _tn: 'FINALIZED_JOBS#RECORD',
      _sn: 'FINALIZED_JOBS',
      gsi1pk: 'FINALIZED_JOBS#BY_DATE',
      gsi1sk: `FINALIZED_AT#${mockDate}#JOB_ID#${mockJobId}`,
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

describe(`Test Template Service RecordFinalizedJobWorker FinalizedJobRecordClient tests`, () => {
  /*
   *
   *
   ************************************************************
   * Test jobId edge cases
   ************************************************************/
  it(`does not return a Failure if the input jobId is valid`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockJobId)
    expect(Result.isFailure(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input jobId
      is undefined`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const mockTestJobId = undefined as never
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockTestJobId)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input jobId
      is null`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const mockTestJobId = null as never
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockTestJobId)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'InvalidArgumentsError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a non-transient Failure of kind InvalidArgumentsError if the input jobId
      is blank`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const mockTestJobId = '    '
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockTestJobId)
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
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    await finalizedJobRecordClient.putFinalizedJobRecord(mockJobId)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDdbDocClient.send).toHaveBeenCalledTimes(1)
  })

  it(`calls DynamoDBDocumentClient.send with the expected input`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    await finalizedJobRecordClient.putFinalizedJobRecord(mockJobId)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDdbDocClient.send).toHaveBeenCalledWith(expect.objectContaining({ input: expectedDdbCommand.input }))
  })

  it(`returns a non-transient Failure of kind DuplicateFinalizedJobError if
      DynamoDBDocumentClient.send throws a ConditionalCheckFailedException`, async () => {
    const mockError = new ConditionalCheckFailedException({ $metadata: {}, message: 'ConditionalCheckFailed' })
    const mockDdbDocClient = buildMockDdbDocClient_throws(mockError)
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockJobId)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'DuplicateFinalizedJobError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(false)
  })

  it(`returns a transient Failure of kind FinalizedJobWriteError if
      DynamoDBDocumentClient.send throws an unrecognized Error`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_throws()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockJobId)
    expect(Result.isFailure(result)).toBe(true)
    expect(Result.isFailureOfKind(result, 'FinalizedJobWriteError')).toBe(true)
    expect(Result.isFailureTransient(result)).toBe(true)
  })

  /*
   *
   *
   ************************************************************
   * Test expected result
   ************************************************************/
  it(`returns the expected Success<void> if the execution path is successful`, async () => {
    const mockDdbDocClient = buildMockDdbDocClient_resolves()
    const finalizedJobRecordClient = new FinalizedJobRecordClient(mockDdbDocClient)
    const result = await finalizedJobRecordClient.putFinalizedJobRecord(mockJobId)
    const expectedResult = Result.makeSuccess()
    expect(Result.isSuccess(result)).toBe(true)
    expect(result).toStrictEqual(expectedResult)
  })
})
