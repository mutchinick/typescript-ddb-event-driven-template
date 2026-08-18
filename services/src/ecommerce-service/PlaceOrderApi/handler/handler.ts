import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { EventStoreClient } from '../../../event-store/EventStoreClient'
import { PlaceOrderApiController } from '../PlaceOrderApiController/PlaceOrderApiController'
import { PlaceOrderApiService } from '../PlaceOrderApiService/PlaceOrderApiService'

/**
 *
 */
function createHandler(): (apiEvent: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  const ddbClient = new DynamoDBClient({})
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
  const eventStoreClient = new EventStoreClient(ddbDocClient)
  const placeOrderApiService = new PlaceOrderApiService(eventStoreClient)
  const placeOrderApiController = new PlaceOrderApiController(placeOrderApiService)
  return placeOrderApiController.placeOrder.bind(placeOrderApiController)
}

export const handler = createHandler()
