import { describe, expect, it } from "vitest";
import {
  calculateSafeMessageHash,
  calculateSafeTransactionHash,
} from "@safe-global/protocol-kit/dist/src/utils/signatures/utils";
import { hashSafeMessage, hashSafeTransaction } from "../src/core/hash";
import { domainIncludesChainId } from "../src/core/typedData";
import type { SafeTransactionData } from "../src/core/types";

const SAFE = "0x1234567890123456789012345678901234567890";
const ZERO = "0x0000000000000000000000000000000000000000";
const VERSIONS = ["1.0.0", "1.1.1", "1.2.0", "1.3.0", "1.4.1"];
const CHAIN_IDS = [1, 10, 56, 137, 8453, 81457];

const tx = (over: Partial<SafeTransactionData> = {}): SafeTransactionData => ({
  to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  value: "1000000000000000000",
  data: "0xdeadbeef",
  operation: 0,
  safeTxGas: "0",
  baseGas: "0",
  gasPrice: "0",
  gasToken: ZERO,
  refundReceiver: ZERO,
  nonce: 5,
  ...over,
});

describe("hashSafeTransaction", () => {
  it("matches protocol-kit across every version and chain", () => {
    for (const safeVersion of VERSIONS) {
      for (const chainId of CHAIN_IDS) {
        const txData = tx({ nonce: chainId });
        expect(
          hashSafeTransaction({ safeAddress: SAFE, safeVersion, chainId }, txData),
        ).toBe(
          calculateSafeTransactionHash(SAFE, txData, safeVersion, BigInt(chainId)),
        );
      }
    }
  });

  it.each([
    ["empty data", { data: "0x" }],
    ["odd-length data", { data: "0xabc" }],
    ["long data", { data: `0x${"ab".repeat(500)}` }],
    ["delegatecall", { operation: 1 as const }],
    ["max uint256 value", { value: (2n ** 256n - 1n).toString() }],
    ["refund fields set", { gasPrice: "7", baseGas: "21000", gasToken: SAFE }],
    ["nonce 0", { nonce: 0 }],
  ])("matches protocol-kit for %s", (_label, over) => {
    const txData = tx(over as Partial<SafeTransactionData>);
    expect(
      hashSafeTransaction(
        { safeAddress: SAFE, safeVersion: "1.3.0", chainId: 1 },
        txData,
      ),
    ).toBe(calculateSafeTransactionHash(SAFE, txData, "1.3.0", 1n));
  });

  it("accepts chainId as number, string or bigint", () => {
    const txData = tx();
    const params = { safeAddress: SAFE, safeVersion: "1.3.0" };
    const asNumber = hashSafeTransaction({ ...params, chainId: 137 }, txData);
    expect(hashSafeTransaction({ ...params, chainId: "137" }, txData)).toBe(asNumber);
    expect(hashSafeTransaction({ ...params, chainId: 137n }, txData)).toBe(asNumber);
  });

  it("binds the hash to the chain only from 1.3.0 on", () => {
    const txData = tx();
    const on = (safeVersion: string, chainId: number) =>
      hashSafeTransaction({ safeAddress: SAFE, safeVersion, chainId }, txData);

    // Pre-1.3.0 domains carry no chainId, so the same hash replays across chains.
    expect(on("1.1.1", 1)).toBe(on("1.1.1", 137));
    expect(on("1.3.0", 1)).not.toBe(on("1.3.0", 137));
  });
});

describe("domainIncludesChainId", () => {
  it.each([
    ["1.0.0", false],
    ["1.1.1", false],
    ["1.2.0", false],
    ["1.3.0", true],
    ["1.4.1", true],
  ])("%s -> %s", (version, expected) => {
    expect(domainIncludesChainId(version)).toBe(expected);
  });
});

describe("hashSafeMessage", () => {
  const params = { safeAddress: SAFE, safeVersion: "1.3.0", chainId: 1 };

  it("matches protocol-kit for a plain string message", () => {
    // protocol-kit takes the already-hashed message; we hash it internally.
    const { hashSafeMessage: hashRaw } = require("@safe-global/protocol-kit");
    const inner = hashRaw("hello safe");
    expect(hashSafeMessage(params, "hello safe")).toBe(
      calculateSafeMessageHash(SAFE, inner, "1.3.0", 1n),
    );
  });

  it("matches protocol-kit for EIP-712 typed data", () => {
    const typedData = {
      domain: { name: "Test", version: "1", chainId: 1, verifyingContract: SAFE },
      types: { Mail: [{ name: "contents", type: "string" }] },
      primaryType: "Mail",
      message: { contents: "hi" },
    };
    const { hashSafeMessage: hashRaw } = require("@safe-global/protocol-kit");
    expect(hashSafeMessage(params, typedData as any)).toBe(
      calculateSafeMessageHash(SAFE, hashRaw(typedData), "1.3.0", 1n),
    );
  });
});
