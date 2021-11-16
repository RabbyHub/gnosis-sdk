import { Contract } from 'ethers'
import {
  MetaTransactionData,
  OperationType,
  SafeTransactionData,
  SafeTransactionDataPartial
} from '@gnosis.pm/safe-core-sdk-types'
import { ZERO_ADDRESS } from './constants';

export async function standardizeSafeTransactionData(
  safeContract: Contract,
  ethAdapter: EthAdapter,
  tx: SafeTransactionDataPartial
): Promise<SafeTransactionData> {
  const standardizedTxs = {
    to: tx.to,
    value: tx.value,
    data: tx.data,
    operation: tx.operation ?? OperationType.Call,
    baseGas: tx.baseGas ?? 0,
    gasPrice: tx.gasPrice ?? 0,
    gasToken: tx.gasToken || ZERO_ADDRESS,
    refundReceiver: tx.refundReceiver || ZERO_ADDRESS,
    nonce: tx.nonce ?? (await safeContract.getNonce())
  }
  const safeTxGas =
    tx.safeTxGas ??
    (await estimateTxGas(
      safeContract,
      ethAdapter,
      standardizedTxs.to,
      standardizedTxs.value,
      standardizedTxs.data,
      standardizedTxs.operation
    ))
  return {
    ...standardizedTxs,
    safeTxGas
  }
}