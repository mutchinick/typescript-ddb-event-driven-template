import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { EventStoreClient } from '../../event-store/EventStoreClient'
import { ListJobEventsApiController } from '../ListJobEventsApi/ListJobEventsApiController/ListJobEventsApiController'
import { ListJobEventsApiService } from '../ListJobEventsApi/ListJobEventsApiService/ListJobEventsApiService'

/**
 *
 */
function createHandler(): (apiEvent: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const listJobEventsApiService = new ListJobEventsApiService(eventStoreClient)
  const listJobEventsApiController = new ListJobEventsApiController(listJobEventsApiService)
  return listJobEventsApiController.listJobEvents.bind(listJobEventsApiController)
}

export const handler = createHandler()
