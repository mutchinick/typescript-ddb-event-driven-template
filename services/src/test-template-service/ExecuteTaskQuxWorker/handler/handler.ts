import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { EventStoreClient } from '../../../event-store/EventStoreClient'
import { ExecuteTaskQuxWorkerController } from '../ExecuteTaskQuxWorkerController/ExecuteTaskQuxWorkerController'
import { ExecuteTaskQuxWorkerService } from '../ExecuteTaskQuxWorkerService/ExecuteTaskQuxWorkerService'

/**
 *
 */
function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const executeTaskQuxWorkerService = new ExecuteTaskQuxWorkerService(eventStoreClient)
  const executeTaskQuxWorkerController = new ExecuteTaskQuxWorkerController(executeTaskQuxWorkerService)
  return executeTaskQuxWorkerController.executeTasks.bind(executeTaskQuxWorkerController)
}

export const handler = createHandler()
