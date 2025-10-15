import User from '@/app/models/User';

/**
 * Escapes special characters in a string for use in a regular expression.
 * This is a local helper function and is not exported.
 * @param input The string to escape.
 * @returns The escaped string.
 */
function escapeRegex(input: string): string {
  // Escape characters with special meaning in regex.
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a unique username based on a base name by checking the database.
 * If the base name exists, it appends a random 3-digit suffix and checks again,
 * repeating until a unique name is found or max attempts are reached.
 * @param baseName The initial name to start with (e.g., "Bob").
 * @returns A promise that resolves to a unique username (e.g., "Bob" or "Bob123").
 * @throws An error if a unique name cannot be generated after several attempts.
 */
export async function generateUniqueUsername(baseName: string): Promise<string> {
  let potentialName = baseName;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10; // A safeguard against an unlikely infinite loop

  while (!isUnique && attempts < maxAttempts) {
    const safeName = escapeRegex(potentialName);
    const query = { name: { $regex: `^${safeName}$`, $options: 'i' } };

    // Check if a user with this name already exists (case-insensitive)
    const existingUser = await User.findOne(query).lean();

    if (!existingUser) {
      isUnique = true; // The name is unique, exit the loop
    } else {
      // Name exists, generate a new one with a random suffix
      const randomSuffix = Math.floor(100 + Math.random() * 900); // 100-999
      potentialName = `${baseName}${randomSuffix}`;
      attempts++;
    }
  }

  if (!isUnique) {
    // This is a fail-safe. It's extremely unlikely to be hit.
    throw new Error(`Could not generate a unique username for "${baseName}" after ${maxAttempts} attempts.`);
  }

  return potentialName;
}