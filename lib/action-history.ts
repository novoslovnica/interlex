export interface ActionHistoryEntry {
  author: string;
  timestamp: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

export function buildEntry(
  author: string,
  changes: Record<string, { old: unknown; new: unknown }>,
): ActionHistoryEntry {
  return { author, timestamp: new Date().toISOString(), changes };
}

export function append(
  existing: string | null | undefined,
  entry: ActionHistoryEntry,
): string {
  const history: ActionHistoryEntry[] = existing ? JSON.parse(existing) : [];
  history.push(entry);
  return JSON.stringify(history);
}