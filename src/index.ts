import { Contract } from 'ethers'
import { getSafeInfo, getPendingTransactions } from './api';
import {
  getSafeSingletonDeployment,
} from '@gnosis.pm/safe-deployments';
import { SingletonDeployment } from '@gnosis.pm/safe-deployments/src/types'

class Safe {
  contract: Contract;
  safeAddress: string;
  owners: string[] = [];
  version: string;

  constructor(safeAddress: string, version: string, network = "1") {
    const contract = getSafeSingletonDeployment({
      version,
      network,
    });
    const address = contract.networkAddresses[network];
    this.contract = new Contract(address, contract.abi);
    this.safeAddress = safeAddress;
  }

  async init() {
    const safeInfo = await this.getSafeInfo();
    if (this.version !== safeInfo.version) {
      throw new Error(`Current version ${this.version} not matched address version ${safeInfo.version}`);
    }
    this.version = safeInfo.version;
    this.owners = safeInfo.owners;
  }

  async getOwners(): Promise<string[]> {
    const owners = await this.contract.getOwners();

    return owners;
  }
  
  getSafeInfo() {
    return getSafeInfo(this.safeAddress);
  }

  async getNonce(): Promise<number> {
    const nonce = await this.contract.nonce();
    return nonce.toNumber();
  }

  async getTransactions() {
    const nonce = await this.getNonce();
    const transactions = await getPendingTransactions(this.safeAddress, nonce);
    
    return transactions;
  }
}

export default Safe;