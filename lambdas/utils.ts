import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerEvent,
  PolicyDocument,
  APIGatewayProxyEvent,
} from 'aws-lambda';

import axios from 'axios';
import jwt, {JwtPayload} from 'jsonwebtoken';
import jwkToPem, {JWK} from 'jwk-to-pem';

export type CookieMap = {[key: string]: string} | undefined;
export type JwtToken = {sub: string; email: string} | null;
export type Jwk = {
  keys: {
    alg: string;
    e: string;
    kid: string;
    kty: string;
    n: string;
    use: string;
  }[];
};

export const parseCookies = (
  event: APIGatewayRequestAuthorizerEvent | APIGatewayProxyEvent,
) => {
  if (!event.headers || !event.headers.Cookie) {
    return undefined;
  }

  const cookiesStr = event.headers.Cookie;
  const cookiesArr = cookiesStr.split(';');

  const cookieMap: CookieMap = {};

  for (let cookie of cookiesArr) {
    const cookieSplit = cookie.trim().split('=');
    cookieMap[cookieSplit[0]] = cookieSplit[1];
  }

  return cookieMap;
};

export const verifyToken = async (
  token: string,
  userPoolId: string | undefined,
  region: string,
): Promise<JwtToken> => {
  try {
    const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const {data}: {data: Jwk} = await axios.get(url);
    const pem = jwkToPem(data.keys[0] as JWK);

    // return jwt.verify(token, pem, {algorithms: ['RS256']});
    const decoded = jwt.verify(token, pem, {algorithms: ['RS256']});

    if (typeof decoded === 'string') {
      return null;
    }

    return {sub: decoded.sub, email: decoded.email} as JwtToken;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const createPolicy = (
  event: APIGatewayAuthorizerEvent,
  effect: string,
): PolicyDocument => {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: effect,
        Action: 'execute-api:Invoke',
        Resource: [event.methodArn],
      },
    ],
  };
};

export const apiResponse = (
  statusCode: number,
  body: {[key: string]: any},
) => {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};
