// `slot` is an insertion position in the list with the moving item removed.
export function reorderAtSlot<T extends { id: string }>(
  items: readonly T[],
  id: string,
  slot: number,
): T[] | null {
  const from = items.findIndex((item) => item.id === id);
  if (
    from < 0 ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= items.length ||
    from === slot
  )
    return null;
  const next = items.filter((item) => item.id !== id);
  next.splice(slot, 0, items[from]);
  return next;
}

export function restoreOrder<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] | null {
  if (items.length !== ids.length || new Set(ids).size !== ids.length)
    return null;
  const byId = new Map(items.map((item) => [item.id, item]));
  if (
    byId.size !== items.length ||
    ids.some((id) => !byId.has(id)) ||
    ids.every((id, index) => id === items[index].id)
  )
    return null;
  return ids.map((id) => byId.get(id)!);
}
