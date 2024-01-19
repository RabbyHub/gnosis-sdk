import { SafeTransactionDataPartial } from "@gnosis.pm/safe-core-sdk-types";
import { isLegacyVersion } from "./utils";
import axios, { Axios, AxiosAdapter } from "axios";
import { toChecksumAddress } from "web3-utils";

export interface SafeInfo {
  address: string;
  fallbackHandler: string;
  guard: string;
  masterCopy: string;
  modules: string[];
  nonce: number;
  owners: string[];
  threshold: number;
  version: string;
}

interface ConfirmationItem {
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

const HOST_MAP = {
  /**
   * eth
   */
  "1": "https://safe-transaction-mainnet.safe.global/api/v1",
  /**
   * polygon
   */
  "137": "https://safe-transaction-polygon.safe.global/api/v1",
  /**
   * bsc
   */
  "56": "https://safe-transaction-bsc.safe.global/api/v1",
  /**
   * Gnosis Chain
   */
  "100": "https://safe-transaction-gnosis-chain.safe.global/api/v1",
  /**
   * avalanche
   */
  "43114": "https://safe-transaction-avalanche.safe.global/api/v1",
  /**
   * arbitrum
   */
  "42161": "https://safe-transaction-arbitrum.safe.global/api/v1",
  /**
   * Optimism
   */
  "10": "https://safe-transaction-optimism.safe.global/api/v1",
  /**
   * Aurora
   */
  "1313161554": "https://safe-transaction-aurora.safe.global/api/v1",
  /**
   * Base
   */
  "8453": "https://safe-transaction-base.safe.global/api/v1",
  /**
   * Celo
   */
  "42220": "https://safe-transaction-celo.safe.global/api/v1",
  /**
   * Polygon zkEVM
   */
  "1101": "https://safe-transaction-zkevm.safe.global/api/v1",
  /**
   * zksync era
   */
  "324": "https://safe-transaction-zksync.safe.global/api/v1",
};

export default class RequestProvider {
  host: string;
  request: Axios;

  constructor(networkId: string, adapter?: AxiosAdapter) {
    if (!(networkId in HOST_MAP)) {
      throw new Error("Wrong networkId");
    }

    this.host = HOST_MAP[networkId];

    this.request = axios.create({
      baseURL: this.host,
      adapter,
    });

    this.request.interceptors.response.use((response) => {
      return response.data;
    });
  }

  getPendingTransactions(
    safeAddress: string,
    nonce: number
  ): Promise<{ results: SafeTransactionItem[] }> {
    return this.request.get(
      `/safes/${toChecksumAddress(safeAddress)}/multisig-transactions/`,
      {
        params: {
          executed: false,
          nonce__gte: nonce,
        },
      }
    );
  }

  postTransactions(safeAddres: string, data): Promise<void> {
    return this.request.post(
      `/safes/${toChecksumAddress(safeAddres)}/multisig-transactions/`,
      data
    );
  }

  getSafeInfo(safeAddress: string): Promise<SafeInfo> {
    return this.request.get(`/safes/${toChecksumAddress(safeAddress)}/`);
  }

  confirmTransaction(hash: string, data): Promise<void> {
    return this.request.post(
      `/multisig-transactions/${hash}/confirmations/`,
      data
    );
  }

  // https://github.com/safe-global/safe-wallet-web/blob/dev/src/services/tx/tx-sender/recommendedNonce.ts#L24
  async getSafeTxGas(
    safeAddress: string,
    safeVersion: string,
    safeTxData: SafeTransactionDataPartial
  ): Promise<number | undefined> {
    const isSafeTxGasRequired = isLegacyVersion(safeVersion);

    // For 1.3.0+ Safes safeTxGas is not required
    if (!isSafeTxGasRequired) return 0;

    const address = toChecksumAddress(safeAddress);

    try {
      const estimation: { safeTxGas: string } = await this.request.post(
        `/safes/${address}/multisig-transactions/estimations/`,
        {
          to: toChecksumAddress(safeTxData.to),
          value: +safeTxData.value || 0,
          data: safeTxData.data,
          operation: safeTxData.operation,
        }
      );
      return Number(estimation.safeTxGas);
    } catch (e) {
      console.error(e);
    }
  }
}
