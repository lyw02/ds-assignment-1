import {Handler} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { apiResponse } from './utils';

const ddbDocClient = createDDbDocClient();

export const handler: Handler = async (event, context) => {
  try {
    console.log('Event: ', event);

    const body = event.body ? JSON.parse(event.body) : undefined;

    if (!body) {
      return apiResponse(500, {message: 'Missing request body'})
    }

    const commandOutput = await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: body,
      }),
    );

    return apiResponse(200, {message: 'Review added'})
  } catch (error: any) {
    console.log(JSON.stringify(error));

    return apiResponse(500, {error})
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
