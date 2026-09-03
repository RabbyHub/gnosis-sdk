import type {
  OperationType,
  SafeTransactionData,
  SafeTransactionDataPartial,
} from "@safe-global/types-kit";

export type { OperationType, SafeTransactionData, SafeTransactionDataPartial };

export type Hex = `0x${string}`;

/**
 * A Safe signature.
 *
 * Structurally compatible with `EthSafeSignature` from `@safe-global/protocol-kit`,
 * but a plain object so it can be serialized and passed across process boundaries
 * (Rabby signs in the background service and hands the result back).
 */
export interface SafeSignature {
  /** Address of the owner that produced the signature. */
  signer: string;
  /** 65-byte ECDSA signature, or the EIP-1271 payload for contract signatures. */
  data: string;
  /** True for EIP-1271 (smart contract) signatures. */
  isContractSignature?: boolean;
}

/**
 * How the raw signature was produced. This decides whether the EIP-191 prefix
 * probe runs, not whether the V value is normalized (that always happens).
 */
export type SigningMethod =
  | "eth_sign"
  | "personal_sign"
  | "eth_signTypedData";

/** An unsigned transaction for the caller to submit however it likes. */
export interface UnsignedTransaction {
  to: string;
  data: Hex;
  value: string;
}

export interface EIP712Field {
  type: string;
  name: string;
}

export interface SafeTypedData<TPrimary extends string, TMessage> {
  types: Record<string, readonly EIP712Field[]>;
  domain: { chainId?: number; verifyingContract: string };
  primaryType: TPrimary;
  message: TMessage;
}

export type SafeTxTypedData = SafeTypedData<"SafeTx", SafeTransactionData>;
export type SafeMessageTypedData = SafeTypedData<
  "SafeMessage",
  { message: string }
>;
