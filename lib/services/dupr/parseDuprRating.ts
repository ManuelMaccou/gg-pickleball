export const parseDuprRating = (val: unknown): number | undefined => {
  if (val == null || val === 'NR') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
};