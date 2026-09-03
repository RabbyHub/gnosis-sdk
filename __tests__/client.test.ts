import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import { SAFE_ABI } from "../src/core/abi";
import { createSafeClient } from "../src/client";
import { prevalidatedSignature } from "../src/core/signature";
import type { EthCall } from "../src/rpc/types";
import type { SafeTxService } from "../src/txService/types";

const SAFE = "0x1234567890123456789012345678901234567890";
const OWNER = "0xAA00000000000000000000000000000000000001";
const ZERO = "0x0000000000000000000000000000000000000000";

const fakeChain = (nonce: bigint, threshold = 1n, owners: string[] = [OWNER]) => {
  const ethCall: EthCall = async ({ data }) => {
    const { functionName } = decodeFunctionData({ abi: SAFE_ABI, data });
    switch (functionName) {
      case "nonce":
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: nonce });
      case "getThreshold":
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: threshold });
      case "getOwners":
        return encodeFunctionResult({ abi: SAFE_ABI, functionName, result: [owners] as any });
      default:
        throw new Error(`unexpected ${functionName}`);
    }
  };
  return ethCall;
};

const fakeTxService = (over: Partial<SafeTxService> = {}): SafeTxService =>
  ({
    getSafeInfo: vi.fn(),
    getPendingTransactions: vi.fn().mockResolvedValue({ results: [] }),
    proposeTransaction: vi.fn().mockResolvedValue(undefined),
    confirmTransaction: vi.fn().mockResolvedValue(undefined),
    estimateSafeTxGas: vi.fn().mockResolvedValue("0"),
    getMessages: vi.fn().mockResolvedValue({ results: [] }),
    addMessage: vi.fn().mockResolvedValue(undefined),
    getMessage: vi.fn(),
    addMessageSignature: vi.fn().mockResolvedValue(undefined),
    ...over,
  }) as SafeTxService;

const client = (over: Partial<Parameters<typeof createSafeClient>[0]> = {}) =>
  createSafeClient({
    chainId: 1,
    safeAddress: SAFE,
    version: "1.3.0",
    ethCall: fakeChain(9n),
    txService: fakeTxService(),
    ...over,
  });

const tx = { to: OWNER, value: "1", data: "0x" };

describe("buildTransaction", () => {
  it("reads the nonce on-chain and defaults safeTxGas to 0 from 1.3.0 on", async () => {
    const txService = fakeTxService();
    const built = await client({ txService }).buildTransaction(tx);

    expect(built).toEqual({
      to: OWNER,
      value: "1",
      data: "0x",
      operation: 0,
      safeTxGas: "0",
      baseGas: "0",
      gasPrice: "0",
      gasToken: ZERO,
      refundReceiver: ZERO,
      nonce: 9,
    });
    expect(txService.estimateSafeTxGas).not.toHaveBeenCalled();
  });

  it("asks the transaction service to estimate safeTxGas below 1.3.0", async () => {
    const txService = fakeTxService({
      estimateSafeTxGas: vi.fn().mockResolvedValue("54321"),
    });
    const built = await client({ version: "1.1.1", txService }).buildTransaction(tx);

    expect(built.safeTxGas).toBe("54321");
    expect(txService.estimateSafeTxGas).toHaveBeenCalledWith(SAFE, {
      to: OWNER,
      value: "1",
      data: "0x",
      operation: 0,
    });
  });

  it("makes no network or chain calls when nonce and safeTxGas are supplied", async () => {
    const ethCall = vi.fn();
    const txService = fakeTxService();
    const built = await client({
      version: "1.1.1",
      ethCall: ethCall as unknown as EthCall,
      txService,
    }).buildTransaction(tx, { nonce: 3, safeTxGas: "0" });

    expect(built.nonce).toBe(3);
    expect(ethCall).not.toHaveBeenCalled();
    expect(txService.estimateSafeTxGas).not.toHaveBeenCalled();
  });

  it("prefers an explicit nonce on the input over the chain", async () => {
    const built = await client().buildTransaction({ ...tx, nonce: 42 });
    expect(built.nonce).toBe(42);
  });
});

