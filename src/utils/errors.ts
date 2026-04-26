export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(409, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(500, message, details);
  }
}
