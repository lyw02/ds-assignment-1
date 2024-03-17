import {APIGatewayProxyHandlerV2} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, QueryCommand} from '@aws-sdk/lib-dynamodb';
import {apiResponse} from './utils';

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log('Event: ', event);

    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;
    const reviewerNameOrYear = parameters?.reviewerName;

    function isYear(str: string) {
      if (/^\d{4}$/.test(str)) {
        const year = parseInt(str, 10);
        return year >= 1970 && year <= 2099;
      }
      return false;
    }

    type filter = 'reviewDate' | 'reviewerName';

    let filter: filter;

    if (reviewerNameOrYear && isYear(reviewerNameOrYear)) {
      filter = 'reviewDate';
    } else {
      filter = 'reviewerName';
    }

    if (!movieId) {
      return apiResponse(404, {Message: 'MovieId is NaN'});
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
      return apiResponse(404, {Message: 'Invalid movieId'});
    }

    if (reviewerNameOrYear) {
      const filteredItems = commandOutput.Items?.filter(item => {
        if (filter === 'reviewDate') {
          return item.reviewDate.substring(0, 4) === reviewerNameOrYear;
        } else {
          return item.reviewerName === reviewerNameOrYear;
        }
      });

      return apiResponse(200, {data: filteredItems});
    } else {
      return apiResponse(200, {data: commandOutput.Items});
    }
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
