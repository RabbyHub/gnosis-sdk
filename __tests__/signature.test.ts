import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";
import {
  buildSignatureBytes,
  generatePreValidatedSignature,
} from "@safe-global/protocol-kit/dist/src/utils/signatures/utils";
import { EthSafeSignature } from "@safe-global/protocol-kit";
import {
  encodeSignatures,
  isSignedWithPrefix,
  normalizeSignature,
  prevalidatedSignature,
} from "../src/core/signature";
import type { SafeSignature } from "../src/core/types";

const account = privateKeyToAccount(
  "0x4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e3e3e3",
);
const HASH = keccak256(toHex("safe tx hash"));

const withV = (v: number) => `0x${"11".repeat(64)}${v.toString(16).padStart(2, "0")}`;

describe("normalizeSignature", () => {
  it("keeps V as-is for a typed-data signature", async () => {
    const signature = await account.signTypedData({
      domain: { chainId: 1, verifyingContract: account.address },
      types: { SafeTx: [{ name: "nonce", type: "uint256" }] },
      primaryType: "SafeTx",
      message: { nonce: 1n },
    });
    const sig = await normalizeSignature({
      signature,
      signer: account.address,
      method: "eth_signTypedData",
    });
    expect(sig.data).toBe(signature);
    expect(parseInt(sig.data.slice(-2), 16)).toBeGreaterThanOrEqual(27);
  });

  it.each([0, 1])("lifts V=%i into the 27/28 range", async (v) => {
    const sig = await normalizeSignature({
      signature: withV(v),
      signer: account.address,
      method: "eth_signTypedData",
    });
    expect(parseInt(sig.data.slice(-2), 16)).toBe(v + 27);
    expect(sig.data).toHaveLength(132);
  });

  it("adds 4 to V when the signer applied the EIP-191 prefix", async () => {
    // signMessage hashes with the \x19Ethereum Signed Message prefix.
    const signature = await account.signMessage({ message: { raw: HASH } });
    const sig = await normalizeSignature({
      signature,
      signer: account.address,
      method: "personal_sign",
      hash: HASH,
    });
    const original = parseInt(signature.slice(-2), 16);
    expect(parseInt(sig.data.slice(-2), 16)).toBe(original + 4);
    expect(sig.data.slice(0, -2)).toBe(signature.slice(0, -2));
  });

  it("leaves V alone when the signer did not prefix", async () => {
    // Signing the raw hash directly is what a prefix-less eth_sign does.
    const signature = await account.sign({ hash: HASH });
    const sig = await normalizeSignature({
      signature,
      signer: account.address,
      method: "eth_sign",
      hash: HASH,
    });
    expect(sig.data).toBe(signature);
  });

  it("never emits an odd-length V nibble", async () => {
    for (const v of [0, 1, 27, 28]) {
      const sig = await normalizeSignature({
        signature: withV(v),
        signer: account.address,
        method: "eth_signTypedData",
      });
      expect(sig.data).toHaveLength(132);
    }
  });

  it("rejects a signature that is not 65 bytes", async () => {
    await expect(
      normalizeSignature({
        signature: `0x${"11".repeat(64)}`,
        signer: account.address,
        method: "eth_signTypedData",
      }),
    ).rejects.toThrow(/Invalid signature length/);
  });

  it("rejects an out-of-range V", async () => {
    await expect(
      normalizeSignature({
        signature: withV(7),
        signer: account.address,
        method: "eth_signTypedData",
      }),
    ).rejects.toThrow(/Invalid signature V value/);
  });

  it("requires a hash for prefix-probing methods", async () => {
    await expect(
      normalizeSignature({
        signature: withV(27),
        signer: account.address,
        method: "personal_sign",
      }),
    ).rejects.toThrow(/"hash" is required/);
  });
});

describe("isSignedWithPrefix", () => {
  it("is false for a raw-hash signature and true for a prefixed one", async () => {
    const raw = await account.sign({ hash: HASH });
    const prefixed = await account.signMessage({ message: { raw: HASH } });
    expect(await isSignedWithPrefix(HASH, raw, account.address)).toBe(false);
    expect(await isSignedWithPrefix(HASH, prefixed, account.address)).toBe(true);
  });

  it("assumes prefixed when recovery throws", async () => {
    expect(await isSignedWithPrefix(HASH, "0xnotasignature", account.address)).toBe(
      true,
    );
  });
});

describe("prevalidatedSignature", () => {
  it("matches protocol-kit", () => {
    const owner = "0xAbC0000000000000000000000000000000000001";
    expect(prevalidatedSignature(owner).data).toBe(
      generatePreValidatedSignature(owner).data,
    );
  });
});

describe("encodeSignatures", () => {
  const a: SafeSignature = { signer: "0xaa00000000000000000000000000000000000001", data: `0x${"aa".repeat(65)}` };
  const b: SafeSignature = { signer: "0xBB00000000000000000000000000000000000002", data: `0x${"bb".repeat(65)}` };
  const c: SafeSignature = { signer: "0xcc00000000000000000000000000000000000003", data: `0x${"cc".repeat(65)}` };

  const oracle = (sigs: SafeSignature[]) =>
    buildSignatureBytes(
      sigs.map((s) => new EthSafeSignature(s.signer, s.data, s.isContractSignature)),
    );

  it("sorts owners ascending regardless of input order", () => {
    const expected = `0x${"aa".repeat(65)}${"bb".repeat(65)}${"cc".repeat(65)}`;
    expect(encodeSignatures([c, a, b])).toBe(expected);
    expect(encodeSignatures([b, c, a])).toBe(expected);
  });

  it("does not mutate the input array", () => {
    const input = [c, a, b];
    encodeSignatures(input);
    expect(input).toEqual([c, a, b]);
  });

  it("matches protocol-kit for ECDSA signatures", () => {
    expect(encodeSignatures([c, a, b])).toBe(oracle([c, a, b]));
  });

  it("matches protocol-kit for mixed ECDSA and EIP-1271 signatures", () => {
    const contractSig: SafeSignature = {
      signer: "0xdd00000000000000000000000000000000000004",
      data: `0x${"dd".repeat(70)}`,
      isContractSignature: true,
    };
    expect(encodeSignatures([a, contractSig, b])).toBe(oracle([a, contractSig, b]));
  });

  it("returns 0x for no signatures", () => {
    expect(encodeSignatures([])).toBe("0x");
  });
});
