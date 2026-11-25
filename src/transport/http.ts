import {
  authFetch,
  isSessionExpiredError,
  SessionExpiredError,
} from '@yggdrasil-lab/ui';
import { PeriodType } from '../types';

export { isSessionExpiredError, SessionExpiredError };

export interface HttpAdapter {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface MidasApiErrorOptions {
  status: number;
  statusText: string;
  detail: string;
  path: string;
}

export class MidasApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly detail: string;
  readonly path: string;

  constructor(message: string, options: MidasApiErrorOptions) {
    super(message);
    this.name = 'MidasApiError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.detail = options.detail;
    this.path = options.path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isMidasApiError(err: unknown): err is MidasApiError {
  return (
    err instanceof MidasApiError ||
    (err instanceof Error && err.name === 'MidasApiError')
  );
}

export const authHttpAdapter: HttpAdapter = {
  fetch: (input, init) => authFetch(input, init),
};

interface ExtractedErrorDetail {
  detail: string;
  hasBodyDetail: boolean;
}

function formatDetailField(rawDetail: unknown): string | null {
  if (typeof rawDetail === 'string' && rawDetail.trim()) {
    return rawDetail.trim();
  }
  if (!Array.isArray(rawDetail)) return null;

  const messages = rawDetail
    .map((entry) => {
      if (entry && typeof entry === 'object' && 'msg' in entry) {
        const msg = (entry as { msg?: unknown }).msg;
        return typeof msg === 'string' ? msg.trim() : '';
      }
      return '';
    })
    .filter((msg) => msg.length > 0);

  return messages.length > 0 ? messages.join('; ') : null;
}

export async function extractErrorDetail(res: Response): Promise<ExtractedErrorDetail> {
  const rawText = (await res.text().catch(() => '')).trim();
  if (rawText) {
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
        const formatted = formatDetailField((parsed as { detail?: unknown }).detail);
        if (formatted) {
          return { detail: formatted, hasBodyDetail: true };
        }
      }
    } catch {
      // Plain text error body: use raw response text directly.
    }
    return { detail: rawText, hasBodyDetail: true };
  }

  const fallback = res.statusText.trim() || `HTTP ${res.status}`;
  return { detail: fallback, hasBodyDetail: false };
}

export interface RequestOptions extends RequestInit {
  fallbackError?: string;
}

export interface FormDataRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: string;
  fallbackError?: string;
}

export interface HttpClient {
  readonly baseUrl: string;
  buildUrl(path: string, query?: URLSearchParams): string;
  requestJson<T>(path: string, init?: RequestOptions): Promise<T>;
  requestJsonWithResponse<T>(
    path: string,
    init?: RequestOptions
  ): Promise<{ data: T; response: Response }>;
  requestVoid(path: string, init?: RequestOptions): Promise<void>;
  requestFormData<T>(
    path: string,
    formData: FormData,
    init?: FormDataRequestOptions
  ): Promise<T>;
}

export function appendPeriodParams(
  params: URLSearchParams,
  period?: PeriodType,
  startDate?: string,
  endDate?: string
): void {
  if (period && period !== 'custom') {
    params.set('period', period);
    return;
  }
  if (period === 'custom' || (!period && (startDate || endDate))) {
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
  }
}

export function jsonRequestInit(
  method: 'POST' | 'PUT' | 'PATCH',
  payload: unknown,
  fallbackError?: string
): RequestOptions {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackError,
  };
}

async function toMidasApiError(
  res: Response,
  path: string,
  fallbackError?: string
): Promise<MidasApiError> {
  const { detail, hasBodyDetail } = await extractErrorDetail(res);
  const message = hasBodyDetail
    ? detail
    : fallbackError
      ? `${fallbackError}: ${detail}`
      : detail;
  return new MidasApiError(message, {
    status: res.status,
    statusText: res.statusText,
    detail,
    path,
  });
}

export function createHttpClient(
  adapter: HttpAdapter = authHttpAdapter,
  baseUrl = '/api'
): HttpClient {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  const buildUrl = (path: string, query?: URLSearchParams): string => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const qs = query ? query.toString() : '';
    return `${normalizedBase}${normalizedPath}${qs ? `?${qs}` : ''}`;
  };

  const execute = async (path: string, init?: RequestOptions): Promise<Response> => {
    const { fallbackError, ...fetchInit } = init ?? {};
    const url = buildUrl(path);
    const res = await adapter.fetch(url, fetchInit);
    if (!res.ok) {
      throw await toMidasApiError(res, path, fallbackError);
    }
    return res;
  };

  const requestJsonWithResponse = async <T>(
    path: string,
    init?: RequestOptions
  ): Promise<{ data: T; response: Response }> => {
    const response = await execute(path, init);
    const data = (await response.json()) as T;
    return { data, response };
  };

  const requestJson = async <T>(path: string, init?: RequestOptions): Promise<T> => {
    const { data } = await requestJsonWithResponse<T>(path, init);
    return data;
  };

  const requestVoid = async (path: string, init?: RequestOptions): Promise<void> => {
    await execute(path, init);
  };

  const requestFormData = async <T>(
    path: string,
    formData: FormData,
    init?: FormDataRequestOptions
  ): Promise<T> => {
    const { method = 'POST', fallbackError, ...rest } = init ?? {};
    return requestJson<T>(path, {
      ...rest,
      method,
      body: formData,
      fallbackError,
    });
  };

  return {
    baseUrl: normalizedBase,
    buildUrl,
    requestJson,
    requestJsonWithResponse,
    requestVoid,
    requestFormData,
  };
}
