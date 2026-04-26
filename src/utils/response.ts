import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
  pagination?: {
    nextCursor?: string | null;
    hasMore?: boolean;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400,
  errors?: any
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

export default {
  sendSuccess,
  sendError,
};
