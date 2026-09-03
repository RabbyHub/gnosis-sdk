import type { EthRpc } from "./types";
import { ethCallFromRpc, type EthCall } from "./types";

export interface JsonRpcOptions {
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class JsonRpcError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

let requestId = 0;

/**
 * A minimal `fetch`-based JSON-RPC caller. Convenience only — if you already
 * have a provider, wrap it yourself and skip this.
 */
export function createJsonRpc(url: string, options: JsonRpcOptions = {}): EthRpc {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!doFetch) {
    throw new Error("No fetch implementation available; pass options.fetch");
  }

  return async <T>(method: string, params: unknown[] = []): Promise<T> => {
    const controller =
      options.timeoutMs != null ? new AbortController() : undefined;
    const timer =
      controller && options.timeoutMs != null
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : undefined;

    try {
      const response = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++requestId,
          method,
          params,
        }),
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw new JsonRpcError(
          `RPC request failed: ${response.status} ${response.statusText}`,
          response.status,
        );
      }

      const body = await response.json();
      if (body.error) {
        throw new JsonRpcError(
          body.error.message ?? "RPC error",
          body.error.code ?? -1,
          body.error.data,
        );
      }
      return body.result as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

/** Shorthand for `ethCallFromRpc(createJsonRpc(url))`. */
export function createEthCall(
  url: string,
  options?: JsonRpcOptions,
): EthCall {
  return ethCallFromRpc(createJsonRpc(url, options));
}
