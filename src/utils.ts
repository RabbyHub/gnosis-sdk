import { BigNumber } from "@ethersproject/bignumber";
import { Contract, providers } from "ethers";
import {
  OperationType,
  SafeTransactionData,
  SafeTransactionDataPartial,
  SafeSignature,
  SafeTransaction,
} from "@gnosis.pm/safe-core-sdk-types";
import { bufferToHex, ecrecover, pubToAddress } from "ethereumjs-util";
import { ZERO_ADDRESS, SENTINEL_ADDRESS } from "./constants";
import EthSignSignature from "@gnosis.pm/safe-core-sdk/dist/src/utils/signatures/SafeSignature";
import semverSatisfies from "semver/functions/satisfies";
import RequestProvider from "./api";
import Safe from "./index";

function estimateDataGasCosts(data: string): number {
  const reducer = (accumulator: number, currentValue: string) => {
    if (currentValue === "0x") {
      return accumulator + 0;
    }
    if (currentValue === "00") {
      return accumulator + 4;
    }
    return accumulator + 16;
  };
  return (data.match(/.{2}/g) as string[]).reduce(reducer, 0);
}

export function sameString(str1: string, str2: string): boolean {
  return str1.toLowerCase() === str2.toLowerCase();
}

function isZeroAddress(address: string): boolean {
  return address === ZERO_ADDRESS;
}

function isSentinelAddress(address: string): boolean {
  return address === SENTINEL_ADDRESS;
}

export function isRestrictedAddress(address: string): boolean {
  return isZeroAddress(address) || isSentinelAddress(address);
}

export const isLegacyVersion = (safeVersion: string): boolean => {
  const LEGACY_VERSION = "<1.3.0";
  return semverSatisfies(safeVersion, LEGACY_VERSION);
};

export async function estimateTxGas(
  safeAddress: string,
  safeContract: Contract,
  provider: providers.Web3Provider,
  to: string,
  valueInWei: string,
  data: string,
  operation: OperationType
): Promise<number> {
  let txGasEstimation = 0;

  const estimateData: string = safeContract.interface.encodeFunctionData(
    "requiredTxGas",
    [to, valueInWei, data, operation]
  );
  try {
    const estimateResponse = (
      await provider.estimateGas({
        to: safeAddress,
        from: safeAddress,
        data: estimateData,
      })
    ).toString();
    txGasEstimation =
      BigNumber.from("0x" + estimateResponse.substring(138)).toNumber() + 10000;
  } catch (error) {}

  if (txGasEstimation > 0) {
    const dataGasEstimation = estimateDataGasCosts(estimateData);
    let additionalGas = 10000;
    for (let i = 0; i < 10; i++) {
      try {
        const estimateResponse = await provider.call({
          to: safeAddress,
          from: safeAddress,
          data: estimateData,
          gasPrice: 0,
          gasLimit: txGasEstimation + dataGasEstimation + additionalGas,
        });
        if (estimateResponse !== "0x") {
          break;
        }
      } catch (error) {}
      txGasEstimation += additionalGas;
      additionalGas *= 2;
    }
    return txGasEstimation + additionalGas;
  }

  try {
    const estimateGas = await provider.estimateGas({
      to,
      from: safeAddress,
      value: valueInWei,
      data,
    });
    return estimateGas.toNumber();
  } catch (error) {
    if (operation === OperationType.DelegateCall) {
      return 0;
    }
    return Promise.reject(error);
  }
}

export async function standardizeSafeTransactionData(
  safeAddress: string,
  safeContract: Contract,
  provider: any,
  tx: SafeTransactionDataPartial,
  network: string,
  version: string
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
    nonce: tx.nonce ?? (await safeContract.nonce()).toNumber(),
  };
  const request = new RequestProvider(network, Safe.adapter);
  const safeTxGas =
    tx.safeTxGas ??
    (await request.getSafeTxGas(safeAddress, version, standardizedTxs));
  return {
    ...standardizedTxs,
    safeTxGas: safeTxGas || 0,
  };
}

export function generatePreValidatedSignature(
  ownerAddress: string
): SafeSignature {
  const signature =
    "0x000000000000000000000000" +
    ownerAddress.slice(2) +
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "01";

  return new EthSignSignature(ownerAddress, signature);
}

export function isTxHashSignedWithPrefix(
  txHash: string,
  signature: string,
  ownerAddress: string
): boolean {
  let hasPrefix;
  try {
    const rsvSig = {
      r: Buffer.from(signature.slice(2, 66), "hex"),
      s: Buffer.from(signature.slice(66, 130), "hex"),
      v: parseInt(signature.slice(130, 132), 16),
    };
    const recoveredData = ecrecover(
      Buffer.from(txHash.slice(2), "hex"),
      rsvSig.v,
      rsvSig.r,
      rsvSig.s
    );
    const recoveredAddress = bufferToHex(pubToAddress(recoveredData));
    hasPrefix = !sameString(recoveredAddress, ownerAddress);
  } catch (e) {
    hasPrefix = true;
  }
  return hasPrefix;
}

export function adjustVInSignature(signature: string, hasPrefix: boolean) {
  const V_VALUES = [0, 1, 27, 28];
  const MIN_VALID_V_VALUE = 27;
  let signatureV = parseInt(signature.slice(-2), 16);
  if (!V_VALUES.includes(signatureV)) {
    throw new Error("Invalid signature");
  }
  if (signatureV < MIN_VALID_V_VALUE) {
    signatureV += MIN_VALID_V_VALUE;
  }
  if (hasPrefix) {
    signatureV += 4;
  }
  signature = signature.slice(0, -2) + signatureV.toString(16);
  return signature;
}

export async function generateSignature(
  provider: providers.Web3Provider,
  hash: string
): Promise<EthSignSignature> {
  const signer = await provider.getSigner(0);
  const signerAddress = await signer.getAddress();
  let signature = await provider.send("personal_sign", [hash, signerAddress]);
  const hasPrefix = isTxHashSignedWithPrefix(hash, signature, signerAddress);
  signature = adjustVInSignature(signature, hasPrefix);
  return new EthSignSignature(signerAddress, signature);
}

export async function estimateGasForTransactionExecution(
  safeContract: Contract,
  from: string,
  tx: SafeTransaction
): Promise<number> {
  try {
    const gas = await safeContract.estimateGas.execTransaction(
      tx.data.to,
      tx.data.value,
      tx.data.data,
      tx.data.operation,
      tx.data.safeTxGas,
      tx.data.baseGas,
      tx.data.gasPrice,
      tx.data.gasToken,
      tx.data.refundReceiver,
      tx.encodedSignatures(),
      { from }
    );
    return gas.toNumber();
  } catch (error) {
    return Promise.reject(error);
  }
}
