export class DomainError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode = 400, errorCode = 'DOMAIN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required', errorCode = 'UNAUTHORIZED') {
    super(message, 401, errorCode);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden action or outside jurisdiction scope', errorCode = 'FORBIDDEN') {
    super(message, 403, errorCode);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Resource conflict or invariant violation', errorCode = 'CONFLICT') {
    super(message, 409, errorCode);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed', errorCode = 'VALIDATION_ERROR') {
    super(message, 422, errorCode);
  }
}

export class GuardConditionFailedError extends DomainError {
  constructor(message: string, errorCode = 'GUARD_CONDITION_FAILED') {
    super(message, 400, errorCode);
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(fromState: string, toState: string, reason?: string) {
    super(
      `Invalid state transition from '${fromState}' to '${toState}'${reason ? `: ${reason}` : ''}`,
      400,
      'INVALID_STATE_TRANSITION'
    );
  }
}

export class UnauthorizedTransitionError extends DomainError {
  constructor(message: string) {
    super(message, 403, 'UNAUTHORIZED_TRANSITION');
  }
}

export class SecurityViolationError extends DomainError {
  constructor(message = 'Security invariant or cryptographic check failed', errorCode = 'SECURITY_VIOLATION') {
    super(message, 403, errorCode);
  }
}

export function formatErrorDetail(error: unknown): { detail: string; code?: string } {
  if (error instanceof DomainError) {
    return { detail: error.message, code: error.errorCode };
  }
  if (error instanceof Error) {
    return { detail: error.message, code: 'INTERNAL_ERROR' };
  }
  return { detail: String(error), code: 'UNKNOWN_ERROR' };
}
