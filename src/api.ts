import axios, { AxiosPromise } from "axios";
import { toChecksumAddress } from "web3-utils";

interface SafeInfo {
  address: string
  fallbackHandler: string
  guard: string
  masterCopy: string
  modules: string[]
  nonce: number
  owners: string[]
  threshold: number
  version: string
}

const host = "https://safe-transaction.gnosis.io/api";
const request = axios.create({
  baseURL: host,
});

request.interceptors.response.use((response) => {
  return response.data;
})

export const getTransactions = (safeAddress: string) =>
  request.get(`/safes/${safeAddress}/multisig-transactions/`);

export const postTransactions = (safeAddres: string, data) =>
  request.post(
    `/safes/${toChecksumAddress(safeAddres)}/multisig-transactions/`,
    data
  );

export const getSafeInfo = (safeAddress: string): AxiosPromise<SafeInfo> =>
  request.get(`/safes/${safeAddress}/`);
