import { RemovalPolicy } from 'aws-cdk-lib'
import { HttpApi, HttpMethod, PayloadFormatVersion } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { join } from 'path'
import { settings } from '../settings'

export interface IPlaceOrderApiLambdaConstructProps {
  httpApi: HttpApi
  dynamoDbTable: Table
}

/**
 *
 */
export class PlaceOrderApiLambdaConstruct extends Construct {
  /**
   *
   */
  constructor(scope: Construct, id: string, props: IPlaceOrderApiLambdaConstructProps) {
    super(scope, id)
    const lambdaFunc = this.createPlaceOrderApiLambdaFunction(this, id, props.dynamoDbTable)
    this.createPlaceOrderApiLambdaIntegration(id, lambdaFunc, props.httpApi)
  }

  /**
   *
   */
  private createPlaceOrderApiLambdaFunction(scope: Construct, id: string, dynamoDbTable: Table): NodejsFunction {
    const lambdaFuncName = `${id}-Lambda`.slice(0, 64)

    const logGroup = new LogGroup(scope, `${lambdaFuncName}LogGroup`, {
      logGroupName: `/aws/lambda/${lambdaFuncName}`,
      retention: RetentionDays.INFINITE,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const servicesRoot = join(__dirname, '../../../services')

    const lambdaFunc = new NodejsFunction(scope, lambdaFuncName, {
      functionName: lambdaFuncName,
      runtime: Runtime.NODEJS_20_X,
      projectRoot: servicesRoot,
      depsLockFilePath: join(servicesRoot, 'package-lock.json'),
      entry: join(servicesRoot, 'src/ecommerce-service/PlaceOrderApi/handler/handler.ts'),
      handler: 'handler',
      environment: {
        EVENT_STORE_TABLE_NAME: dynamoDbTable.tableName,
      },
      timeout: settings.API.TIMEOUT,
      logGroup,
    })

    dynamoDbTable.grantReadWriteData(lambdaFunc)

    return lambdaFunc
  }

  /**
   *
   */
  private createPlaceOrderApiLambdaIntegration(id: string, lambdaFunc: NodejsFunction, httpApi: HttpApi): void {
    const lambdaIntegrationName = `${id}-LambdaIntegration`
    const lambdaIntegration = new HttpLambdaIntegration(lambdaIntegrationName, lambdaFunc, {
      payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
    })

    httpApi.addRoutes({
      path: '/api/v1/ecommerce-service/placeOrder',
      methods: [HttpMethod.POST],
      integration: lambdaIntegration,
    })
  }
}
