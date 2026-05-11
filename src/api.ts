import { SafeTransactionDataPartial } from "@safe-global/types-kit";
import { ethers } from "ethers";
import { isLegacyVersion } from "./utils";
import axios, { Axios, AxiosAdapter } from "axios";
import { getTxServiceUrl } from "./txService";

export { GNOSIS_SUPPORT_CHAINS, HOST_MAP, getTxServiceUrl } from "./txService";

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

export type SafeOpenApiService = {
  getSafePendingTransactions?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    nonce: number;
  }) => Promise<{ results: SafeTransactionItem[] }>;
  postSafeTransactions?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    data: Record<string, any>;
  }) => Promise<void>;
  getSafeInfo?: (params: {
    txServiceUrl: string;
    safeAddress: string;
  }) => Promise<SafeInfo>;
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
  }) => Promise<{ results: any[] }>;
  addSafeMessage?: (params: {
    txServiceUrl: string;
    safeAddress: string;
    data: {
      message: string | Record<string, any>;
      signature: string;
      safeAppId?: number;
    };
  }) => Promise<void>;
  getSafeMessage?: (params: {
    txServiceUrl: string;
    messageHash: string;
  }) => Promise<any>;
  addSafeMessageSignature?: (params: {
    txServiceUrl: string;
    messageHash: string;
    signature: string;
  }) => Promise<void>;
};

export default class RequestProvider {
  prefix: string;
  request: Axios;
  openapiService?: SafeOpenApiService;
  shouldUseOpenapiService: boolean;

  constructor({
    networkId,
    adapter,
    openapiService,
  }: {
    networkId: string;
    adapter?: AxiosAdapter;
    openapiService?: SafeOpenApiService;
  }) {
    const txServiceUrl = getTxServiceUrl(networkId);
    if (!txServiceUrl) {
      throw new Error("Wrong networkId");
    }

    this.prefix = txServiceUrl;
    this.openapiService = openapiService;
    this.shouldUseOpenapiService = !/^https?:\/\//i.test(this.prefix);

    this.request = axios.create({
      baseURL: this.prefix,
      adapter,
    });

    this.request.interceptors.response.use((response) => {
      return response.data;
    });
  }

  getPendingTransactions(
    safeAddress: string,
    nonce: number,
  ): Promise<{ results: SafeTransactionItem[] }> {
    const checksumAddress = ethers.utils.getAddress(safeAddress);
    if (
      this.shouldUseOpenapiService &&
      this.openapiService?.getSafePendingTransactions
    ) {
      return this.openapiService.getSafePendingTransactions({
        txServiceUrl: this.prefix,
        safeAddress: checksumAddress,
        nonce,
      });
    }

    return this.request.get(
      `/v1/safes/${checksumAddress}/multisig-transactions/`,
      {
        params: {
          executed: false,
          nonce__gte: nonce,
        },
      },
    );
  }

  postTransactions(
    safeAddres: string,
    data: Record<string, any>,
  ): Promise<void> {
    const checksumAddress = ethers.utils.getAddress(safeAddres);
    if (
      this.shouldUseOpenapiService &&
      this.openapiService?.postSafeTransactions
    ) {
      return this.openapiService.postSafeTransactions({
        txServiceUrl: this.prefix,
        safeAddress: checksumAddress,
        data,
      });
    }

    return this.request.post(
      `/v1/safes/${checksumAddress}/multisig-transactions/`,
      data,
    );
  }

  getSafeInfo(safeAddress: string): Promise<SafeInfo> {
    const checksumAddress = ethers.utils.getAddress(safeAddress);
    if (this.shouldUseOpenapiService && this.openapiService?.getSafeInfo) {
      return this.openapiService.getSafeInfo({
        txServiceUrl: this.prefix,
        safeAddress: checksumAddress,
      });
    }

    return this.request.get(`/v1/safes/${checksumAddress}/`);
  }

  confirmTransaction(
    safeTransactionHash: string,
    data: Record<string, any>,
  ): Promise<void> {
    if (
      this.shouldUseOpenapiService &&
      this.openapiService?.confirmSafeTransaction
    ) {
      return this.openapiService.confirmSafeTransaction({
        txServiceUrl: this.prefix,
        safeTransactionHash,
        data,
      });
    }

    return this.request.post(
      `/v1/multisig-transactions/${safeTransactionHash}/confirmations/`,
      data,
    );
  }

  // https://github.com/safe-global/safe-wallet-web/blob/dev/src/services/tx/tx-sender/recommendedNonce.ts#L24
  async getSafeTxGas(
    safeAddress: string,
    safeVersion: string,
    safeTxData: SafeTransactionDataPartial,
  ): Promise<string | undefined> {
    const isSafeTxGasRequired = isLegacyVersion(safeVersion);

    // For 1.3.0+ Safes safeTxGas is not required
    if (!isSafeTxGasRequired) return "0";

    const address = ethers.utils.getAddress(safeAddress);

    if (this.shouldUseOpenapiService && this.openapiService?.getSafeTxGas) {
      return this.openapiService.getSafeTxGas({
        txServiceUrl: this.prefix,
        safeAddress: address,
        safeTxData: {
          to: ethers.utils.getAddress(safeTxData.to),
          value: safeTxData.value || "0",
          data: safeTxData.data,
          operation: safeTxData.operation,
        },
      });
    }

    try {
      const estimation: { safeTxGas: string } = await this.request.post(
        `/v1/safes/${address}/multisig-transactions/estimations/`,
        {
          to: ethers.utils.getAddress(safeTxData.to),
          value: safeTxData.value || "0",
          data: safeTxData.data,
          operation: safeTxData.operation,
        },
      );
      return estimation.safeTxGas;
    } catch (e) {
      console.error(e);
    }
  }

  getMessages(
    safeAddress: string,
    options?: Record<string, any>,
  ): Promise<{ results: any[] }> {
    const checksumAddress = ethers.utils.getAddress(safeAddress);
    if (this.shouldUseOpenapiService && this.openapiService?.getSafeMessages) {
      return this.openapiService.getSafeMessages({
        txServiceUrl: this.prefix,
        safeAddress: checksumAddress,
        options,
      });
    }

    return this.request.get(`/v1/safes/${checksumAddress}/messages/`, {
      params: options,
    });
  }

  addMessage(
    safeAddress: string,
    data: {
      message: string | Record<string, any>;
      signature: string;
      safeAppId?: number;
    },
  ): Promise<void> {
    const checksumAddress = ethers.utils.getAddress(safeAddress);
    if (this.shouldUseOpenapiService && this.openapiService?.addSafeMessage) {
      return this.openapiService.addSafeMessage({
        txServiceUrl: this.prefix,
        safeAddress: checksumAddress,
        data,
      });
    }

    return this.request.post(`/v1/safes/${checksumAddress}/messages/`, data);
  }

  getMessage(messageHash: string): Promise<any> {
    if (this.shouldUseOpenapiService && this.openapiService?.getSafeMessage) {
      return this.openapiService.getSafeMessage({
        txServiceUrl: this.prefix,
        messageHash,
      });
    }

    return this.request.get(`/v1/messages/${messageHash}/`);
  }

  addMessageSignature(messageHash: string, signature: string): Promise<void> {
    if (
      this.shouldUseOpenapiService &&
      this.openapiService?.addSafeMessageSignature
    ) {
      return this.openapiService.addSafeMessageSignature({
        txServiceUrl: this.prefix,
        messageHash,
        signature,
      });
    }

    return this.request.post(`/v1/messages/${messageHash}/signatures/`, {
      signature,
    });
  }
}
