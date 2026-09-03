/**
 * @rabby-wallet/gnosis-sdk
 *
 * Reads a Safe, builds and hashes its transactions, and encodes the calldata to
 * execute them. It never holds a provider, never signs, and never broadcasts —
 * you sign the hash it gives you and send the transaction it builds.
 */

export { SafeClient, createSafeClient } from "./client";
export type { SafeClientConfig, ProposeTransactionParams } from "./client";

// Chain registry
export {
  GNOSIS_SUPPORT_CHAINS,
  HOST_MAP,
  SAFE_NETWORKS,
  getSafeNetwork,
  getTxServiceUrl,
  isSupportedChain,
} from "./chains/registry";
export type { SafeNetwork } from "./chains/registry";

// Chain access
export { SafeReader, getSafeVersion } from "./rpc/reads";
export type { SafeBasicInfo } from "./rpc/reads";
export { createEthCall, createJsonRpc, JsonRpcError } from "./rpc/jsonRpc";
export { ethCallFromRpc } from "./rpc/types";
export type { EthCall, EthRpc } from "./rpc/types";

// Transaction service
export {
  createSafeTxService,
  HttpSafeTxService,
  BackendSafeTxService,
  SafeTxServiceError,
} from "./txService";
export type {
  SafeTxService,
  SafeBackendService,
  SafeInfo,
  SafeTransactionItem,
  SafeMessageItem,
  SafeMessageConfirmation,
  ConfirmationItem,
  ListResponse,
  ProposeTransactionPayload,
  AddMessagePayload,
  GetMessagesOptions,
} from "./txService";

// Pure helpers — hashing, signatures, encoding
export {
  buildSafeTransactionData,
  requiresSafeTxGas,
  encodeApproveHash,
  encodeExecTransaction,
  encodeSignatures,
  getSafeMessageTypedData,
  getSafeTxTypedData,
  domainIncludesChainId,
  hashRawMessage,
  hashSafeMessage,
  hashSafeTransaction,
  isSignedWithPrefix,
  normalizeSignature,
  prevalidatedSignature,
  sameString,
  SAFE_ABI,
  ZERO_ADDRESS,
  SENTINEL_ADDRESS,
  EMPTY_DATA,
} from "./core";
export type {
  Hex,
  SafeSignature,
  SafeTransactionData,
  SafeTransactionDataPartial,
  SafeTxTypedData,
  SafeMessageTypedData,
  SigningMethod,
  UnsignedTransaction,
} from "./core";

/** @deprecated Use `SafeBasicInfo` from `./rpc/reads`. */
export type { SafeBasicInfo as BasicSafeInfo } from "./rpc/reads";
/** @deprecated Use `SafeMessageItem`. */
export type { SafeMessageItem as SafeMessage } from "./txService/types";
