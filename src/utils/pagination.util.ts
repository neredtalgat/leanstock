// Standard pagination utilities for API consistency

// Type for items that support cursor-based pagination
interface CursorPaginable {
  createdAt?: string | Date;
  id?: string;
}

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
  maxLimit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    count?: number;
    limit: number;
    nextCursor?: string;
  };
}

export interface OffsetPaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Cursor-based pagination (recommended for infinite scroll)
export const createCursorPagination = <T>(
  items: T[],
  limit: number,
  cursor?: string
): PaginationResult<T> => {
  const maxLimit = Math.min(limit, 100); // Max 100 items per page
  
  let startIndex = 0;
  if (cursor) {
    // Decode cursor (base64 encoded timestamp)
    try {
      const decoded = Buffer.from(cursor, 'base64').toString();
      startIndex = items.findIndex((item: CursorPaginable) => 
        item.createdAt === decoded || 
        item.id === cursor
      );
      startIndex = startIndex >= 0 ? startIndex + 1 : 0;
    } catch {
      // Invalid cursor, start from beginning
      startIndex = 0;
    }
  }
  
  const paginatedItems = items.slice(startIndex, startIndex + maxLimit);
  const hasMore = startIndex + maxLimit < items.length;
  
  // Generate next cursor
  let nextCursor;
  if (hasMore && paginatedItems.length > 0) {
    const lastItem = paginatedItems[paginatedItems.length - 1];
    const lastCursor = (lastItem as CursorPaginable).createdAt || (lastItem as CursorPaginable).id;
    if (lastCursor) {
      nextCursor = Buffer.from(String(lastCursor)).toString('base64');
    }
  }
  
  return {
    data: paginatedItems,
    pagination: {
      cursor: nextCursor,
      hasMore,
      count: paginatedItems.length,
      limit: maxLimit,
      nextCursor
    }
  };
};

// Offset-based pagination (traditional)
export const createOffsetPagination = <T>(
  items: T[],
  page: number = 1,
  limit: number = 20
): OffsetPaginationResult<T> => {
  const maxLimit = Math.min(limit, 100);
  const offset = (page - 1) * maxLimit;
  
  const paginatedItems = items.slice(offset, offset + maxLimit);
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / maxLimit);
  
  return {
    data: paginatedItems,
    pagination: {
      page,
      limit: maxLimit,
      total: totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Parse and validate pagination parameters
export const parsePaginationParams = (query: Record<string, unknown>): PaginationOptions => {
  const limit = Math.min(
    Math.max(parseInt(String(query.limit)) || 20, 1),
    100
  );
  
  const cursor = query.cursor ? String(query.cursor) : undefined;
  
  return {
    cursor,
    limit
  };
};

// Parse and validate offset pagination parameters
export const parseOffsetParams = (query: Record<string, unknown>) => {
  const page = Math.max(parseInt(String(query.page)) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(String(query.limit)) || 20, 1),
    100
  );
  
  return { page, limit };
};

// Generate pagination metadata for responses
export const generatePaginationMeta = (
  total: number,
  page: number,
  limit: number
) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};
