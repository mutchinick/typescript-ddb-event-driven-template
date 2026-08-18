import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { Construct } from 'constructs'
import { EcommerceServiceApiConstruct } from './EcommerceServiceApiConstruct'
import { PlaceOrderApiLambdaConstruct } from './PlaceOrderApiLambdaConstruct'

export interface IEcommerceServiceMainConstructProps {
  dynamoDbTable: Table
  eventBus: EventBus
}

/**
 *
 */
export class EcommerceServiceMainConstruct extends Construct {
  /**
   *
   */
  constructor(scope: Construct, id: string, props: IEcommerceServiceMainConstructProps) {
    super(scope, id)

    const ecommerceServiceHttpApi = new EcommerceServiceApiConstruct(this, `${id}-Api`)

    new PlaceOrderApiLambdaConstruct(this, `${id}-PlaceOrderApi`, {
      httpApi: ecommerceServiceHttpApi.httpApi,
      dynamoDbTable: props.dynamoDbTable,
    })
  }
}
