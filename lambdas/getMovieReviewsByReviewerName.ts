import {APIGatewayProxyHandlerV2} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, QueryCommand} from '@aws-sdk/lib-dynamodb';

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log('Event: ', event);

    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;
    const reviewerName = parameters?.reviewerName;

    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({Message: 'MovieId is NaN'}),
      };
    }

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

    if (reviewerName) {
      const filteredItems = commandOutput.Items?.filter(
        item => item.reviewerName === reviewerName,
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
