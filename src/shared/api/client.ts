import { env } from '../config/env';
import type { ApiErrorEnvelope } from '../types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly details: ApiErrorEnvelope | undefined;

  constructor(status: number, details?: ApiErrorEnvelope) {
    super(details?.message ?? 'The request could not be completed.');
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string' &&
    'requestId' in value &&
    typeof value.requestId === 'string'
  );
}

export async function apiRequest(
  path: `/${string}`,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      isErrorEnvelope(body) ? body : undefined,
    );
  }

  return response;
}
