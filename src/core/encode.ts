import { encodeFunctionData, getAddress } from "viem";
import { SAFE_ABI } from "./abi";
import { encodeSignatures } from "./signature";
import type {
  Hex,
  SafeSignature,
  SafeTransactionData,
  UnsignedTransaction,
} from "./types";

/**
 * Build the unsigned transaction that executes a Safe transaction.
 *
 * The SDK stops here on purpose: it never sends. Gas, nonce, fee fields and the
 * signing account are the caller's business.
 */
export function encodeExecTransaction(
  safeAddress: string,
  txData: SafeTransactionData,
  signatures: SafeSignature[],
): UnsignedTransaction {
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [
      getAddress(txData.to),
      BigInt(txData.value),
      (txData.data || "0x") as Hex,
      txData.operation,
      BigInt(txData.safeTxGas),
      BigInt(txData.baseGas),
      BigInt(txData.gasPrice),
      getAddress(txData.gasToken),
      getAddress(txData.refundReceiver),
      encodeSignatures(signatures),
    ],
  });

  return { to: getAddress(safeAddress), data, value: "0" };
}

/** Unsigned transaction for approving a safeTxHash on-chain. */
export function encodeApproveHash(
  safeAddress: string,
  safeTxHash: string,
): UnsignedTransaction {
  return {
    to: getAddress(safeAddress),
    data: encodeFunctionData({
      abi: SAFE_ABI,
      functionName: "approveHash",
      args: [safeTxHash as Hex],
    }),
    value: "0",
  };
}
