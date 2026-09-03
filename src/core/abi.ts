/**
 * The only Safe ABI fragments this SDK needs. Kept hand-written rather than
 * pulled from `safe-deployments` so the read/encode layer has no dependency on
 * deployment metadata and no version-specific ABI lookup.
 *
 * These signatures are stable across Safe 1.0.0 - 1.4.1.
 */
export const SAFE_ABI = [
  {
    type: "function",
    name: "VERSION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "nonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "approvedHashes",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getMessageHash",
    stateMutability: "view",
    inputs: [{ type: "bytes" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "approveHash",
    stateMutability: "nonpayable",
    inputs: [{ type: "bytes32", name: "hashToApprove" }],
    outputs: [],
  },
  {
    type: "function",
    name: "execTransaction",
    stateMutability: "payable",
    inputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "uint8", name: "operation" },
      { type: "uint256", name: "safeTxGas" },
      { type: "uint256", name: "baseGas" },
      { type: "uint256", name: "gasPrice" },
      { type: "address", name: "gasToken" },
      { type: "address", name: "refundReceiver" },
      { type: "bytes", name: "signatures" },
    ],
    outputs: [{ type: "bool", name: "success" }],
  },
] as const;
