import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { EventStoreClient } from '../../event-store/EventStoreClient'
import { FinalizeJobWorkerController } from '../FinalizeJobWorker/FinalizeJobWorkerController/FinalizeJobWorkerController'
import { FinalizeJobWorkerService } from '../FinalizeJobWorker/FinalizeJobWorkerService/FinalizeJobWorkerService'

/**
 *
 */
function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const finalizeJobWorkerService = new FinalizeJobWorkerService(eventStoreClient)
  const finalizeJobWorkerController = new FinalizeJobWorkerController(finalizeJobWorkerService)
  return finalizeJobWorkerController.finalizeJobs.bind(finalizeJobWorkerController)
}

export const handler = createHandler()
