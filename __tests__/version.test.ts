import { describe, expect, it } from "vitest";
import satisfies from "semver/functions/satisfies";
import {
  compareSafeVersion,
  isAtLeastVersion,
  parseSafeVersion,
} from "../src/core/version";
import { requiresSafeTxGas } from "../src/core/build";
import { domainIncludesChainId } from "../src/core/typedData";

// Every version string a Safe singleton has ever reported, plus a few neighbours.
const VERSIONS = [
  "1.0.0",
  "1.1.0",
  "1.1.1",
  "1.2.0",
  "1.3.0",
  "1.3.0+L2",
  "1.4.0",
  "1.4.1",
  "1.4.1+L2",
  "2.0.0",
  "0.9.9",
  "1.10.0",
];

describe("isAtLeastVersion", () => {
  it.each(VERSIONS)("agrees with semver for %s >= 1.3.0", (version) => {
    expect(isAtLeastVersion(version, "1.3.0")).toBe(
      satisfies(version, ">=1.3.0"),
    );
  });

  it("orders minor versions numerically, not lexically", () => {
    // "1.10.0" < "1.9.0" as strings; as versions it is greater.
    expect(isAtLeastVersion("1.10.0", "1.9.0")).toBe(true);
    expect(compareSafeVersion("1.10.0", "1.9.0")).toBeGreaterThan(0);
  });

  it("ignores build metadata", () => {
    expect(compareSafeVersion("1.3.0+L2", "1.3.0")).toBe(0);
  });
});

describe("parseSafeVersion", () => {
  it.each([
    ["1.3.0", { major: 1, minor: 3, patch: 0 }],
    ["v1.4.1", { major: 1, minor: 4, patch: 1 }],
    [" 1.4.1+L2 ", { major: 1, minor: 4, patch: 1 }],
  ])("parses %s", (input, expected) => {
    expect(parseSafeVersion(input)).toEqual(expected);
  });

  it.each(["", "1.3", "not-a-version", "x.y.z"])("rejects %s", (input) => {
    expect(() => parseSafeVersion(input)).toThrow(/Unrecognized Safe version/);
  });
});

describe("callers of the version comparison", () => {
  it.each(VERSIONS)("requiresSafeTxGas matches semver for %s", (version) => {
    expect(requiresSafeTxGas(version)).toBe(satisfies(version, "<1.3.0"));
  });

  it.each(VERSIONS)("domainIncludesChainId matches semver for %s", (version) => {
    expect(domainIncludesChainId(version)).toBe(satisfies(version, ">=1.3.0"));
  });
});
