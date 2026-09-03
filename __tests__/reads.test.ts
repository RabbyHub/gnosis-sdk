import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import { SAFE_ABI } from "../src/core/abi";
import { SafeReader, getSafeVersion } from "../src/rpc/reads";
import { ethCallFromRpc, type EthCall } from "../src/rpc/types";

const SAFE = "0x1234567890123456789012345678901234567890";
const OWNER_A = "0xAA00000000000000000000000000000000000001";
const OWNER_B = "0xBb00000000000000000000000000000000000002";
const HASH = `0x${"12".repeat(32)}` as const;

/** An in-memory Safe that answers eth_call the way the real contract would. */
function fakeSafe(state: {
  version?: string;
  nonce?: bigint;
  threshold?: bigint;
  owners?: readonly string[];
  approved?: Record<string, bigint>;
}) {
  const calls: string[] = [];
  const ethCall: EthCall = async ({ to, data }) => {
    expect(to).toBe(SAFE);
    const { functionName, args } = decodeFunctionData({ abi: SAFE_ABI, data });
    calls.push(functionName);
    switch (functionName) {
      case "VERSION":
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: state.version ?? "1.3.0" });
      case "nonce":
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: state.nonce ?? 0n });
      case "getThreshold":
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: state.threshold ?? 1n });
      case "getOwners":
        // viem spreads array results across outputs, so wrap the single address[] output.
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: [state.owners ?? []] as any });
      case "approvedHashes": {
        const [owner] = args as [string, string];
        return encodeFunctionResult({
          abi: SAFE_ABI,
          functionName,
          result: state.approved?.[owner.toLowerCase()] ?? 0n,
        });
      }
      default:
        throw new Error(`unexpected call: ${functionName}`);
    }
  };
  return { ethCall, calls };
}

describe("SafeReader", () => {
  it("decodes each read into a plain JS value", async () => {
    const { ethCall } = fakeSafe({
      version: "1.4.1",
      nonce: 42n,
      threshold: 2n,
      owners: [OWNER_A, OWNER_B],
    });
    const reader = new SafeReader(SAFE, ethCall);

    expect(await reader.getVersion()).toBe("1.4.1");
    expect(await reader.getNonce()).toBe(42);
    expect(await reader.getThreshold()).toBe(2);
    expect(await reader.getOwners()).toEqual([OWNER_A, OWNER_B]);
  });

  it("checksums owners returned by the contract", async () => {
    const { ethCall } = fakeSafe({ owners: [OWNER_A.toLowerCase()] });
    expect(await new SafeReader(SAFE, ethCall).getOwners()).toEqual([OWNER_A]);
  });

  it("accepts a lowercase safe address and calls the checksummed one", async () => {
    const { ethCall } = fakeSafe({ nonce: 1n });
    expect(await new SafeReader(SAFE.toLowerCase(), ethCall).getNonce()).toBe(1);
  });

  it("reports which owners approved a hash on-chain", async () => {
    const { ethCall } = fakeSafe({
      owners: [OWNER_A, OWNER_B],
      approved: { [OWNER_A.toLowerCase()]: 1n },
    });
    const reader = new SafeReader(SAFE, ethCall);

    expect(await reader.hasApprovedHash(OWNER_A, HASH)).toBe(true);
    expect(await reader.hasApprovedHash(OWNER_B, HASH)).toBe(false);
    expect(await reader.getOwnersWhoApproved(HASH)).toEqual([OWNER_A]);
  });

  it("reuses a supplied owner list instead of re-reading it", async () => {
    const { ethCall, calls } = fakeSafe({ approved: {} });
    await new SafeReader(SAFE, ethCall).getOwnersWhoApproved(HASH, [OWNER_A]);
    expect(calls).toEqual(["approvedHashes"]);
  });

  it("fetches basic info in one round of parallel calls", async () => {
    const { ethCall, calls } = fakeSafe({
      version: "1.3.0",
      nonce: 7n,
      threshold: 2n,
      owners: [OWNER_A, OWNER_B],
    });
    const info = await new SafeReader(SAFE.toLowerCase(), ethCall).getBasicInfo();

    expect(info).toEqual({
      address: SAFE,
      version: "1.3.0",
      threshold: 2,
      nonce: 7,
      owners: [OWNER_A, OWNER_B],
    });
    expect(calls).toHaveLength(4);
  });

  it("skips the VERSION call when the version is already known", async () => {
    const { ethCall, calls } = fakeSafe({ owners: [] });
    await new SafeReader(SAFE, ethCall).getBasicInfo("1.4.1");
    expect(calls).not.toContain("VERSION");
  });
});

describe("getSafeVersion", () => {
  it("reads VERSION without constructing a reader", async () => {
    const { ethCall } = fakeSafe({ version: "1.1.1" });
    expect(await getSafeVersion(ethCall, SAFE)).toBe("1.1.1");
  });
});

describe("ethCallFromRpc", () => {
  it("issues eth_call against the latest block", async () => {
    const rpc = vi.fn().mockResolvedValue("0x1");
    await ethCallFromRpc(rpc)({ to: SAFE, data: "0xabcd" });
    expect(rpc).toHaveBeenCalledWith("eth_call", [
      { to: SAFE, data: "0xabcd" },
      "latest",
    ]);
  });
});
