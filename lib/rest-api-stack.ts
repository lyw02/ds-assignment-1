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

    // User pool
    const userPoolId = cdk.Fn.importValue('AuthAPIStack-UserPoolId');
    const userPoolClientId = cdk.Fn.importValue(
      'AuthAPIStack-UserPoolClientId',
    );

    // Functions
    const appCommonFnProps = (tableName: string) => {
      return {
        architecture: lambda.Architecture.ARM_64,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'handler',
        environment: {
          USER_POOL_ID: userPoolId,
          CLIENT_ID: userPoolClientId,
          REGION: cdk.Aws.REGION,
          TABLE_NAME: tableName,
        },
      };
    };

    const getMovieReviewsFn = new lambdanode.NodejsFunction(
      this,
      'GetMovieReviewsFn',
      {
        ...appCommonFnProps(movieReviewsTable.tableName),
        entry: `${__dirname}/../lambdas/getMovieReviews.ts`,
      },
    );

    const getReviewsFn = new lambdanode.NodejsFunction(this, 'GetReviewsFn', {
      ...appCommonFnProps(movieReviewsTable.tableName),
      entry: `${__dirname}/../lambdas/getReviews.ts`,
    });

    const getTranslationFn = new lambdanode.NodejsFunction(
      this,
      'GetTranslationFn',
      {
        ...appCommonFnProps(movieReviewsTable.tableName),
        entry: `${__dirname}/../lambdas/getTranslation.ts`,
      },
    );

    const getMovieReviewsByReviewerNameFn = new lambdanode.NodejsFunction(
      // Reviewer name or year
      this,
      'GetMovieReviewsByReviewerNameFn',
      {
        ...appCommonFnProps(movieReviewsTable.tableName),
        entry: `${__dirname}/../lambdas/getMovieReviewsByReviewerName.ts`,
      },
    );

    const postNewReviewFn = new lambdanode.NodejsFunction(
      this,
      'PostNewReviewFn',
      {
        ...appCommonFnProps(movieReviewsTable.tableName),
        entry: `${__dirname}/../lambdas/postNewReview.ts`,
      },
    );

    const putMovieReviewFn = new lambdanode.NodejsFunction(
      this,
      'PutMovieReviewFn',
      {
        ...appCommonFnProps(movieReviewsTable.tableName),
        entry: `${__dirname}/../lambdas/putMovieReviewFn.ts`,
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
        physicalResourceId: custom.PhysicalResourceId.of('moviesddbInitData'),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    // Authorizor
    const authorizerFn = new lambdanode.NodejsFunction(this, 'AuthorizerFn', {
      ...appCommonFnProps(''),
      entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      'RequestAuthorizer',
      {
        identitySources: [apig.IdentitySource.header('cookie')],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      },
    );

    // Permissions
    movieReviewsTable.grantReadData(getMovieReviewsFn);
    movieReviewsTable.grantReadData(getReviewsFn);
    movieReviewsTable.grantReadData(getMovieReviewsByReviewerNameFn);
    movieReviewsTable.grantReadData(getTranslationFn);
    movieReviewsTable.grantWriteData(postNewReviewFn);
    movieReviewsTable.grantReadWriteData(putMovieReviewFn);

    // REST API
    const appApi = new apig.RestApi(this, 'AppApi', {
      description: 'App API',
      endpointTypes: [apig.EndpointType.REGIONAL],
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
    const moviesEndpoint = appApi.root.addResource('movies');
    const reviewsEndpoint = appApi.root.addResource('reviews');
    const reviewerEndpoint = reviewsEndpoint.addResource('{reviewerName}'); // /reviews/{reviewerName}
    const reviewerMovieIdEndpoint = reviewerEndpoint.addResource('{movieId}');
    const translateEndpopint = reviewerMovieIdEndpoint.addResource('translation'); // /reviews/{reviewerName}/{movieId}/translation
    const postReviewEndpoint = moviesEndpoint.addResource('reviews'); // /movies/reviews
    const specificMovieEndpoint = moviesEndpoint.addResource('{movieId}');
    const movieReviewsEndpoint = specificMovieEndpoint.addResource('reviews'); // /movies/{movieId}/reviews
    const movieReviewerEndpoint =
      movieReviewsEndpoint.addResource('{reviewerName}'); // /movies/{movieId}/reviews/{reviewerName} or {year}

    movieReviewsEndpoint.addMethod(
      'GET',
      new apig.LambdaIntegration(getMovieReviewsFn, {proxy: true}),
    );

    reviewerEndpoint.addMethod(
      'GET',
      new apig.LambdaIntegration(getReviewsFn, {proxy: true}),
    );

    translateEndpopint.addMethod(
      'GET',
      new apig.LambdaIntegration(getTranslationFn, {proxy: true}),
    );

    postReviewEndpoint.addMethod(
      'POST',
      new apig.LambdaIntegration(postNewReviewFn, {proxy: true}),
      {
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM,
      },
    );

    movieReviewerEndpoint.addMethod(
      // Reviewer or year
      'GET',
      new apig.LambdaIntegration(getMovieReviewsByReviewerNameFn, {
        proxy: true,
      }),
    );

    movieReviewerEndpoint.addMethod(
      'PUT',
      new apig.LambdaIntegration(putMovieReviewFn, {
        proxy: true,
      }),
      {
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM,
      },
    );
  }
}
