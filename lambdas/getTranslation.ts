import {APIGatewayProxyHandlerV2} from 'aws-lambda';
import * as AWS from 'aws-sdk';
import {apiResponse} from './utils';

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand, QueryCommand} from '@aws-sdk/lib-dynamodb';

import Ajv from 'ajv';
import schema from '../shared/types.schema.json';

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions['TranslateQueryParams'] || {},
);

const ddbDocClient = createDDbDocClient();

const translate = new AWS.Translate();

export const handler: APIGatewayProxyHandlerV2 = async (event, _context) => {
  const parameters = event?.pathParameters;
  const reviewerName = parameters?.reviewerName;
  const movieId = parameters?.movieId
    ? parseInt(parameters.movieId)
    : undefined;
  const queryParams = event?.queryStringParameters;

  let targetLanguage: string;
  if (!queryParams || !isValidQueryParams(queryParams)) {
    // Invalid query params
    return apiResponse(400, {Message: 'Invalid language'})
  } else {
    targetLanguage = queryParams!.language;
  }
  
  if (!movieId) {
    return apiResponse(404, {Message: 'Missing movieId'})
  }
  if (!reviewerName) {
    return apiResponse(404, {Message: 'Missing reviewerName'})
  }

  const getCommandOutput = await ddbDocClient.send(
    new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        'movieId': movieId,
        'reviewerName': reviewerName
      }
    })
  );

  if (!getCommandOutput.Item) {
    apiResponse(404, {Message: 'Unable to find review'})
  }
  const body = {
    text: getCommandOutput.Item?.content,
    language: targetLanguage
  }
  const {text, language} = body;
  if (!text) {
    return apiResponse(400, {Message: 'Missing text from the body'});
  }
  if (!language) {
    return apiResponse(400, {Message: 'Missing language from the body'});
  }

  try {
    const translateParams: AWS.Translate.Types.TranslateTextRequest = {
      Text: text,
      SourceLanguageCode: 'en',
      TargetLanguageCode: language,
    };
    const translatedMessage = translate
      .translateText(translateParams)
      .promise();
    return apiResponse(200, {
      translatedMessage: (await translatedMessage).TranslatedText,
    });
  } catch (error) {
    console.log('Error in translation: ', error);
    return apiResponse(400, {message: 'Unable to translate'});
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

