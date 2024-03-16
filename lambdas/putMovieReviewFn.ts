import {Handler} from 'aws-lambda';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

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
      return {
        statusCode: 404,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({Message: 'MovieId is NaN'}),
      };
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
      return {
        statusCode: 404,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({Message: 'Invalid movieId'}),
      };
    }

    let filteredItem;
    if (reviewerName) {
      filteredItem = queryCommandOutput.Items?.find(
        item => item.reviewerName === reviewerName,
      );
    } else {
      return {
        statusCode: 404,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({Message: 'Reviewer name is missing'}),
      };
    }

    const body = event.body ? JSON.parse(event.body) : undefined;

    if (!body) {
      return {
        statusCode: 500,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({message: 'Missing request body'}),
      };
    }

    const commandOutput = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          movieId: filteredItem!.movieId,
          reviewerName: filteredItem!.reviewerName
        },
        UpdateExpression: 'SET content = :content, rating = :rating, reviewDate = :reviewDate',
        ExpressionAttributeValues: {
          ':content': body.content,
          ':rating': body.rating,
          ':reviewDate': body.reviewDate,
        },
      }),
    );

    return {
      statusCode: 201,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({message: 'Review updated'}),
    };
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
