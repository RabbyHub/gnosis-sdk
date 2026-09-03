import { isAtLeastVersion } from "./version";
import { ZERO_ADDRESS } from "./constants";
import type {
  SafeTransactionData,
  SafeTransactionDataPartial,
} from "./types";

/**
 * Safe < 1.3.0 verifies `safeTxGas` inside `execTransaction`, so it has to be
 * estimated. From 1.3.0 on it is only used for refunds and 0 is correct.
 */
export function requiresSafeTxGas(safeVersion: string): boolean {
  return !isAtLeastVersion(safeVersion, "1.3.0");
}

export interface BuildTransactionParams {
  nonce: number;
  safeTxGas: string;
}

/**
 * Fill in every field the Safe contract hashes. Pure: the caller resolves
 * `nonce` and `safeTxGas` first, so the same input always produces the same
 * transaction — and the same safeTxHash.
 */
export function buildSafeTransactionData(
  tx: SafeTransactionDataPartial,
  { nonce, safeTxGas }: BuildTransactionParams,
): SafeTransactionData {
  return {
    to: tx.to,
    value: `${tx.value ?? "0"}`,
    data: tx.data || "0x",
    operation: tx.operation ?? 0,
    safeTxGas: `${safeTxGas ?? "0"}`,
    baseGas: `${tx.baseGas ?? "0"}`,
    gasPrice: `${tx.gasPrice ?? "0"}`,
    gasToken: tx.gasToken || ZERO_ADDRESS,
    refundReceiver: tx.refundReceiver || ZERO_ADDRESS,
    nonce,
  };
}
