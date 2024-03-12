import {APIGatewayProxyHandlerV2} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  ScanCommandInput,
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

    const queryParams = event.queryStringParameters;

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

      let commandInput: ScanCommandInput = {
        TableName: process.env.TABLE_NAME,
        FilterExpression: 'rating >= :mr',
        ExpressionAttributeValues: {
          ':mr': minRating,
        },
      };

      const commandOutput = await ddbDocClient.send(
        new ScanCommand(commandInput),
      );

      return {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          data: commandOutput.Items,
        }),
      };
    } else {
      // No query params
      const commandOutput = await ddbDocClient.send(
        new ScanCommand({
          TableName: process.env.TABLE_NAME,
        }),
      );

      if (!commandOutput.Items) {
        return {
          statusCode: 404,
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({Message: 'Error'}),
        };
      }

      const body = {
        data: commandOutput.Items,
      };

      return {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
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
