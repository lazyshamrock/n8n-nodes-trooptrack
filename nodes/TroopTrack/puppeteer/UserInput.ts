export function readUserIds(items: Array<{ json: any }>, userIdField: string): Array<{ idx: number; userId: string }> {
  return items
    .map((it, idx) => {
      const raw = it.json?.[userIdField];
      const userId = raw === undefined || raw === null ? '' : String(raw).trim();
      return { idx, userId };
    })
    .filter((x) => x.userId.length > 0);
}

export function setNullFields(items: Array<{ json: any }>, fields: string[]): Array<{ json: any }> {
  return items.map((it) => {
    const out = { ...it.json };
    for (const f of fields) out[f] = null;
    return { json: out };
  });
}

export function mergeFieldsByUserId(
  items: Array<{ json: any }>,
  userIdField: string,
  dataByUserId: Record<string, Record<string, any>>,
  fields: string[]
): Array<{ json: any }> {
  return items.map((it) => {
    const out = { ...it.json };
    const userId = String(out?.[userIdField] ?? '').trim();

    for (const f of fields) out[f] = null;

    if (userId && dataByUserId[userId]) {
      for (const f of fields) out[f] = dataByUserId[userId][f] ?? null;
    }

    return { json: out };
  });
}
