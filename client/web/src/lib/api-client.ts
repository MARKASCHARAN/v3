import { ApiErrorResponse, ApiSuccessResponse, AuthTokens } from '@/types/api';
import {
  clearAuthSession,
  getStoredAuthSession,
  saveAuthSession,
} from './auth-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

const buildUrl = (path: string, query?: Record<string, string | number | undefined>): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

const tryRefreshToken = async (): Promise<string | null> => {
  const session = getStoredAuthSession();
  if (!session?.refreshToken) {
    return null;
  }
  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) {
    clearAuthSession();
    return null;
  }
  const payload = (await response.json()) as ApiSuccessResponse<{ session: AuthTokens }>;
  saveAuthSession({
    accessToken: payload.data.session.access_token,
    refreshToken: payload.data.session.refresh_token,
    user: session.user,
  });
  return payload.data.session.access_token;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const {
    method = 'GET',
    body,
    query,
    auth = true,
    retryOnUnauthorized = true,
  } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const session = getStoredAuthSession();
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const nextToken = await tryRefreshToken();
    if (nextToken) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const payload = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;

  if (!response.ok || !payload.success) {
    const errorPayload = payload as ApiErrorResponse;
    throw new ApiClientError(
      response.status,
      errorPayload.error?.code || 'REQUEST_FAILED',
      errorPayload.error?.message || 'Request failed',
      errorPayload.error?.details
    );
  }

  return payload.data;
};

