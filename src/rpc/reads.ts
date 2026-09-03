import { decodeFunctionResult, encodeFunctionData, getAddress } from "viem";
import { SAFE_ABI } from "../core/abi";
import type { Hex } from "../core/types";
import type { EthCall } from "./types";

type ReadFn = "VERSION" | "nonce" | "getThreshold" | "getOwners" | "approvedHashes" | "getMessageHash";

async function read<T>(
  ethCall: EthCall,
  safeAddress: string,
  functionName: ReadFn,
  args: readonly unknown[] = [],
): Promise<T> {
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName,
    args: args as never,
  });
  const result = await ethCall({ to: getAddress(safeAddress), data });
  return decodeFunctionResult({
    abi: SAFE_ABI,
    functionName,
    data: result,
  }) as T;
}

export interface SafeBasicInfo {
  address: string;
  version: string;
  threshold: number;
  nonce: number;
  owners: string[];
}

/**
 * On-chain reads. Every method is a single `eth_call`; nothing here is cached,
 * because a stale nonce or threshold is a correctness bug, not a performance
 * win.
 */
export class SafeReader {
  constructor(
    readonly safeAddress: string,
    private readonly ethCall: EthCall,
  ) {}

  getVersion(): Promise<string> {
    return read<string>(this.ethCall, this.safeAddress, "VERSION");
  }

  async getNonce(): Promise<number> {
    return Number(await read<bigint>(this.ethCall, this.safeAddress, "nonce"));
  }

  async getThreshold(): Promise<number> {
    return Number(
      await read<bigint>(this.ethCall, this.safeAddress, "getThreshold"),
    );
  }

  async getOwners(): Promise<string[]> {
    const owners = await read<readonly string[]>(
      this.ethCall,
      this.safeAddress,
      "getOwners",
    );
    return owners.map((owner) => getAddress(owner));
  }

  /** True when `owner` has approved `safeTxHash` on-chain via `approveHash`. */
  async hasApprovedHash(owner: string, safeTxHash: string): Promise<boolean> {
    const approved = await read<bigint>(
      this.ethCall,
      this.safeAddress,
      "approvedHashes",
      [getAddress(owner), safeTxHash as Hex],
    );
    return approved > 0n;
  }

  /** Owners that already approved `safeTxHash` on-chain. */
  async getOwnersWhoApproved(
    safeTxHash: string,
    owners?: string[],
  ): Promise<string[]> {
    const list = owners ?? (await this.getOwners());
    const approved = await Promise.all(
      list.map((owner) => this.hasApprovedHash(owner, safeTxHash)),
    );
    return list.filter((_, i) => approved[i]);
  }

  /**
   * `CompatibilityFallbackHandler.getMessageHash`. Prefer `hashSafeMessage`
   * from the core layer — it computes the same value with no network call.
   * This exists to cross-check a Safe with a non-standard fallback handler.
   */
  getMessageHash(messageHash: string): Promise<Hex> {
    return read<Hex>(this.ethCall, this.safeAddress, "getMessageHash", [
      messageHash as Hex,
    ]);
  }

  async getBasicInfo(version?: string): Promise<SafeBasicInfo> {
    const [resolvedVersion, threshold, nonce, owners] = await Promise.all([
      version ? Promise.resolve(version) : this.getVersion(),
      this.getThreshold(),
      this.getNonce(),
      this.getOwners(),
    ]);
    return {
      address: getAddress(this.safeAddress),
      version: resolvedVersion,
      threshold,
      nonce,
      owners,
    };
  }
}

/** Read a Safe's deployed version without constructing anything else. */
export function getSafeVersion(
  ethCall: EthCall,
  safeAddress: string,
): Promise<string> {
  return read<string>(ethCall, safeAddress, "VERSION");
}
