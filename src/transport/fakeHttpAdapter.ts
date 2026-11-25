import { HttpAdapter } from './http';

export interface RecordedHttpCall {
  input: string;
  init?: RequestInit;
}

export type FakeHttpResponder = (
  input: string,
  init?: RequestInit
) => Response | Promise<Response>;

/**
 * Deterministic in-process HttpAdapter for testing Plutus transport operations
 * without touching network or browser fetch.
 */
export class FakeHttpAdapter implements HttpAdapter {
  readonly calls: RecordedHttpCall[] = [];
  private readonly queue: FakeHttpResponder[] = [];
  private fallbackResponder: FakeHttpResponder | null = null;

  enqueue(responder: FakeHttpResponder): this {
    this.queue.push(responder);
    return this;
  }

  enqueueResponse(response: Response): this {
    return this.enqueue(() => response);
  }

  enqueueJson(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
    statusText = status >= 400 ? 'Error' : 'OK'
  ): this {
    return this.enqueue(
      () =>
        new Response(JSON.stringify(body), {
          status,
          statusText,
          headers: { 'Content-Type': 'application/json', ...headers },
        })
    );
  }

  enqueueText(
    body: string,
    status = 200,
    statusText = status >= 400 ? 'Error' : 'OK'
  ): this {
    return this.enqueue(
      () =>
        new Response(body, {
          status,
          statusText,
          headers: { 'Content-Type': 'text/plain' },
        })
    );
  }

  enqueueEmpty(status = 204, statusText = 'No Content'): this {
    return this.enqueue(
      () =>
        new Response(null, {
          status,
          statusText,
        })
    );
  }

  enqueueThrow(error: Error): this {
    return this.enqueue(() => {
      throw error;
    });
  }

  setDefault(responder: FakeHttpResponder): this {
    this.fallbackResponder = responder;
    return this;
  }

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    this.calls.push({ input, init });
    const responder = this.queue.shift() ?? this.fallbackResponder;
    if (!responder) {
      throw new Error(`FakeHttpAdapter has no queued response for ${input}`);
    }
    return responder(input, init);
  }
}
