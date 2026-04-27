/**
 * Helper utility functions
 */

/**
 * Generate a random string of specified length
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate a SKU based on product name and timestamp
 */
export const generateSKU = (name: string): string => {
  const prefix = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timestamp}`;
};

/**
 * Format currency value
 */
export const formatCurrency = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
};

/**
 * Calculate pagination offset
 */
export const calculateOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

/**
 * Parse cursor for pagination
 */
export const parseCursor = <T>(cursor: string): T | null => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
};

/**
 * Encode cursor for pagination
 */
export const encodeCursor = <T>(data: T): string => {
  return Buffer.from(JSON.stringify(data)).toString('base64');
};

/**
 * Sanitize string for safe SQL/Lucene queries
 */
export const sanitizeSearchTerm = (term: string): string => {
  return term.replace(/[<>'"]/g, '').trim();
};

/**
 * Calculate days between two dates
 */
export const calculateDaysBetween = (startDate: Date, endDate: Date): number => {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if a date is within range
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Pick specific keys from an object
 */
export const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

/**
 * Omit specific keys from an object
 */
export const omit = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach((key) => {
    delete (result as Partial<T>)[key];
  });
  return result;
};

/**
 * Check if value is a valid UUID
 */
export const isValidUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Sleep/delay utility for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry an async function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000,
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt); // Exponential backoff
      }
    }
  }

  throw lastError!;
};
