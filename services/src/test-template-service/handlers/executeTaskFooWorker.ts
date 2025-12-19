import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { EventStoreClient } from '../../event-store/EventStoreClient'
import { ExecuteTaskFooWorkerController } from '../ExecuteTaskFooWorker/ExecuteTaskFooWorkerController/ExecuteTaskFooWorkerController'
import { ExecuteTaskFooWorkerService } from '../ExecuteTaskFooWorker/ExecuteTaskFooWorkerService/ExecuteTaskFooWorkerService'

/**
 *
 */
function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const executeTaskFooWorkerService = new ExecuteTaskFooWorkerService(eventStoreClient)
  const executeTaskFooWorkerController = new ExecuteTaskFooWorkerController(executeTaskFooWorkerService)
  return executeTaskFooWorkerController.executeTasks.bind(executeTaskFooWorkerController)
}

export const handler = createHandler()
