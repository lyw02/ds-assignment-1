import {APIGatewayProxyHandlerV2} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, ScanCommand} from '@aws-sdk/lib-dynamodb';
import {apiResponse} from './utils';

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log('Event: ', event);

    const parameters = event?.pathParameters;
    const reviewerName = parameters?.reviewerName
      ? parameters.reviewerName
      : undefined;

    if (!reviewerName) {
      return apiResponse(404, {Message: 'Reviewer name is missing'});
    }
    const commandOutput = await ddbDocClient.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: 'reviewerName = :rn',
        ExpressionAttributeValues: {
          ':rn': reviewerName,
        },
      }),
    );

    if (commandOutput.Items?.length === 0) {
      return apiResponse(404, {Message: 'Invalid reviewerName'});
    }

    return apiResponse(200, {data: commandOutput.Items});
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return apiResponse(500, {error});
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
