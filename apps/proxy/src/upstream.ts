import { ProxyError } from './errors';

/** Outcome of one call to Google. */
export type CallResult = { ok: true; body: unknown } | { ok: false; reason: 'error' | 'timeout' };

/**
 * Calls Google with a timeout and reports the outcome instead of throwing.
 * Error bodies are discarded: they may echo request details.
 */
export async function fetchUpstream(
  fetchImpl: typeof fetch,
  url: string,
  init: Omit<RequestInit, 'signal'>,
  timeoutMs: number,
): Promise<CallResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal });
    if (!response.ok) return { ok: false, reason: 'error' };
    return { ok: true, body: await response.json() };
  } catch {
    // However the abort surfaces (TimeoutError, AbortError, a wrapped TypeError), the signal knows.
    return { ok: false, reason: signal.aborted ? 'timeout' : 'error' };
  }
}

/** The body of a successful call, or the matching `ProxyError`. */
export function bodyOrThrow(result: CallResult, provider: string): unknown {
  if (result.ok) return result.body;
  if (result.reason === 'timeout') {
    throw new ProxyError('UPSTREAM_TIMEOUT', `The ${provider} did not respond in time`);
  }
  throw new ProxyError('UPSTREAM_ERROR', `The ${provider} returned an error`);
}
