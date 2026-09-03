import { getTxServiceUrl } from "../chains/registry";
import { BackendSafeTxService, type SafeBackendService } from "./backend";
import { HttpSafeTxService } from "./http";
import type { SafeTxService } from "./types";

export * from "./types";

/**
 * Re-exported for consumers that deep-import `dist/txService`.
 * @deprecated Import from `../chains/registry` instead.
 */
export {
  GNOSIS_SUPPORT_CHAINS,
  HOST_MAP,
  getTxServiceUrl,
  getSafeNetwork,
  isSupportedChain,
  SAFE_NETWORKS,
  type SafeNetwork,
} from "../chains/registry";
export * from "./http";
export * from "./backend";

export interface CreateSafeTxServiceOptions {
  chainId: string | number;
  /** Host backend that proxies the transaction service. */
  backend?: SafeBackendService;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

/** Absolute URLs are talked to directly; relative ones need a host backend. */
const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

/**
 * Pick the transaction service implementation for a chain.
 *
 * This is the single place the "backend proxy or direct HTTP" decision is made.
 * A relative `txServiceUrl` is a proxy path that only the host backend knows how
 * to resolve, so a backend is required for those chains.
 */
export function createSafeTxService({
  chainId,
  backend,
  fetch,
  headers,
}: CreateSafeTxServiceOptions): SafeTxService {
  const txServiceUrl = getTxServiceUrl(chainId);
  if (!txServiceUrl) {
    throw new Error(`Safe is not supported on chain ${chainId}`);
  }

  const http = new HttpSafeTxService({ baseUrl: txServiceUrl, fetch, headers });

  if (isAbsoluteUrl(txServiceUrl)) {
    return http;
  }

  if (!backend) {
    throw new Error(
      `Chain ${chainId} is served through a backend proxy (${txServiceUrl}); ` +
        "pass `backend` to createSafeClient",
    );
  }

  return new BackendSafeTxService(txServiceUrl, backend, http);
}
