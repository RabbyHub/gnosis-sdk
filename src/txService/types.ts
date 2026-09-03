import type { EIP712TypedData } from "@safe-global/types-kit";

export interface SafeInfo {
  address: string;
  fallbackHandler: string;
  guard: string;
  masterCopy: string;
  modules: string[];
  nonce: string;
  owners: string[];
  threshold: number;
  version: string;
}

export interface ConfirmationItem {
  owner: string;
  submissionDate: string;
  transactionHash: string | null;
  signature: string;
  signatureType: string;
}

export interface SafeTransactionItem {
  safe: string;
  to: string;
  value: string;
  data: string | null;
  operation: number;
  gasToken: string;
  safeTxGas: number;
  baseGas: number;
  gasPrice: string;
  refundReceiver: string;
  nonce: number;
  executionDate: string | null;
  submissionDate: string;
  modified: string;
  blockNumber: number | null;
  transactionHash: string | null;
  safeTxHash: string;
  executor: string | null;
  isExecuted: boolean;
  confirmations: ConfirmationItem[];
  signatures: string | null;
}

export interface SafeMessageConfirmation {
  created: string;
  modified: string;
  owner: string;
  signature: string;
  signatureType: string;
}

export interface SafeMessageItem {
  created: string;
  modified: string;
  safe: string;
  messageHash: string;
  message: string | EIP712TypedData;
  proposedBy: string;
  safeAppId: number | null;
  confirmations: SafeMessageConfirmation[];
  preparedSignature: string | null;
}

export interface ListResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

/** Payload accepted by `POST /v1/safes/{address}/multisig-transactions/`. */
export interface ProposeTransactionPayload {
  safe: string;
  to: string;
  value: string;
  data: string | null;
  operation: number;
  gasToken: string;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  refundReceiver: string;
  nonce: number;
  contractTransactionHash: string;
  sender: string;
  signature: string;
  origin?: string;
}

export interface AddMessagePayload {
  message: string | EIP712TypedData;
  signature: string;
  safeAppId?: number;
}

export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  ordering?: string;
}

/** Minimal transaction fields the gas estimation endpoint needs. */
export interface EstimateGasPayload {
  to: string;
  value: string;
  data: string | null;
  operation: number;
}

/**
 * Everything this SDK needs from a Safe transaction service.
 *
 * Two implementations ship with the SDK: one that speaks HTTP to a Safe
 * transaction service, and one that forwards to a host-supplied backend
 * service. The rest of the SDK is written against this interface only, so the
 * "which backend" decision is made once, in `createSafeTxService`.
 */
export interface SafeTxService {
  getSafeInfo(safeAddress: string): Promise<SafeInfo>;
  getPendingTransactions(
    safeAddress: string,
    nonce: number,
  ): Promise<ListResponse<SafeTransactionItem>>;
  proposeTransaction(
    safeAddress: string,
    payload: ProposeTransactionPayload,
  ): Promise<void>;
  confirmTransaction(safeTxHash: string, signature: string): Promise<void>;
  estimateSafeTxGas(
    safeAddress: string,
    payload: EstimateGasPayload,
  ): Promise<string | undefined>;
  getMessages(
    safeAddress: string,
    options?: GetMessagesOptions,
  ): Promise<ListResponse<SafeMessageItem>>;
  addMessage(safeAddress: string, payload: AddMessagePayload): Promise<void>;
  getMessage(messageHash: string): Promise<SafeMessageItem>;
  addMessageSignature(messageHash: string, signature: string): Promise<void>;
}
