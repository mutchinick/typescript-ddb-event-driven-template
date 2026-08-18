import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { FinalizedJobRecordClient } from '../FinalizedJobRecordClient/FinalizedJobRecordClient'
import { RecordFinalizedJobWorkerController } from '../RecordFinalizedJobWorkerController/RecordFinalizedJobWorkerController'
import { RecordFinalizedJobWorkerService } from '../RecordFinalizedJobWorkerService/RecordFinalizedJobWorkerService'

/**
 *
 */
function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const finalizedJobRecordClient = new FinalizedJobRecordClient(ddbDocClient)
  const recordFinalizedJobWorkerService = new RecordFinalizedJobWorkerService(finalizedJobRecordClient)
  const recordFinalizedJobWorkerController = new RecordFinalizedJobWorkerController(recordFinalizedJobWorkerService)
  return recordFinalizedJobWorkerController.recordFinalizedJobs.bind(recordFinalizedJobWorkerController)
}

export const handler = createHandler()
