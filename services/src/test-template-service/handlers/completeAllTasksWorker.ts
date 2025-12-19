import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { EventStoreClient } from '../../event-store/EventStoreClient'
import { CompleteAllTasksWorkerController } from '../CompleteAllTasksWorker/CompleteAllTasksWorkerController/CompleteAllTasksWorkerController'
import { CompleteAllTasksWorkerService } from '../CompleteAllTasksWorker/CompleteAllTasksWorkerService/CompleteAllTasksWorkerService'

/**
 *
 */
function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const completeAllTasksWorkerService = new CompleteAllTasksWorkerService(eventStoreClient)
  const completeAllTasksWorkerController = new CompleteAllTasksWorkerController(completeAllTasksWorkerService)
  return completeAllTasksWorkerController.completeTasks.bind(completeAllTasksWorkerController)
}

export const handler = createHandler()
