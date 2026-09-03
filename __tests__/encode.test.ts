import { describe, expect, it } from "vitest";
import { Contract } from "ethers";
import { getSafeSingletonDeployment } from "@safe-global/safe-deployments";
import { encodeApproveHash, encodeExecTransaction } from "../src/core/encode";
import { prevalidatedSignature } from "../src/core/signature";
import type { SafeSignature, SafeTransactionData } from "../src/core/types";

const SAFE = "0x1234567890123456789012345678901234567890";
const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * The pre-refactor implementation: an ethers v5 Contract built from the
 * safe-deployments ABI. Calldata must stay byte-identical.
 */
const legacy = new Contract(
  SAFE,
  getSafeSingletonDeployment({ version: "1.3.0", network: "1" })!.abi as any,
);

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

const legacyExecData = (txData: SafeTransactionData, signatures: string) =>
  legacy.interface.encodeFunctionData("execTransaction", [
    txData.to,
    txData.value,
    txData.data,
    txData.operation,
    txData.safeTxGas,
    txData.baseGas,
    txData.gasPrice,
    txData.gasToken,
    txData.refundReceiver,
    signatures,
  ]);

describe("encodeExecTransaction", () => {
  it.each([
    ["default", {}],
    ["empty data", { data: "0x" }],
    ["delegatecall", { operation: 1 as const }],
    ["refund fields", { gasPrice: "7", baseGas: "21000", gasToken: SAFE, refundReceiver: SAFE }],
    ["large calldata", { data: `0x${"ab".repeat(1024)}` }],
    ["max uint256 value", { value: (2n ** 256n - 1n).toString() }],
  ])("produces the same calldata as ethers for %s", (_label, over) => {
    const txData = tx(over as Partial<SafeTransactionData>);
    const sigs: SafeSignature[] = [
      prevalidatedSignature("0xaa00000000000000000000000000000000000001"),
      prevalidatedSignature("0xbb00000000000000000000000000000000000002"),
    ];
    const packed = `0x${sigs.map((s) => s.data.slice(2)).join("")}`;

    const result = encodeExecTransaction(SAFE, txData, sigs);
    expect(result.data).toBe(legacyExecData(txData, packed));
    expect(result.to).toBe("0x1234567890123456789012345678901234567890");
    expect(result.value).toBe("0");
  });

  it("checksums a lowercase safe address", () => {
    const result = encodeExecTransaction(SAFE.toLowerCase(), tx(), []);
    expect(result.to).toBe("0x1234567890123456789012345678901234567890");
  });

  it("treats null data as 0x", () => {
    const txData = { ...tx(), data: null as unknown as string };
    expect(encodeExecTransaction(SAFE, txData, []).data).toBe(
      legacyExecData({ ...txData, data: "0x" }, "0x"),
    );
  });
});

describe("encodeApproveHash", () => {
  it("produces the same calldata as ethers", () => {
    const hash = `0x${"12".repeat(32)}`;
    expect(encodeApproveHash(SAFE, hash).data).toBe(
      legacy.interface.encodeFunctionData("approveHash", [hash]),
    );
  });
});
