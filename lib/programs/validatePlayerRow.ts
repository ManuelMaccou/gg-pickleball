// Extracted from parsePlayersCsv so the row-edit endpoint
// can validate an edited row with the exact same rules as the initial CSV
// parse, rather than a second copy of the logic that could drift out of
// sync over time.

import { DateTime } from 'luxon';

export interface RawPlayerRowInput {
  name?: string;
  email?: string;
  duprId?: string;
  dateOfBirth?: string;
  age?: number | string;
}

export interface ValidatedPlayerRowCore {
  name?: string;
  email?: string;
  duprId?: string;
  dateOfBirth?: string;
  age?: number;
  isUnder13: boolean;
  validationErrors: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePlayerRow(input: RawPlayerRowInput): ValidatedPlayerRowCore {
  const validationErrors: string[] = [];

  const name = (input.name ?? '').toString().trim();
  const email = (input.email ?? '').toString().trim();
  const duprId = (input.duprId ?? '').toString().trim();
  const dobRaw = (input.dateOfBirth ?? '').toString().trim();
  const ageRaw =
    input.age === undefined || input.age === null ? '' : input.age.toString().trim();

  const hasDob = dobRaw.length > 0;
  const hasAge = ageRaw.length > 0;

  let isUnder13 = false;
  let age: number | undefined;

  if (hasDob && hasAge) {
    validationErrors.push('Provide only one of Date of Birth or Age, not both.');
  } else if (!hasDob && !hasAge) {
    validationErrors.push('Must provide either Date of Birth or Age.');
  } else if (hasDob) {
    const dob = DateTime.fromISO(dobRaw);
    if (!dob.isValid) {
      validationErrors.push('Date of Birth is not a valid date — use YYYY-MM-DD.');
    } else {
      // Current age, as of today — not age at any past event.
      age = Math.floor(DateTime.now().diff(dob, 'years').years);
      isUnder13 = age < 13;
    }
  } else {
    const parsedAge = Number(ageRaw);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      validationErrors.push('Age must be a whole number.');
    } else {
      age = parsedAge;
      isUnder13 = age < 13;
    }
  }

  if (!isUnder13 && validationErrors.length === 0) {
    if (!name) validationErrors.push('Name is required.');
    if (!email) {
      validationErrors.push('Email is required.');
    } else if (!EMAIL_REGEX.test(email)) {
      validationErrors.push('Email is not a valid email address.');
    }
    if (!duprId) validationErrors.push('DUPR ID is required.');
  }

  return {
    name: name || undefined,
    email: email || undefined,
    duprId: duprId || undefined,
    dateOfBirth: dobRaw || undefined,
    age,
    isUnder13,
    validationErrors,
  };
}