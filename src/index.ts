import { Contract } from 'ethers'
import { getSafeInfo } from './api';
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
    const safeInfo = await this.getSafeInfo()
    const owners = await this.getOwners();
    console.log('safeInfo', safeInfo);
    console.log('owners', owners);
    this.owners = owners;
  }

  async getOwners(): Promise<string[]> {
    const owners = await this.contract.getOwners();

    return owners;
  }
  
  getSafeInfo() {
    return getSafeInfo(this.safeAddress);
  }

  async getNonce() {
    const nonce = this.contract.nonce();
    console.log(nonce);
  }
}

export default Safe;