import { getAddress } from "viem";
import type { EIP712TypedData } from "@safe-global/types-kit";
import { buildSafeTransactionData, requiresSafeTxGas } from "./core/build";
import { encodeApproveHash, encodeExecTransaction } from "./core/encode";
import { hashSafeMessage, hashSafeTransaction } from "./core/hash";
import { encodeSignatures, sameString } from "./core/signature";
import { getSafeMessageTypedData, getSafeTxTypedData } from "./core/typedData";
import type {
  Hex,
  SafeMessageTypedData,
  SafeSignature,
  SafeTransactionData,
  SafeTransactionDataPartial,
  SafeTxTypedData,
  UnsignedTransaction,
} from "./core/types";
import { SafeReader, type SafeBasicInfo } from "./rpc/reads";
import type { EthCall } from "./rpc/types";
import { createSafeTxService } from "./txService";
import type { SafeBackendService } from "./txService/backend";
import type {
  AddMessagePayload,
  GetMessagesOptions,
  ListResponse,
  SafeInfo,
  SafeMessageItem,
  SafeTransactionItem,
  SafeTxService,
} from "./txService/types";

export interface SafeClientConfig {
  chainId: string | number;
  safeAddress: string;
  /** Deployed Safe version. Read it once with `getSafeVersion` and cache it. */
  version: string;
  /**
   * Chain access. Optional: hashing, encoding and every transaction service
   * call work without it. Reads throw a clear error when it is missing.
   */
  ethCall?: EthCall;
  /** Host backend that proxies the transaction service. */
  backend?: SafeBackendService;
  /** Pre-built transaction service, if you want to bypass `createSafeTxService`. */
  txService?: SafeTxService;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

export interface ProposeTransactionParams {
  txData: SafeTransactionData;
  safeTxHash: string;
  /** Owner proposing the transaction. */
  sender: string;
  signature: SafeSignature;
  origin?: string;
}

/**
 * A Safe on one chain.
 *
 * The client reads, builds and encodes. It never signs and never sends: signing
 * is the caller's, and `encodeExecTransaction` hands back an unsigned
 * transaction to submit however the caller likes.
 */
export class SafeClient {
  readonly chainId: string;
  readonly safeAddress: string;
  readonly version: string;
  readonly txService: SafeTxService;

  private readonly reader?: SafeReader;

  constructor(config: SafeClientConfig) {
    this.chainId = String(config.chainId);
    this.safeAddress = getAddress(config.safeAddress);
    this.version = config.version;
    this.txService =
      config.txService ??
      createSafeTxService({
        chainId: this.chainId,
        backend: config.backend,
        fetch: config.fetch,
        headers: config.headers,
      });
    this.reader = config.ethCall
      ? new SafeReader(this.safeAddress, config.ethCall)
      : undefined;
  }

  private get chain(): SafeReader {
    if (!this.reader) {
      throw new Error(
        "This operation needs chain access; pass `ethCall` to createSafeClient",
      );
    }
    return this.reader;
  }

  private get typedDataParams() {
    return {
      safeAddress: this.safeAddress,
      safeVersion: this.version,
      chainId: this.chainId,
    };
  }

  // ── Chain reads ──────────────────────────────────────────────────────────

  // These are `async` so a missing `ethCall` rejects the returned promise
  // rather than throwing synchronously out of an async-looking call.

  async getOwners(): Promise<string[]> {
    return this.chain.getOwners();
  }

  async getThreshold(): Promise<number> {
    return this.chain.getThreshold();
  }

  async getNonce(): Promise<number> {
    return this.chain.getNonce();
  }

  async getBasicInfo(): Promise<SafeBasicInfo> {
    return this.chain.getBasicInfo(this.version);
  }

  async getOwnersWhoApproved(
    safeTxHash: string,
    owners?: string[],
  ): Promise<string[]> {
    return this.chain.getOwnersWhoApproved(safeTxHash, owners);
  }

  // ── Build & hash (no chain access needed once nonce is known) ────────────

  /**
   * Fill in the transaction's missing fields.
   *
   * Reads the nonce on-chain and, for Safe < 1.3.0, asks the transaction
   * service to estimate `safeTxGas`. Supply both in `overrides` to make this
   * call entirely offline.
   */
  async buildTransaction(
    tx: SafeTransactionDataPartial,
    overrides: { nonce?: number; safeTxGas?: string } = {},
  ): Promise<SafeTransactionData> {
    const nonce = overrides.nonce ?? tx.nonce ?? (await this.getNonce());

    let safeTxGas = overrides.safeTxGas ?? tx.safeTxGas;
    if (safeTxGas === undefined) {
      safeTxGas = requiresSafeTxGas(this.version)
        ? await this.estimateSafeTxGas(tx)
        : "0";
    }

    return buildSafeTransactionData(tx, { nonce, safeTxGas: safeTxGas ?? "0" });
  }

