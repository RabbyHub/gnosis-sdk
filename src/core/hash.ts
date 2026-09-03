import { hashMessage, hashTypedData as viemHashTypedData } from "viem";
import type { EIP712TypedData } from "@safe-global/types-kit";
import {
  getSafeMessageTypedData,
  getSafeTxTypedData,
  type TypedDataParams,
} from "./typedData";
import type { Hex, SafeTransactionData } from "./types";

/**
 * safeTxHash — the hash owners sign and the value the transaction service keys
 * transactions by. Computed entirely off-chain; the on-chain
 * `getTransactionHash` call it replaces was a pure function of the same inputs.
 */
export function hashSafeTransaction(
  params: TypedDataParams,
  txData: SafeTransactionData,
): Hex {
  return viemHashTypedData(
    getSafeTxTypedData(params, txData) as any,
  );
}

/** Hash of the message a Safe is asked to sign, before the Safe wraps it. */
export function hashRawMessage(message: string | EIP712TypedData): Hex {
  return typeof message === "string"
    ? hashMessage(message)
    : viemHashTypedData(message as any);
}

/**
 * The Safe message hash — what `CompatibilityFallbackHandler.getMessageHash()`
 * returns, and the key the transaction service stores messages under.
 */
export function hashSafeMessage(
  params: TypedDataParams,
  message: string | EIP712TypedData,
): Hex {
  return viemHashTypedData(
    getSafeMessageTypedData(params, hashRawMessage(message)) as any,
  );
}
