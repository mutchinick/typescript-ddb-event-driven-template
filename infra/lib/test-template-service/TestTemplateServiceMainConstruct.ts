import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { EventBus } from 'aws-cdk-lib/aws-events'
import { Construct } from 'constructs'
import { CompleteAllTasksWorkerConstruct } from './CompleteAllTasksWorkerConstruct'
import { CreateJobApiLambdaConstruct } from './CreateJobApiLambdaConstruct'
import { ExecuteTaskFooWorkerConstruct } from './ExecuteTaskFooWorkerConstruct'
import { ExecuteTaskQuxWorkerConstruct } from './ExecuteTaskQuxWorkerConstruct'
import { ExecuteTaskBarWorkerConstruct } from './ExecuteTaskBarWorkerConstruct'
import { FinalizeJobWorkerConstruct } from './FinalizeJobWorkerConstruct'
import { ListJobEventsApiLambdaConstruct } from './ListJobEventsApiLambdaConstruct'
import { ProcessStepWorkerConstruct } from './ProcessStepWorkerConstruct'
import { RecordFinalizedJobWorkerConstruct } from './RecordFinalizedJobWorkerConstruct'
import { TestTemplateServiceApiConstruct } from './TestTemplateServiceApiConstruct'

export interface ITestTemplateServiceMainConstructProps {
  dynamoDbTable: Table
  eventBus: EventBus
}

/**
 *
 */
export class TestTemplateServiceMainConstruct extends Construct {
  /**
   *
   */
  constructor(scope: Construct, id: string, props: ITestTemplateServiceMainConstructProps) {
    super(scope, id)

    // API
    const testTemplateServiceHttpApi = new TestTemplateServiceApiConstruct(this, `${id}-Api`)

    new CreateJobApiLambdaConstruct(this, `${id}-CreateJobApi`, {
      httpApi: testTemplateServiceHttpApi.httpApi,
      dynamoDbTable: props.dynamoDbTable,
    })

    new ListJobEventsApiLambdaConstruct(this, `${id}-ListJobEventsApi`, {
      httpApi: testTemplateServiceHttpApi.httpApi,
      dynamoDbTable: props.dynamoDbTable,
    })

    // Workers
    new ProcessStepWorkerConstruct(this, `${id}-ProcessStepWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })

    new ExecuteTaskFooWorkerConstruct(this, `${id}-ExecuteTaskFooWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })

    new ExecuteTaskQuxWorkerConstruct(this, `${id}-ExecuteTaskQuxWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })

    new ExecuteTaskBarWorkerConstruct(this, `${id}-ExecuteTaskBarWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })

    new CompleteAllTasksWorkerConstruct(this, `${id}-CompleteAllTasksWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })

    new FinalizeJobWorkerConstruct(this, `${id}-FinalizeJobWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })

    new RecordFinalizedJobWorkerConstruct(this, `${id}-RecordFinalizedJobWorker`, {
      dynamoDbTable: props.dynamoDbTable,
      eventBus: props.eventBus,
    })
  }
}
