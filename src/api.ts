import axios, { AxiosPromise } from "axios";
import { toChecksumAddress } from "web3-utils";

interface SafeInfo {
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
  owner: string
  submissionDate: string
  transactionHash: string | null
  signature: string
  signatureType: string
}

interface SafeTransactionItem {
  safe: string
  to: string
  value: string
  data: string | null
  operation: number
  gasToken: string
  safeTxGas: number
  baseGas: number
  gasPrice: string
  refundReceiver: string
  nonce: number
  executionDate: string | null;
  submissionDate: string
  modified: string;
  blockNumber: number | null;
  transactionHash: string | null
  safeTxHash: string
  executor: string | null
  isExecuted: boolean
  confirmations: ConfirmationItem[]
  signatures: string | null;
}

const host = "https://safe-transaction.gnosis.io/api";
const request = axios.create({
  baseURL: host,
});

request.interceptors.response.use((response) => {
  return response.data;
});

export const getPendingTransactions = (safeAddress: string, nonce: number): Promise<{ results: SafeTransactionItem[] }> =>
  request.get(`/safes/${safeAddress}/multisig-transactions/`, {
    params: {
      executed: false,
      nonce__gte: nonce,
    },
  });

export const postTransactions = (safeAddres: string, data) =>
  request.post(
    `/safes/${toChecksumAddress(safeAddres)}/multisig-transactions/`,
    data
  );

export const getSafeInfo = (safeAddress: string): Promise<SafeInfo> =>
  request.get(`/safes/${safeAddress}/`);
