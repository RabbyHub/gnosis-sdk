import { isAtLeastVersion } from "./version";
import type {
  EIP712Field,
  SafeMessageTypedData,
  SafeTransactionData,
  SafeTxTypedData,
} from "./types";

const CHAIN_ID_SINCE = "1.3.0";

/** Safe < 1.3.0 does not bind the domain to a chain, so its hashes replay across chains. */
export const EIP712_DOMAIN_BEFORE_V130: readonly EIP712Field[] = [
  { type: "address", name: "verifyingContract" },
];

export const EIP712_DOMAIN: readonly EIP712Field[] = [
  { type: "uint256", name: "chainId" },
  { type: "address", name: "verifyingContract" },
];

export const SAFE_TX_TYPE: readonly EIP712Field[] = [
  { type: "address", name: "to" },
  { type: "uint256", name: "value" },
  { type: "bytes", name: "data" },
  { type: "uint8", name: "operation" },
  { type: "uint256", name: "safeTxGas" },
  { type: "uint256", name: "baseGas" },
  { type: "uint256", name: "gasPrice" },
  { type: "address", name: "gasToken" },
  { type: "address", name: "refundReceiver" },
  { type: "uint256", name: "nonce" },
];

export const SAFE_MESSAGE_TYPE: readonly EIP712Field[] = [
  { type: "bytes", name: "message" },
];

/** Whether the EIP-712 domain of this Safe version carries `chainId`. */
export function domainIncludesChainId(safeVersion: string): boolean {
  return isAtLeastVersion(safeVersion, CHAIN_ID_SINCE);
}

function buildDomain(
  safeAddress: string,
  safeVersion: string,
  chainId: number | string | bigint,
) {
  return domainIncludesChainId(safeVersion)
    ? { chainId: Number(chainId), verifyingContract: safeAddress }
    : { verifyingContract: safeAddress };
}

function domainType(safeVersion: string): readonly EIP712Field[] {
  return domainIncludesChainId(safeVersion)
    ? EIP712_DOMAIN
    : EIP712_DOMAIN_BEFORE_V130;
}

export interface TypedDataParams {
  safeAddress: string;
  safeVersion: string;
  chainId: number | string | bigint;
}

/**
 * EIP-712 payload for a Safe transaction. Ready to hash locally *or* to hand to
 * `eth_signTypedData_v4` — uint256 fields stay decimal strings so the payload
 * survives JSON serialization.
 */
export function getSafeTxTypedData(
  { safeAddress, safeVersion, chainId }: TypedDataParams,
  txData: SafeTransactionData,
): SafeTxTypedData {
  return {
    types: {
      EIP712Domain: domainType(safeVersion),
      SafeTx: SAFE_TX_TYPE,
    },
    domain: buildDomain(safeAddress, safeVersion, chainId),
    primaryType: "SafeTx",
    message: txData,
  };
}

/**
 * EIP-712 payload for an off-chain Safe message.
 *
 * `messageHash` is the hash of the underlying message (`hashMessage` for a
 * string, the EIP-712 hash for typed data) — not the message itself.
 *
 * Note: the domain follows the same version rule as transactions. Off-chain
 * messages require the CompatibilityFallbackHandler (Safe >= 1.3.0), so the
 * chainId-less branch is unreachable in practice and exists only for symmetry.
 */
export function getSafeMessageTypedData(
  { safeAddress, safeVersion, chainId }: TypedDataParams,
  messageHash: string,
): SafeMessageTypedData {
  return {
    types: {
      EIP712Domain: domainType(safeVersion),
      SafeMessage: SAFE_MESSAGE_TYPE,
    },
    domain: buildDomain(safeAddress, safeVersion, chainId),
    primaryType: "SafeMessage",
    message: { message: messageHash },
  };
}
