import { Types } from 'mongoose';

/**
 * Populates a Map<string, ObjectId> field (like rewardsPerAchievement)
 * with full documents from the given Mongoose model.
 *
 * @param mapField The Map<string, ObjectId> to populate
 * @param modelQuery A function that fetches the full docs by ObjectIds
 * @returns A plain object mapping keys to populated documents
 */
export async function populateMapField<T extends { _id: Types.ObjectId }>(
  mapField: Map<string, Types.ObjectId>,
  modelQuery: (ids: Types.ObjectId[]) => Promise<T[]>
): Promise<Record<string, T>> {
  const ids = Array.from(mapField.values());
  const docs = await modelQuery(ids);

  const result: Record<string, T> = {};

  for (const [key, id] of mapField.entries()) {
    const doc = docs.find(d => d._id.equals(id));
    if (doc) {
      result[key] = doc;
    }
  }

  return result;
}
