import {marshall} from '@aws-sdk/util-dynamodb';
import {MovieReviews} from './types';

export const generateMovieReviewItem = (movie: MovieReviews) => {
  return {
    PutRequest: {
      Item: marshall(movie),
    },
  };
};

export const generateBatch = (data: MovieReviews[]) => {
  return data.map(e => {
    return generateMovieReviewItem(e);
  });
};
