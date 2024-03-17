import {Handler} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {apiResponse} from './utils';

const ddbDocClient = createDDbDocClient();

export const handler: Handler = async (event, context) => {
  try {
    console.log('Event: ', event);

    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;
    const reviewerName = parameters?.reviewerName;

    if (!movieId) {
      return apiResponse(404, {Message: 'MovieId is NaN'});
    }

    const queryCommandOutput = await ddbDocClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'movieId = :m',
        ExpressionAttributeValues: {
          ':m': movieId,
        },
      }),
    );

    if (queryCommandOutput.Items?.length === 0) {
      return apiResponse(404, {Message: 'Invalid movieId'});
    }

    let filteredItem;
    if (reviewerName) {
      filteredItem = queryCommandOutput.Items?.find(
        item => item.reviewerName === reviewerName,
      );
    } else {
      return apiResponse(404, {Message: 'Reviewer name is missing'});
    }

    const body = event.body ? JSON.parse(event.body) : undefined;

    if (!body) {
      return apiResponse(500, {Message: 'Missing request body'});
    }

    const commandOutput = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          movieId: filteredItem!.movieId,
          reviewerName: filteredItem!.reviewerName,
        },
        UpdateExpression:
          'SET content = :content, rating = :rating, reviewDate = :reviewDate',
        ExpressionAttributeValues: {
          ':content': body.content,
          ':rating': body.rating,
          ':reviewDate': body.reviewDate,
        },
      }),
    );

    return apiResponse(200, {Message: 'Review updated'});
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
