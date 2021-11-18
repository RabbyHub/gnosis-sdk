import { BigNumber } from "@ethersproject/bignumber";
import {
  SafeTransaction,
  SafeTransactionData,
} from "@gnosis.pm/safe-core-sdk-types";
import {
  TransactionOptions,
  TransactionResult,
} from "@gnosis.pm/safe-core-sdk/dist/src/utils/transactions/types";

export interface GnosisSafeContract {
  getVersion(): Promise<string>;
  getAddress(): string;
  getNonce(): Promise<number>;
  getThreshold(): Promise<number>;
  getOwners(): Promise<string[]>;
  isOwner(address: string): Promise<boolean>;
  getTransactionHash(safeTransactionData: SafeTransactionData): Promise<string>;
  approvedHashes(ownerAddress: string, hash: string): Promise<BigNumber>;
  approveHash(
    hash: string,
    options?: TransactionOptions
  ): Promise<TransactionResult>;
  getModules(): Promise<string[]>;
  isModuleEnabled(moduleAddress: string): Promise<boolean>;
  execTransaction(
    safeTransaction: SafeTransaction,
    options?: TransactionOptions
  ): Promise<TransactionResult>;
  encode(methodName: any, params: any): string;
  estimateGas(
    methodName: string,
    params: any[],
    options: TransactionOptions
  ): Promise<number>;
}
