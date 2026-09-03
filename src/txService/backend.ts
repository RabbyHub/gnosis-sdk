import type {
  AddMessagePayload,
  EstimateGasPayload,
  GetMessagesOptions,
  ListResponse,
  ProposeTransactionPayload,
  SafeInfo,
  SafeMessageItem,
  SafeTransactionItem,
  SafeTxService,
} from "./types";

/**
 * The host-supplied backend that proxies Safe transaction service calls.
 *
 * Rabby passes its openapi service here. Every method is optional: whatever the
 * host does not implement falls back to a direct HTTP call, so the SDK keeps
 * working while the backend catches up.
 */
export type SafeBackendService = {
  getSafeInfo?: (params: {
    txServiceUrl: string;
    safeAddress: string;
  }) => Promise<SafeInfo>;
  getSafePendingTransactions?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    nonce: number;
  }) => Promise<ListResponse<SafeTransactionItem>>;
  postSafeTransactions?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    data: Record<string, any>;
  }) => Promise<void>;
  confirmSafeTransaction?: (params: {
    txServiceUrl: string;
    safeTransactionHash: string;
    data: Record<string, any>;
  }) => Promise<void>;
  getSafeTxGas?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    safeTxData: {
      to: string;
      value?: string;
      data?: string | null;
      operation?: number;
    };
  }) => Promise<string | undefined>;
  getSafeMessages?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    options?: Record<string, any>;
  }) => Promise<ListResponse<SafeMessageItem>>;
  addSafeMessage?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    data: AddMessagePayload;
  }) => Promise<void>;
  getSafeMessage?: (params: {
    txServiceUrl: string;
    messageHash: string;
  }) => Promise<SafeMessageItem>;
  addSafeMessageSignature?: (params: {
    txServiceUrl: string;
    messageHash: string;
    signature: string;
  }) => Promise<void>;
};

/**
 * Routes calls to a host backend, falling back per-method to a direct HTTP
 * service when the backend does not implement that endpoint.
 */
export class BackendSafeTxService implements SafeTxService {
  constructor(
    private readonly txServiceUrl: string,
    private readonly backend: SafeBackendService,
    private readonly fallback: SafeTxService,
  ) {}

  getSafeInfo(safeAddress: string): Promise<SafeInfo> {
    return this.backend.getSafeInfo
      ? this.backend.getSafeInfo({ txServiceUrl: this.txServiceUrl, safeAddress })
      : this.fallback.getSafeInfo(safeAddress);
  }

  getPendingTransactions(
    safeAddress: string,
    nonce: number,
  ): Promise<ListResponse<SafeTransactionItem>> {
    return this.backend.getSafePendingTransactions
      ? this.backend.getSafePendingTransactions({
          txServiceUrl: this.txServiceUrl,
          safeAddress,
          nonce,
        })
      : this.fallback.getPendingTransactions(safeAddress, nonce);
  }

  proposeTransaction(
    safeAddress: string,
    payload: ProposeTransactionPayload,
  ): Promise<void> {
    return this.backend.postSafeTransactions
      ? this.backend.postSafeTransactions({
          txServiceUrl: this.txServiceUrl,
          safeAddress,
          data: payload,
        })
      : this.fallback.proposeTransaction(safeAddress, payload);
  }

  confirmTransaction(safeTxHash: string, signature: string): Promise<void> {
    return this.backend.confirmSafeTransaction
      ? this.backend.confirmSafeTransaction({
          txServiceUrl: this.txServiceUrl,
          safeTransactionHash: safeTxHash,
          data: { signature },
        })
      : this.fallback.confirmTransaction(safeTxHash, signature);
  }

  estimateSafeTxGas(
    safeAddress: string,
    payload: EstimateGasPayload,
  ): Promise<string | undefined> {
    return this.backend.getSafeTxGas
      ? this.backend.getSafeTxGas({
          txServiceUrl: this.txServiceUrl,
          safeAddress,
          safeTxData: payload,
        })
      : this.fallback.estimateSafeTxGas(safeAddress, payload);
  }

  getMessages(
    safeAddress: string,
    options?: GetMessagesOptions,
  ): Promise<ListResponse<SafeMessageItem>> {
    return this.backend.getSafeMessages
      ? this.backend.getSafeMessages({
          txServiceUrl: this.txServiceUrl,
          safeAddress,
          options,
        })
      : this.fallback.getMessages(safeAddress, options);
  }

  addMessage(safeAddress: string, payload: AddMessagePayload): Promise<void> {
    return this.backend.addSafeMessage
      ? this.backend.addSafeMessage({
          txServiceUrl: this.txServiceUrl,
          safeAddress,
          data: payload,
        })
      : this.fallback.addMessage(safeAddress, payload);
  }

  getMessage(messageHash: string): Promise<SafeMessageItem> {
    return this.backend.getSafeMessage
      ? this.backend.getSafeMessage({
          txServiceUrl: this.txServiceUrl,
          messageHash,
        })
      : this.fallback.getMessage(messageHash);
  }

  addMessageSignature(messageHash: string, signature: string): Promise<void> {
    return this.backend.addSafeMessageSignature
      ? this.backend.addSafeMessageSignature({
          txServiceUrl: this.txServiceUrl,
          messageHash,
          signature,
        })
      : this.fallback.addMessageSignature(messageHash, signature);
  }
}
