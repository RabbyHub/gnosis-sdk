import { SafeTransactionDataPartial } from "@safe-global/types-kit";
import { ethers } from "ethers";
import { isLegacyVersion } from "./utils";
import axios, { Axios, AxiosAdapter } from "axios";

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

export const HOST_MAP = {
  /**
   * eth
   */
  "1": "https://safe-transaction-mainnet.safe.global/api",
  /**
   * polygon
   */
  "137": "https://safe-transaction-polygon.safe.global/api",
  /**
   * bsc
   */
  "56": "https://safe-transaction-bsc.safe.global/api",
  /**
   * Gnosis Chain
   */
  "100": "https://safe-transaction-gnosis-chain.safe.global/api",
  /**
   * avalanche
   */
  "43114": "https://safe-transaction-avalanche.safe.global/api",
  /**
   * arbitrum
   */
  "42161": "https://safe-transaction-arbitrum.safe.global/api",
  /**
   * Optimism
   */
  "10": "https://safe-transaction-optimism.safe.global/api",
  /**
   * Aurora
   */
  "1313161554": "https://safe-transaction-aurora.safe.global/api",
  /**
   * Base
   */
  "8453": "https://safe-transaction-base.safe.global/api",
  /**
   * Celo
   */
  "42220": "https://safe-transaction-celo.safe.global/api",
  /**
   * Polygon zkEVM
   */
  "1101": "https://safe-transaction-zkevm.safe.global/api",
  /**
   * zksync era
   */
  "324": "https://safe-transaction-zksync.safe.global/api",
  /**
   * scroll
   */
  "534352": "https://safe-transaction-scroll.safe.global/api",
  /**
   * linea
   */
  "59144": "https://safe-transaction-linea.safe.global/api",
  /**
   * X Layer
   */
  "196": "https://safe-transaction-xlayer.safe.global/api",
  /**
   * mantle
   */
  "5000": "https://safe-transaction-mantle.safe.global/api",
  /**
   * World Chain
   */
  "480": "https://safe-transaction-worldchain.safe.global/api",
  /**
   * blast
   */
  "81457": "https://safe-transaction-blast.safe.global/api",
  /**
   * Sonic
   */
  "146": "https://safe-transaction-sonic.safe.global/api",
  /**
   * Berachain
   */
  "80094": "https://safe-transaction-berachain.safe.global/api",
  /**
   * ink
   */
  "57073": "https://safe-transaction-ink.safe.global/api",
  /**
   * Hemi
   */
  "43111": "https://safe-transaction-hemi.safe.global/api",
  /**
   * Katana
   */
  "747474": "https://safe-transaction-katana.safe.global/api"
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
      `/v1/safes/${ethers.utils.getAddress(safeAddress)}/multisig-transactions/`,
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
      `/v1/safes/${ethers.utils.getAddress(safeAddres)}/multisig-transactions/`,
      data
    );
  }

  getSafeInfo(safeAddress: string): Promise<SafeInfo> {
    return this.request.get(`/v1/safes/${ethers.utils.getAddress(safeAddress)}/`);
  }

  confirmTransaction(safeTransactionHash: string, data): Promise<void> {
    return this.request.post(
      `/v1/multisig-transactions/${safeTransactionHash}/confirmations/`,
      data
    );
  }

  // https://github.com/safe-global/safe-wallet-web/blob/dev/src/services/tx/tx-sender/recommendedNonce.ts#L24
  async getSafeTxGas(
    safeAddress: string,
    safeVersion: string,
    safeTxData: SafeTransactionDataPartial
  ): Promise<string | undefined> {
    const isSafeTxGasRequired = isLegacyVersion(safeVersion);

    // For 1.3.0+ Safes safeTxGas is not required
    if (!isSafeTxGasRequired) return "0";

    const address = ethers.utils.getAddress(safeAddress);

    try {
      const estimation: { safeTxGas: string } = await this.request.post(
        `/v1/safes/${address}/multisig-transactions/estimations/`,
        {
          to: ethers.utils.getAddress(safeTxData.to),
          value: safeTxData.value || "0",
          data: safeTxData.data,
          operation: safeTxData.operation,
        }
      );
      return estimation.safeTxGas;
    } catch (e) {
      console.error(e);
    }
  }
}
