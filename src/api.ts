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

const TRANSACTION_SERVICE_URL = "https://api.safe.global/tx-service";

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
  .filter(Boolean)
  .concat(["BLAST"]);

const networkMap = networks.reduce<Record<string, string>>(
  (acc, { chainId, shortName }) => {
    acc[chainId] = shortName;
    return acc;
  },
  {}
);

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
  "747474": "https://safe-transaction-katana.safe.global/api",
};

export const getTxServiceUrl = (chainId: string) => {
  const shortName = networkMap[chainId];
  if (shortName) {
    return `${TRANSACTION_SERVICE_URL}/${shortName}/api`;
  }
  return HOST_MAP[chainId];
};

export default class RequestProvider {
  host: string;
  request: Axios;

  constructor({
    networkId,
    adapter,
    apiKey,
  }: {
    networkId: string;
    adapter?: AxiosAdapter;
    apiKey: string;
  }) {
    const txServiceUrl = getTxServiceUrl(networkId);
    if (!txServiceUrl) {
      throw new Error("Wrong networkId");
    }

    this.host = txServiceUrl;

    this.request = axios.create({
      baseURL: this.host,
      adapter,

      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : undefined,
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
      `/v1/safes/${ethers.utils.getAddress(
        safeAddress
      )}/multisig-transactions/`,
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
    return this.request.get(
      `/v1/safes/${ethers.utils.getAddress(safeAddress)}/`
    );
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
