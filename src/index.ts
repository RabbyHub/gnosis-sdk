import { Contract, ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import BN from "bignumber.js";
import { getSafeSingletonDeployment } from "@safe-global/safe-deployments";
import { providers } from "ethers";
import { toChecksumAddress } from "web3-utils";
import {
  SafeTransactionDataPartial,
  SafeSignature,
} from "@gnosis.pm/safe-core-sdk-types";
import {
  TransactionResult,
  TransactionOptions,
} from "@gnosis.pm/safe-core-sdk/dist/src/utils/transactions/types";
import SafeTransaction from "@gnosis.pm/safe-core-sdk/dist/src/utils/transactions/SafeTransaction";
import RequestProvider, { SafeInfo } from "./api";
import {
  standardizeSafeTransactionData,
  sameString,
  generateSignature,
  generatePreValidatedSignature,
  estimateGasForTransactionExecution,
} from "./utils";
import { AxiosAdapter } from "axios";

class Safe {
  contract: Contract;
  safeAddress: string;
  owners: string[] = [];
  version: string;
  provider: providers.Web3Provider;
  safeInfo: SafeInfo | null = null;
  request: RequestProvider;
  network: string;

  static adapter: AxiosAdapter;

  constructor(
    safeAddress: string,
    version: string,
    provider: providers.Web3Provider,
    network = "1"
  ) {
    const contract = getSafeSingletonDeployment({
      version,
      network,
    });
    if (!contract) {
      throw new Error("Wrong version or network");
    }
    this.provider = provider;
    this.contract = new Contract(safeAddress, contract.abi, this.provider);
    this.version = version;
    this.safeAddress = safeAddress;
    this.network = network;
    this.request = new RequestProvider(network, Safe.adapter);
    // this.init();
  }

  /**
   * @deprecated
   * @param safeAddress
   * @param network
   * @returns
   */
  static getSafeInfo(safeAddress: string, network: string) {
    const request = new RequestProvider(network, Safe.adapter);
    return request.getSafeInfo(toChecksumAddress(safeAddress));
  }

  static async getPendingTransactions(
    safeAddress: string,
    network: string,
    nonce: number
  ) {
    const request = new RequestProvider(network, Safe.adapter);
    const transactions = await request.getPendingTransactions(
      safeAddress,
      nonce
    );

    return transactions;
  }

  async getPendingTransactions() {
    const nonce = await this.getNonce();
    const transactions = await this.request.getPendingTransactions(
      this.safeAddress,
      nonce
    );

    return transactions;
  }

  static async getSafeVersion({
    address,
    provider,
  }: {
    address;
    provider: providers.Web3Provider;
  }): Promise<string> {
    const contract = new Contract(
      address,
      [
        {
          constant: true,
          inputs: [],
          name: "VERSION",
          outputs: [
            {
              internalType: "string",
              name: "",
              type: "string",
            },
          ],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      provider
    );

    const version = await contract.VERSION();

    return version;
  }

  async init() {
    const safeInfo = await Safe.getSafeInfo(this.safeAddress, this.network);
    this.safeInfo = safeInfo;
    if (this.version !== safeInfo.version) {
      throw new Error(
        `Current version ${this.version} not matched address version ${safeInfo.version}`
      );
    }
    this.version = safeInfo.version;
    this.owners = safeInfo.owners;
  }

  async getOwners(): Promise<string[]> {
    const owners = await this.contract.getOwners();

    return owners;
  }

  async getThreshold(): Promise<number> {
    const threshold = await this.contract.getThreshold();
    return threshold.toNumber();
  }

  async getNonce(): Promise<number> {
    const nonce = await this.contract.nonce();
    return nonce.toNumber();
  }

  getBasicSafeInfo = async () => {
    const [threshold, nonce, owners] = await Promise.all([
      this.getThreshold(),
      this.getNonce(),
      this.getOwners(),
    ]);
    return {
      address: this.safeAddress,
      version: this.version,
      threshold,
      nonce,
      owners,
    };
  };

  async buildTransaction(data: SafeTransactionDataPartial) {
    const transaction = await standardizeSafeTransactionData(
      this.safeAddress,
      this.contract,
      this.provider,
      data,
      this.network,
      this.version
    );
    return new SafeTransaction(transaction);
  }

  async getTransactionHash(transaction: SafeTransaction) {
    const transactionData = transaction.data;
    return this.contract.getTransactionHash(
      transactionData.to,
      transactionData.value,
      transactionData.data,
      transactionData.operation,
      transactionData.safeTxGas,
      transactionData.baseGas,
      transactionData.gasPrice,
      transactionData.gasToken,
      transactionData.refundReceiver,
      transactionData.nonce
    );
  }

  async signTransactionHash(hash: string): Promise<SafeSignature> {
    const owners = await this.getOwners();
    const signer = await this.provider.getSigner(0);
    const signerAddress = await signer.getAddress();
    const addressIsOwner = owners.find(
      (owner: string) => signerAddress && sameString(owner, signerAddress)
    );
    if (!addressIsOwner) {
      throw new Error("Transactions can only be signed by Safe owners");
    }
    return generateSignature(this.provider, hash);
  }

  async signTransaction(transaction: SafeTransaction) {
    const hash = await this.getTransactionHash(transaction);
    const sig = await this.signTransactionHash(hash);
    transaction.addSignature(sig);
  }

  async getOwnersWhoApprovedTx(txHash: string): Promise<string[]> {
    const owners = await this.getOwners();
    let ownersWhoApproved: string[] = [];
    for (const owner of owners) {
      const approved = await this.contract.approvedHashes(owner, txHash);
      if (approved.gt(0)) {
        ownersWhoApproved.push(owner);
      }
    }
    return ownersWhoApproved;
  }

  async postTransaction(transaction: SafeTransaction, hash: string) {
    const signer = this.provider.getSigner(0);
    const signerAddress = await signer.getAddress();
    const safeAddress = toChecksumAddress(this.safeAddress);
    await this.request.postTransactions(this.safeAddress, {
      safe: safeAddress,
      to: toChecksumAddress(transaction.data.to),
      value: new BN(transaction.data.value).toFixed(),
      data: transaction.data.data,
      operation: transaction.data.operation,
      gasToken: transaction.data.gasToken,
      safeTxGas: transaction.data.safeTxGas,
      baseGas: transaction.data.baseGas,
      gasPrice: transaction.data.gasPrice,
      refundReceiver: transaction.data.refundReceiver,
      nonce: transaction.data.nonce,
      contractTransactionHash: hash,
      sender: toChecksumAddress(signerAddress),
      signature: transaction.encodedSignatures(),
    });
  }

  async confirmTransaction(safeTransaction: SafeTransaction) {
    const hash = await this.getTransactionHash(safeTransaction);
    const signature = await this.signTransactionHash(hash);
    safeTransaction.addSignature(signature);
    const signer = await this.provider.getSigner(0);
    const signerAddress = await signer.getAddress();
    const sig = safeTransaction.signatures.get(signerAddress?.toLowerCase());
    if (sig) {
      await this.request.confirmTransaction(hash, { signature: sig.data });
    }
  }

  async getBalance(): Promise<BigNumber> {
    return this.provider.getBalance(this.safeAddress);
  }

  async executeTransaction(
    safeTransaction: SafeTransaction,
    options?: TransactionOptions
  ): Promise<TransactionResult> {
    const txHash = await this.getTransactionHash(safeTransaction);
    const ownersWhoApprovedTx = await this.getOwnersWhoApprovedTx(txHash);
    for (const owner of ownersWhoApprovedTx) {
      safeTransaction.addSignature(generatePreValidatedSignature(owner));
    }
    const owners = await this.getOwners();
    const signer = await this.provider.getSigner(0);
    const contract = this.contract.connect(signer);
    const signerAddress = await signer.getAddress();
    if (owners.includes(signerAddress)) {
      safeTransaction.addSignature(
        generatePreValidatedSignature(signerAddress)
      );
    }

    const threshold = await this.getThreshold();
    if (threshold > safeTransaction.signatures.size) {
      const signaturesMissing = threshold - safeTransaction.signatures.size;
      throw new Error(
        `There ${
          signaturesMissing > 1 ? "are" : "is"
        } ${signaturesMissing} signature${
          signaturesMissing > 1 ? "s" : ""
        } missing`
      );
    }

    const value = BigNumber.from(safeTransaction.data.value);
    if (!value.isZero()) {
      const balance = await this.getBalance();
      if (value.gt(BigNumber.from(balance))) {
        throw new Error("Not enough Ether funds");
      }
    }

    const gasLimit = await estimateGasForTransactionExecution(
      contract,
      signerAddress,
      safeTransaction
    );
    const executionOptions: TransactionOptions = {
      gasLimit,
      gasPrice: options?.gasPrice,
      from: signerAddress,
    };

    const txResponse = await contract.execTransaction(
      safeTransaction.data.to,
      safeTransaction.data.value,
      safeTransaction.data.data,
      safeTransaction.data.operation,
      safeTransaction.data.safeTxGas,
      safeTransaction.data.baseGas,
      safeTransaction.data.gasPrice,
      safeTransaction.data.gasToken,
      safeTransaction.data.refundReceiver,
      safeTransaction.encodedSignatures(),
      executionOptions
    );

    return txResponse;
  }
}

export default Safe;

export type BasicSafeInfo = Awaited<ReturnType<Safe["getBasicSafeInfo"]>>;
