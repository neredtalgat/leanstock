export const generateCode = (prefix: string, timestamp: number = Date.now()): string => {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${randomPart}`;
};

export const generateSKU = (): string => {
  return 'SKU-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const generateBarcode = (): string => {
  return Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
};

export const parseIntOrDefault = (value: any, defaultValue: number = 0): number => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const sleepMs = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const createCursor = (id: string): string => {
  return Buffer.from(id).toString('base64');
};

export const decodeCursor = (cursor: string): string => {
  return Buffer.from(cursor, 'base64').toString('utf-8');
};

export default {
  generateCode,
  generateSKU,
  generateBarcode,
  parseIntOrDefault,
  sleepMs,
  createCursor,
  decodeCursor,
};
