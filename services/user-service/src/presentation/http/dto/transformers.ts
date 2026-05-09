import { TransformFnParams } from 'class-transformer';

export const toOptionalTrimmedString = ({ value }: TransformFnParams) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export const toNullableTrimmedString = ({ value }: TransformFnParams) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const toCsvArray = ({ value }: TransformFnParams) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const toUniqueStringArray = ({ value }: TransformFnParams) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return [...new Set(value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter((item) => typeof item === 'string' && item.length > 0))];
};