  private async estimateSafeTxGas(
    tx: SafeTransactionDataPartial,
  ): Promise<string> {
    const estimated = await this.txService.estimateSafeTxGas(this.safeAddress, {
      to: getAddress(tx.to),
      value: `${tx.value ?? "0"}`,
      data: tx.data ?? null,
      operation: tx.operation ?? 0,
    });
    return estimated ?? "0";
  }

  /** safeTxHash — computed locally, no RPC. */
  hashTransaction(txData: SafeTransactionData): Hex {
    return hashSafeTransaction(this.typedDataParams, txData);
  }

  /** EIP-712 payload for `eth_signTypedData_v4`. */
  getTransactionTypedData(txData: SafeTransactionData): SafeTxTypedData {
    return getSafeTxTypedData(this.typedDataParams, txData);
  }

  /** The Safe message hash — computed locally, no RPC. */
  hashMessage(message: string | EIP712TypedData): Hex {
    return hashSafeMessage(this.typedDataParams, message);
  }

  getMessageTypedData(messageHash: string): SafeMessageTypedData {
    return getSafeMessageTypedData(this.typedDataParams, messageHash);
  }

  // ── Encode (no chain access) ─────────────────────────────────────────────

  /**
   * The unsigned transaction that executes `txData`. Submit it yourself — the
   * SDK does not know or care how you sign and broadcast.
   */
  encodeExecTransaction(
    txData: SafeTransactionData,
    signatures: SafeSignature[],
  ): UnsignedTransaction {
    return encodeExecTransaction(this.safeAddress, txData, signatures);
  }

  /** The unsigned transaction that approves `safeTxHash` on-chain. */
  encodeApproveHash(safeTxHash: string): UnsignedTransaction {
    return encodeApproveHash(this.safeAddress, safeTxHash);
  }

  /**
   * Check a transaction has enough signatures before you spend gas on it.
   * Throws with the number still missing.
   */
  assertExecutable(signatures: SafeSignature[], threshold: number): void {
    if (signatures.length >= threshold) return;
    const missing = threshold - signatures.length;
    throw new Error(
      `There ${missing > 1 ? "are" : "is"} ${missing} signature${
        missing > 1 ? "s" : ""
      } missing`,
    );
  }

  // ── Transaction service ──────────────────────────────────────────────────

  getSafeInfo(): Promise<SafeInfo> {
    return this.txService.getSafeInfo(this.safeAddress);
  }

  async getPendingTransactions(
    nonce?: number,
  ): Promise<ListResponse<SafeTransactionItem>> {
    return this.txService.getPendingTransactions(
      this.safeAddress,
      nonce ?? (await this.getNonce()),
    );
  }

  proposeTransaction({
    txData,
    safeTxHash,
    sender,
    signature,
    origin,
  }: ProposeTransactionParams): Promise<void> {
    return this.txService.proposeTransaction(this.safeAddress, {
      safe: this.safeAddress,
      to: getAddress(txData.to),
      value: txData.value,
      data: txData.data,
      operation: txData.operation,
      gasToken: txData.gasToken,
      safeTxGas: txData.safeTxGas,
      baseGas: txData.baseGas,
      gasPrice: txData.gasPrice,
      refundReceiver: txData.refundReceiver,
      nonce: txData.nonce,
      contractTransactionHash: safeTxHash,
      sender: getAddress(sender),
      signature: signature.data,
      origin,
    });
  }

  confirmTransaction(
    safeTxHash: string,
    signature: SafeSignature,
  ): Promise<void> {
    return this.txService.confirmTransaction(safeTxHash, signature.data);
  }

  getMessages(
    options?: GetMessagesOptions,
  ): Promise<ListResponse<SafeMessageItem>> {
    return this.txService.getMessages(this.safeAddress, options);
  }

  getMessage(messageHash: string): Promise<SafeMessageItem> {
    return this.txService.getMessage(messageHash);
  }

  addMessage(payload: AddMessagePayload): Promise<void> {
    return this.txService.addMessage(this.safeAddress, payload);
  }

  addMessageSignature(
    messageHash: string,
    signature: SafeSignature | string,
  ): Promise<void> {
    return this.txService.addMessageSignature(
      messageHash,
      typeof signature === "string" ? signature : signature.data,
    );
  }

  /** Pack signatures the way `execTransaction` expects. */
  encodeSignatures(signatures: SafeSignature[]): Hex {
    return encodeSignatures(signatures);
  }

  isOwner(address: string, owners: string[]): boolean {
    return owners.some((owner) => sameString(owner, address));
  }
}

export function createSafeClient(config: SafeClientConfig): SafeClient {
  return new SafeClient(config);
}
