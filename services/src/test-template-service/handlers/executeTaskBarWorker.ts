import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SQSBatchResponse, SQSEvent } from 'aws-lambda'
import { EventStoreClient } from '../../event-store/EventStoreClient'
import { ExecuteTaskBarWorkerController } from '../ExecuteTaskBarWorker/ExecuteTaskBarWorkerController/ExecuteTaskBarWorkerController'
import { ExecuteTaskBarWorkerService } from '../ExecuteTaskBarWorker/ExecuteTaskBarWorkerService/ExecuteTaskBarWorkerService'

/**
 *
 */
function createHandler(): (sqsEvent: SQSEvent) => Promise<SQSBatchResponse> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const executeTaskBarWorkerService = new ExecuteTaskBarWorkerService(eventStoreClient)
  const executeTaskBarWorkerController = new ExecuteTaskBarWorkerController(executeTaskBarWorkerService)
  return executeTaskBarWorkerController.executeTasks.bind(executeTaskBarWorkerController)
}

export const handler = createHandler()
