import {APIGatewayProxyHandlerV2} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import Ajv from 'ajv';
import schema from '../shared/types.schema.json';

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions['MovieReviewsQueryParams'] || {},
);

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log('Event: ', event);

    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;
    const queryParams = event?.queryStringParameters;

    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({Message: 'MovieId is NaN'}),
      };
    }

    if (queryParams && !isValidQueryParams(queryParams)) {
      // Invalid query params
      return {
        statusCode: 500,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({Message: 'Invalid min rating'}),
      };
    } else if (
      queryParams &&
      isValidQueryParams(queryParams) &&
      queryParams.minRating
    ) {
      // Valid query params
      const minRating = parseInt(queryParams.minRating);

      const commandOutput = await ddbDocClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: 'movieId = :m',
          ExpressionAttributeValues: {
            ':m': movieId,
          },
        }),
      );

      if (commandOutput.Items?.length === 0) {
        return {
          statusCode: 404,
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Invalid movieId.',
          }),
        };
      }

      const filteredItems = commandOutput.Items?.filter(
        item => item.rating >= minRating,
      );

      return {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          data: filteredItems,
        }),
      };
    } else {
      // No query params
      const commandOutput = await ddbDocClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: 'movieId = :m',
          ExpressionAttributeValues: {
            ':m': movieId,
          },
        }),
      );

      if (commandOutput.Items?.length === 0) {
        return {
          statusCode: 404,
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({Message: 'Invalid movieId'}),
        };
      }

      return {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          data: commandOutput.Items,
        }),
      };
    }
  } catch (error: any) {
    console.log(JSON.stringify(error));

    return {
      statusCode: 500,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({error}),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({region: process.env.REGION});

  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };

  const unmarshallOptions = {
    wrapNumbers: false,
  };

  const translateConfig = {marshallOptions, unmarshallOptions};

  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