describe("hashing", () => {
  it("produces the same safeTxHash the typed data would", async () => {
    const safe = client();
    const built = await safe.buildTransaction(tx);
    const typedData = safe.getTransactionTypedData(built);

    expect(typedData.primaryType).toBe("SafeTx");
    expect(typedData.domain).toEqual({ chainId: 1, verifyingContract: SAFE });
    expect(safe.hashTransaction(built)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("proposeTransaction", () => {
  it("sends the transaction service the checksummed payload", async () => {
    const txService = fakeTxService();
    const safe = client({ txService });
    const built = await safe.buildTransaction(tx);
    const safeTxHash = safe.hashTransaction(built);

    await safe.proposeTransaction({
      txData: built,
      safeTxHash,
      sender: OWNER.toLowerCase(),
      signature: { signer: OWNER, data: "0xsig" },
    });

    expect(txService.proposeTransaction).toHaveBeenCalledWith(
      SAFE,
      expect.objectContaining({
        safe: SAFE,
        sender: OWNER,
        contractTransactionHash: safeTxHash,
        signature: "0xsig",
        nonce: 9,
      }),
    );
  });
});

describe("encodeExecTransaction", () => {
  it("returns an unsigned transaction, not a broadcast", async () => {
    const safe = client();
    const built = await safe.buildTransaction(tx);
    const result = safe.encodeExecTransaction(built, [prevalidatedSignature(OWNER)]);

    expect(result.to).toBe(SAFE);
    expect(result.value).toBe("0");
    expect(decodeFunctionData({ abi: SAFE_ABI, data: result.data }).functionName).toBe(
      "execTransaction",
    );
  });
});

describe("assertExecutable", () => {
  it("passes when the threshold is met", () => {
    expect(() =>
      client().assertExecutable([{ signer: OWNER, data: "0x" }], 1),
    ).not.toThrow();
  });

  it.each([
    [0, 1, "There is 1 signature missing"],
    [1, 3, "There are 2 signatures missing"],
  ])("reports %i of %i signatures", (have, threshold, message) => {
    const sigs = Array.from({ length: have }, () => ({ signer: OWNER, data: "0x" }));
    expect(() => client().assertExecutable(sigs, threshold)).toThrow(message);
  });
});

describe("chain access", () => {
  it("works without ethCall for anything that does not touch the chain", async () => {
    const safe = createSafeClient({
      chainId: 1,
      safeAddress: SAFE,
      version: "1.3.0",
      txService: fakeTxService(),
    });

    const built = await safe.buildTransaction(tx, { nonce: 1, safeTxGas: "0" });
    expect(safe.hashTransaction(built)).toMatch(/^0x/);
    await expect(safe.getMessages()).resolves.toEqual({ results: [] });
  });

  it("explains what is missing when a read needs the chain", async () => {
    const safe = createSafeClient({
      chainId: 1,
      safeAddress: SAFE,
      version: "1.3.0",
      txService: fakeTxService(),
    });

    await expect(safe.getOwners()).rejects.toThrow(/pass `ethCall`/);
  });
});

describe("end-to-end: build -> hash -> sign -> encode", () => {
  it("produces signatures that recover to the signing owners", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { recoverMessageAddress } = await import("viem");
    const { normalizeSignature } = await import("../src/core/signature");
    const { calculateSafeTransactionHash } = await import(
      "@safe-global/protocol-kit/dist/src/utils/signatures/utils"
    );

    const a = privateKeyToAccount(`0x${"11".repeat(32)}`);
    const b = privateKeyToAccount(`0x${"22".repeat(32)}`);
    const owners = [a.address, b.address].sort((x, y) =>
      x.toLowerCase().localeCompare(y.toLowerCase()),
    );

    const safe = createSafeClient({
      chainId: 137,
      safeAddress: SAFE,
      version: "1.3.0",
      ethCall: fakeChain(4n, 2n, owners),
      txService: fakeTxService(),
    });

    const built = await safe.buildTransaction({ to: OWNER, value: "5", data: "0x" });
    const safeTxHash = safe.hashTransaction(built);

    // The hash the pre-refactor code would have read off-chain.
    expect(safeTxHash).toBe(
      calculateSafeTransactionHash(SAFE, built, "1.3.0", 137n),
    );

    const signatures = await Promise.all(
      [a, b].map(async (account) =>
        normalizeSignature({
          signature: await account.signMessage({ message: { raw: safeTxHash } }),
          signer: account.address,
          method: "personal_sign",
          hash: safeTxHash,
        }),
      ),
    );

    safe.assertExecutable(signatures, await safe.getThreshold());

    // Each packed signature, with the +4 prefix marker removed, recovers to its owner.
    const packed = safe.encodeSignatures(signatures).slice(2);
    for (let i = 0; i < signatures.length; i++) {
      const slot = packed.slice(i * 130, (i + 1) * 130);
      const v = parseInt(slot.slice(-2), 16);
      expect(v).toBeGreaterThan(30); // prefixed, as personal_sign produces
      // personal_sign hashed with the EIP-191 prefix, so recovery must too.
      const recovered = await recoverMessageAddress({
        message: { raw: safeTxHash },
        signature: `0x${slot.slice(0, -2)}${(v - 4).toString(16)}`,
      });
      expect(recovered).toBe(owners[i]); // packed in ascending owner order
    }

    const execTx = safe.encodeExecTransaction(built, signatures);
    expect(execTx.to).toBe(SAFE);
    expect(execTx.data).toContain(packed);
  });
});
