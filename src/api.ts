import axios, { Axios } from "axios";
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
  '1': "https://safe-transaction.gnosis.io/api/v1",
  '137': 'https://safe-transaction.polygon.gnosis.io/api/v1',
  '56': 'https://safe-transaction.bsc.gnosis.io/api/v1',
  '100': 'https://safe-transaction.xdai.gnosis.io/api/v1'
}

export default class RequestProvider {
  host: string
  request: Axios

  constructor(networkId: string) {
    if (!(networkId in HOST_MAP)) {
      throw new Error('Wrong networkId')
    }

    this.host = HOST_MAP[networkId]

    this.request = axios.create({
      baseURL: this.host
    })

    this.request.interceptors.response.use((response) => {
      return response.data;
    });
  }

  getPendingTransactions(
    safeAddress: string,
    nonce: number
  ): Promise<{ results: SafeTransactionItem[] }> {
    return this.request.get(`/safes/${toChecksumAddress(safeAddress)}/multisig-transactions/`, {
      params: {
        executed: false,
        nonce__gte: nonce,
      },
    });
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
    return this.request.post(`/multisig-transactions/${hash}/confirmations/`, data);
  }
}
