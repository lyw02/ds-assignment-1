import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as custom from 'aws-cdk-lib/custom-resources';
import {Construct} from 'constructs';
import {generateBatch} from '../shared/util';
import {movieReviews} from '../seed/movieReviews';
import * as apig from 'aws-cdk-lib/aws-apigateway';

export class RestAPIAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables
    const movieReviewsTable = new dynamodb.Table(this, 'MovieReviewsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {name: 'movieId', type: dynamodb.AttributeType.NUMBER},
      sortKey: {name: 'reviewerName', type: dynamodb.AttributeType.STRING},
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'MovieReviews',
    });

    // Functions
    const getMovieReviewsFn = new lambdanode.NodejsFunction(
      this,
      'GetMovieReviewsFn',
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieReviews.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      },
    );

    const postNewReviewFn = new lambdanode.NodejsFunction(
      this,
      'PostNewReviewFn',
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/postNewReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      },
    );

    new custom.AwsCustomResource(this, 'moviesddbInitData', {
      onCreate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of('moviesddbInitData'), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    // Permissions
    movieReviewsTable.grantReadData(getMovieReviewsFn);
    movieReviewsTable.grantWriteData(postNewReviewFn);

    // REST API
    const api = new apig.RestApi(this, 'RestApi', {
      description: 'Movie reviews API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ['Content-Type', 'X-Amz-Date'],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
    });

    // Endpoints
    const moviesEndpoint = api.root.addResource('movies');
    const specificMovieEndpoint = moviesEndpoint.addResource('{movieId}');
    const reviewsEndpoint = specificMovieEndpoint.addResource('reviews');

    reviewsEndpoint.addMethod(
      'GET',
      new apig.LambdaIntegration(getMovieReviewsFn, {proxy: true}),
    );

    reviewsEndpoint.addMethod(
      'POST',
      new apig.LambdaIntegration(postNewReviewFn, {proxy: true}),
    );
  }
}
