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
};

type NetworkShortName = {
  shortName: string;
  chainId: string;
  enum?: string;
};

// https://github.com/safe-global/safe-core-sdk/blob/main/packages/api-kit/src/utils/config.ts
const networks: NetworkShortName[] = [
  {
    chainId: "1",
    shortName: "eth",
    enum: "ETH",
  },
  {
    chainId: "10",
    shortName: "oeth",
    enum: "OP",
  },
  {
    chainId: "50",
    shortName: "xdc",
  },
  {
    chainId: "56",
    shortName: "bnb",
    enum: "BSC",
  },
  {
    chainId: "100",
    shortName: "gno",
    enum: "GNOSIS",
  },
  {
    chainId: "130",
    shortName: "unichain",
    enum: "UNI",
  },
  {
    chainId: "137",
    shortName: "pol",
    enum: "POLYGON",
  },
  {
    chainId: "143",
    shortName: "monad",
    enum: "MONAD",
  },
  {
    chainId: "146",
    shortName: "sonic",
    enum: "SONIC",
  },
  {
    chainId: "196",
    shortName: "okb",
    enum: "XLAYER",
  },
  {
    chainId: "204",
    shortName: "opbnb",
    enum: "OPBNB",
  },
  {
    chainId: "232",
    shortName: "lens",
    enum: "LENS",
  },
  {
    chainId: "324",
    shortName: "zksync",
    enum: "ERA",
  },
  {
    chainId: "480",
    shortName: "wc",
    enum: "WORLD",
  },
  {
    chainId: "988",
    shortName: "stable",
    enum: "STABLE",
  },
  {
    chainId: "999",
    shortName: "hyper",
    enum: "HYPER",
  },
  {
    chainId: "1101",
    shortName: "zkevm",
  },
  {
    chainId: "3338",
    shortName: "peaq",
  },
  {
    chainId: "3637",
    shortName: "btc",
    enum: "BOTANIX",
  },
  {
    chainId: "5000",
    shortName: "mantle",
    enum: "MANTLE",
  },
  {
    chainId: "8453",
    shortName: "base",
    enum: "BASE",
  },
  {
    chainId: "9745",
    shortName: "plasma",
    enum: "PLASMA",
  },
  {
    chainId: "10143",
    shortName: "monad-testnet",
  },
  {
    chainId: "10200",
    shortName: "chi",
  },
  {
    chainId: "16661",
    shortName: "0g",
    enum: "G0",
  },
  {
    chainId: "42161",
    shortName: "arb1",
    enum: "ARBITRUM",
  },
  {
    chainId: "42220",
    shortName: "celo",
    enum: "CELO",
  },
  {
    chainId: "43111",
    shortName: "hemi",
    enum: "HEMI",
  },
  {
    chainId: "43114",
    shortName: "avax",
    enum: "AVAX",
  },
  {
    chainId: "57073",
    shortName: "ink",
    enum: "INK",
  },
  {
    chainId: "59144",
    shortName: "linea",
    enum: "LINEA",
  },
  {
    chainId: "80069",
    shortName: "bep",
  },
  {
    chainId: "80094",
    shortName: "berachain",
    enum: "BERA",
  },
  {
    chainId: "81224",
    shortName: "codex",
  },
  {
    chainId: "84532",
    shortName: "basesep",
  },
  {
    chainId: "534352",
    shortName: "scr",
    enum: "SCRL",
  },
  {
    chainId: "747474",
    shortName: "katana",
    enum: "KATANA",
  },
  {
    chainId: "11155111",
    shortName: "sep",
  },
  {
    chainId: "1313161554",
    shortName: "aurora",
    enum: "AURORA",
  },
];
export const GNOSIS_SUPPORT_CHAINS = networks
  .map((item) => item.enum)
  .filter((e): e is string => Boolean(e))
  .concat(["BLAST"]);

const networkMap = networks.reduce<Record<string, string>>(
  (acc, { chainId, shortName }) => {
    acc[chainId] = shortName;
    return acc;
  },
  {}
);

export const HOST_MAP: Record<string, string> = {
  /**
   * blast
   */
  "81457": "https://safe-transaction-blast.safe.global/api",
};

export const getTxServiceUrl = (chainId: string) => {
  const shortName = networkMap[chainId];
  if (shortName) {
    return `/v1/safe-tx-service/${shortName}/api`;
  }
  return HOST_MAP[chainId];
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
    nonce: number
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
      }
    );
  }

  postTransactions(safeAddres: string, data: Record<string, any>): Promise<void> {
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
      data
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

    return this.request.get(
      `/v1/safes/${checksumAddress}/`
    );
  }

  confirmTransaction(
    safeTransactionHash: string,
    data: Record<string, any>
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
        }
      );
      return estimation.safeTxGas;
    } catch (e) {
      console.error(e);
    }
  }
}
