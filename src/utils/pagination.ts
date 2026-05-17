export interface CursorPaginationInput {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export function buildCursorWhere(cursor?: string, sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc'): any {
  if (!cursor) return {};
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    const operator = sortOrder === 'desc' ? 'lt' : 'gt';
    return { [sortBy]: { [operator]: decoded[sortBy] } };
  } catch {
    return {};
  }
}

export function encodeCursor(item: any, sortBy: string = 'createdAt'): string {
  return Buffer.from(JSON.stringify({ [sortBy]: item[sortBy] })).toString('base64');
}

export function paginateResults<T>(items: T[], limit: number, sortBy: string = 'createdAt'): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore && resultItems.length > 0 ? encodeCursor(resultItems[resultItems.length - 1], sortBy) : null;
  return { items: resultItems, nextCursor, hasMore };
}
