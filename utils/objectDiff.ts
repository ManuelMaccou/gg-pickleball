import isEqual from 'lodash.isequal';

export const areObjectsDifferent = (objA: unknown, objB: unknown): boolean => {
  return !isEqual(objA, objB);
};