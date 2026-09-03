/**
 * @deprecated Compatibility entry point for consumers that deep-import
 * `@rabby-wallet/gnosis-sdk/dist/api`. Import from the package root instead.
 */
export {
  GNOSIS_SUPPORT_CHAINS,
  HOST_MAP,
  getTxServiceUrl,
  getSafeNetwork,
  isSupportedChain,
} from "./chains/registry";

export type {
  SafeInfo,
  SafeTransactionItem,
  SafeMessageItem,
  ConfirmationItem,
  ListResponse,
} from "./txService/types";

export type { SafeBackendService } from "./txService/backend";
