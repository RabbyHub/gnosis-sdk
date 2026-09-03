import networks from "./networks.json";

export interface SafeNetwork {
  /** Decimal chain id, as a string. */
  chainId: string;
  /** EIP-3770 short name, used to build the transaction service path. */
  shortName: string;
  /** DeBank chain enum, if the chain is known to DeBank. */
  enum?: string;
}

export const SAFE_NETWORKS = networks as SafeNetwork[];

const byChainId = new Map(SAFE_NETWORKS.map((n) => [n.chainId, n]));

/**
 * Chains served through the backend proxy path, keyed by chain id.
 * Chains that need a direct Safe transaction service URL go in `HOST_MAP`.
 */
export const HOST_MAP: Record<string, string> = {
  /** blast */
  "81457": "https://safe-transaction-blast.safe.global/api",
};

export const GNOSIS_SUPPORT_CHAINS: string[] = SAFE_NETWORKS.map((n) => n.enum)
  .filter((e): e is string => Boolean(e))
  .concat(["BLAST"]);

export function getSafeNetwork(chainId: string | number): SafeNetwork | undefined {
  return byChainId.get(String(chainId));
}

/**
 * Transaction service base URL for a chain.
 *
 * Returns a *relative* path for chains routed through the backend proxy, and an
 * absolute URL for chains talking to Safe directly. Which one you get decides
 * whether the SDK uses HTTP or the injected backend service — see
 * `createSafeTxService`.
 */
export function getTxServiceUrl(chainId: string | number): string | undefined {
  const network = getSafeNetwork(chainId);
  if (network) {
    return `/v1/safe-tx-service/${network.shortName}/api`;
  }
  return HOST_MAP[String(chainId)];
}

export function isSupportedChain(chainId: string | number): boolean {
  return getTxServiceUrl(chainId) !== undefined;
}
