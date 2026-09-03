import type { Hex } from "../core/types";

/**
 * The only thing this SDK ever asks of a chain: an `eth_call`.
 *
 * No provider object, no signer, no `eth_sendTransaction`. Supply one of these
 * per chain and the SDK works everywhere; omit it and everything that does not
 * touch the chain (hashing, encoding, transaction-service queries) still works.
 */
export type EthCall = (tx: { to: string; data: Hex }) => Promise<Hex>;

/** A raw JSON-RPC caller, if you already have one. */
export type EthRpc = <T = unknown>(
  method: string,
  params?: unknown[],
) => Promise<T>;

/** Adapt a generic JSON-RPC caller to the `EthCall` this SDK needs. */
export function ethCallFromRpc(rpc: EthRpc): EthCall {
  return (tx) => rpc<Hex>("eth_call", [{ to: tx.to, data: tx.data }, "latest"]);
}
