import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Failure, Result, Success } from '../../../errors/Result'

export interface IFinalizedJobRecordClient {
  putFinalizedJobRecord: (
    jobId: string,
  ) => Promise<
    | Success<void>
    | Failure<'InvalidArgumentsError'>
    | Failure<'DuplicateFinalizedJobError'>
    | Failure<'FinalizedJobWriteError'>
  >
}

/**
 *
 */
export class FinalizedJobRecordClient implements IFinalizedJobRecordClient {
  /**
   *
   */
  constructor(private readonly ddbDocClient: DynamoDBDocumentClient) {}

  /**
   *
   */
  public async putFinalizedJobRecord(
    jobId: string,
  ): Promise<
    | Success<void>
    | Failure<'InvalidArgumentsError'>
    | Failure<'DuplicateFinalizedJobError'>
    | Failure<'FinalizedJobWriteError'>
  > {
    const logCtx = 'FinalizedJobRecordClient.putFinalizedJobRecord'
    console.info(`${logCtx} init:`, { jobId })

    const inputValidationResult = this.validatePutFinalizedJobRecordInput(jobId)
    if (Result.isFailure(inputValidationResult)) {
      console.error(`${logCtx} exit failure:`, { inputValidationResult, jobId })
      return inputValidationResult
    }

    const putFinalizedJobRecordResult = await this.executeDdbPutFinalizedJobRecord(jobId)
    Result.isFailure(putFinalizedJobRecordResult)
      ? console.error(`${logCtx} exit failure:`, { putFinalizedJobRecordResult, jobId })
      : console.info(`${logCtx} exit success:`, { putFinalizedJobRecordResult, jobId })

    return putFinalizedJobRecordResult
  }

  /**
   *
   */
  private validatePutFinalizedJobRecordInput(jobId: string): Success<void> | Failure<'InvalidArgumentsError'> {
    const logCtx = 'FinalizedJobRecordClient.validatePutFinalizedJobRecordInput'

    if (jobId == null || typeof jobId !== 'string' || jobId.trim().length === 0) {
      const message = `Expected jobId but got ${jobId}`
      const failure = Result.makeFailure('InvalidArgumentsError', message, false)
      console.error(`${logCtx} exit failure:`, { failure, jobId })
      return failure
    }

    return Result.makeSuccess()
  }

  /**
   *
   */
  private async executeDdbPutFinalizedJobRecord(
    jobId: string,
  ): Promise<
    | Success<void>
    | Failure<'InvalidArgumentsError'>
    | Failure<'DuplicateFinalizedJobError'>
    | Failure<'FinalizedJobWriteError'>
  > {
    const logCtx = 'FinalizedJobRecordClient.executeDdbPutFinalizedJobRecord'

    let ddbCommand: PutCommand
    try {
      const tableName = process.env.EVENT_STORE_TABLE_NAME
      if (tableName == null || tableName.trim().length === 0) {
        throw new Error('Missing EVENT_STORE_TABLE_NAME')
      }

      const timestamp = new Date().toISOString()
      const pk = `FINALIZED_JOBS#jobId:${jobId}`
      const sk = 'FINALIZED_JOB'
      const gsi1pk = 'FINALIZED_JOBS#BY_DATE'
      const gsi1sk = `FINALIZED_AT#${timestamp}#JOB_ID#${jobId}`
      const _tn = 'FINALIZED_JOBS#RECORD'
      const _sn = 'FINALIZED_JOBS'

      ddbCommand = new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk,
          jobId,
          finalized: true,
          finalizedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          _tn,
          _sn,
          gsi1pk,
          gsi1sk,
        },
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      })
    } catch (error) {
      console.error(`${logCtx} error building PutCommand:`, { error, jobId })
      const failure = Result.makeFailure('InvalidArgumentsError', error, false)
      console.error(`${logCtx} exit failure:`, { failure, jobId })
      return failure
    }

    try {
      await this.ddbDocClient.send(ddbCommand)
      const putFinalizedJobRecordResult = Result.makeSuccess()
      console.info(`${logCtx} exit success:`, { putFinalizedJobRecordResult, ddbCommand })
      return putFinalizedJobRecordResult
    } catch (error) {
      console.error(`${logCtx} error executing PutCommand:`, { error, ddbCommand })

      if (error instanceof ConditionalCheckFailedException) {
        const duplicateFailure = Result.makeFailure('DuplicateFinalizedJobError', error, false)
        console.error(`${logCtx} exit failure:`, { duplicateFailure, ddbCommand })
        return duplicateFailure
      }

      const writeFailure = Result.makeFailure('FinalizedJobWriteError', error, true)
      console.error(`${logCtx} exit failure:`, { writeFailure, ddbCommand })
      return writeFailure
    }
  }
}
