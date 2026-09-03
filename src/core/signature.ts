import { recoverAddress } from "viem";
import type { Hex, SafeSignature, SigningMethod } from "./types";

const ETHEREUM_V_VALUES = [0, 1, 27, 28];
const MIN_VALID_V_VALUE = 27;
/** Safe marks EIP-191-prefixed ECDSA signatures by adding 4 to V. */
const EIP191_V_OFFSET = 4;
const SIGNATURE_LENGTH_BYTES = 65;

export function sameString(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function setV(signature: string, v: number): string {
  return signature.slice(0, -2) + v.toString(16).padStart(2, "0");
}

/**
 * Did the signer hash an EIP-191 prefix before signing?
 *
 * Wallets disagree: some `personal_sign`/`eth_sign` implementations prefix, some
 * do not, and there is no way to ask. The only reliable probe is to recover
 * against the raw hash and see whether we get the signer back.
 */
export async function isSignedWithPrefix(
  hash: string,
  signature: string,
  signerAddress: string,
): Promise<boolean> {
  try {
    const recovered = await recoverAddress({
      hash: hash as Hex,
      signature: signature as Hex,
    });
    return !sameString(recovered, signerAddress);
  } catch {
    return true;
  }
}

export interface NormalizeSignatureParams {
  /** Raw 65-byte signature as returned by the signer. */
  signature: string;
  /** Owner address that produced it. */
  signer: string;
  /** How it was produced — decides whether the prefix probe runs. */
  method: SigningMethod;
  /** The hash that was signed. Required for `eth_sign` / `personal_sign`. */
  hash?: string;
}

/**
 * Turn a raw wallet signature into the V encoding the Safe contract expects.
 *
 * - V is always lifted into the 27/28 range (hardware wallets return 0/1).
 * - For `eth_sign` / `personal_sign`, V additionally gets +4 when the signer
 *   applied the EIP-191 prefix.
 *
 * @see https://docs.safe.global/safe-core-protocol/signatures
 */
export async function normalizeSignature({
  signature,
  signer,
  method,
  hash,
}: NormalizeSignatureParams): Promise<SafeSignature> {
  if (signature.slice(2).length !== SIGNATURE_LENGTH_BYTES * 2) {
    throw new Error(
      `Invalid signature length: expected ${SIGNATURE_LENGTH_BYTES} bytes, got ${
        signature.slice(2).length / 2
      }`,
    );
  }

  let v = parseInt(signature.slice(-2), 16);
  if (!ETHEREUM_V_VALUES.includes(v)) {
    throw new Error(`Invalid signature V value: ${v}`);
  }
  if (v < MIN_VALID_V_VALUE) {
    v += MIN_VALID_V_VALUE;
  }

  let data = setV(signature, v);

  if (method === "eth_sign" || method === "personal_sign") {
    if (!hash) {
      throw new Error(`"hash" is required to normalize a ${method} signature`);
    }
    if (await isSignedWithPrefix(hash, data, signer)) {
      data = setV(data, v + EIP191_V_OFFSET);
    }
  }

  return { signer, data };
}

/**
 * A signature that stands in for an owner who already approved the hash
 * on-chain, or who is the sender of the executing transaction.
 */
export function prevalidatedSignature(ownerAddress: string): SafeSignature {
  return {
    signer: ownerAddress,
    data:
      "0x000000000000000000000000" +
      ownerAddress.slice(2) +
      "0".repeat(64) +
      "01",
  };
}

/**
 * Static slot of an EIP-1271 signature:
 * {32-byte signer}{32-byte offset into the dynamic area}{1-byte type 0x00}
 */
function contractStaticPart(sig: SafeSignature, dynamicOffset: string): string {
  return `${sig.signer.slice(2).padStart(64, "0")}${dynamicOffset}00`;
}

/** Dynamic slot of an EIP-1271 signature: {32-byte length}{payload}. */
function contractDynamicPart(sig: SafeSignature): string {
  const length = (sig.data.slice(2).length / 2).toString(16).padStart(64, "0");
  return `${length}${sig.data.slice(2)}`;
}

/**
 * Pack signatures into the `signatures` argument of `execTransaction`.
 *
 * Owners MUST be sorted ascending by address: the Safe contract walks the
 * packed bytes in order and requires each recovered owner to be strictly
 * greater than the previous one. Out-of-order signatures revert.
 */
export function encodeSignatures(signatures: SafeSignature[]): Hex {
  const sorted = [...signatures].sort((a, b) =>
    a.signer.toLowerCase().localeCompare(b.signer.toLowerCase()),
  );

  let staticBytes = "";
  let dynamicBytes = "";
  for (const sig of sorted) {
    if (sig.isContractSignature) {
      const offset = (
        sorted.length * SIGNATURE_LENGTH_BYTES +
        dynamicBytes.length / 2
      )
        .toString(16)
        .padStart(64, "0");
      staticBytes += contractStaticPart(sig, offset);
      dynamicBytes += contractDynamicPart(sig);
    } else {
      staticBytes += sig.data.slice(2);
    }
  }

  return `0x${staticBytes}${dynamicBytes}`;
}
