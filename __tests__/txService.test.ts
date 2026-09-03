import { describe, expect, it, vi } from "vitest";
import {
  BackendSafeTxService,
  HttpSafeTxService,
  SafeTxServiceError,
  createSafeTxService,
} from "../src/txService";
import type { SafeBackendService } from "../src/txService/backend";

const SAFE = "0x1234567890123456789012345678901234567890";
const BASE = "https://safe-transaction-blast.safe.global/api";

function stubFetch(body: unknown = {}, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof globalThis.fetch;
}

const lastCall = (fetchMock: any) => {
  const [url, options] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), options, body: options?.body ? JSON.parse(options.body) : undefined };
};

describe("HttpSafeTxService", () => {
  it("builds the pending-transactions query", async () => {
    const fetchMock = stubFetch({ results: [] });
    const service = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });

    await service.getPendingTransactions(SAFE, 7);

    expect(lastCall(fetchMock).url).toBe(
      `${BASE}/v1/safes/${SAFE}/multisig-transactions/?executed=false&nonce__gte=7`,
    );
  });

  it("posts a proposed transaction to the multisig endpoint", async () => {
    const fetchMock = stubFetch({});
    const service = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });
    const payload = { safe: SAFE, nonce: 1 } as any;

    await service.proposeTransaction(SAFE, payload);
    const call = lastCall(fetchMock);

    expect(call.url).toBe(`${BASE}/v1/safes/${SAFE}/multisig-transactions/`);
    expect(call.options.method).toBe("POST");
    expect(call.body).toEqual(payload);
  });

  it("posts a confirmation under the safeTxHash", async () => {
    const fetchMock = stubFetch({});
    const service = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });

    await service.confirmTransaction("0xdead", "0xsig");
    const call = lastCall(fetchMock);

    expect(call.url).toBe(`${BASE}/v1/multisig-transactions/0xdead/confirmations/`);
    expect(call.body).toEqual({ signature: "0xsig" });
  });

  it("unwraps safeTxGas from the estimation response", async () => {
    const fetchMock = stubFetch({ safeTxGas: "12345" });
    const service = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });

    expect(
      await service.estimateSafeTxGas(SAFE, {
        to: SAFE,
        value: "0",
        data: null,
        operation: 0,
      }),
    ).toBe("12345");
  });

  it("trims a trailing slash off the base url", async () => {
    const fetchMock = stubFetch({});
    const service = new HttpSafeTxService({ baseUrl: `${BASE}/`, fetch: fetchMock });

    await service.getSafeInfo(SAFE);
    expect(lastCall(fetchMock).url).toBe(`${BASE}/v1/safes/${SAFE}/`);
  });

  it("omits undefined query params", async () => {
    const fetchMock = stubFetch({ results: [] });
    const service = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });

    await service.getMessages(SAFE, { limit: 10, offset: undefined });
    expect(lastCall(fetchMock).url).toBe(`${BASE}/v1/safes/${SAFE}/messages/?limit=10`);
  });

  it("exposes the service error payload as error.response.data", async () => {
    // Callers read this to surface the service's own validation message.
    const fetchMock = stubFetch({ nonce: ["Nonce already used"] }, { status: 422 });
    const service = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });

    const error = await service
      .proposeTransaction(SAFE, {} as any)
      .catch((e) => e);

    expect(error).toBeInstanceOf(SafeTxServiceError);
    expect(error.response.status).toBe(422);
    expect(error.response.data).toEqual({ nonce: ["Nonce already used"] });
  });
});

describe("BackendSafeTxService", () => {
  const http = new HttpSafeTxService({ baseUrl: BASE, fetch: stubFetch({ results: [] }) });

  it("forwards to the backend when it implements the method", async () => {
    const backend: SafeBackendService = {
      getSafePendingTransactions: vi.fn().mockResolvedValue({ results: ["from-backend"] }),
    };
    const service = new BackendSafeTxService("/v1/safe-tx-service/eth/api", backend, http);

    expect(await service.getPendingTransactions(SAFE, 3)).toEqual({
      results: ["from-backend"],
    });
    expect(backend.getSafePendingTransactions).toHaveBeenCalledWith({
      txServiceUrl: "/v1/safe-tx-service/eth/api",
      safeAddress: SAFE,
      nonce: 3,
    });
  });

  it("falls back to HTTP per method when the backend lacks it", async () => {
    const fetchMock = stubFetch({ results: [] });
    const fallback = new HttpSafeTxService({ baseUrl: BASE, fetch: fetchMock });
    const service = new BackendSafeTxService("/proxy", {}, fallback);

    await service.getPendingTransactions(SAFE, 1);
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("createSafeTxService", () => {
  it("uses HTTP directly for a chain with an absolute tx service url", () => {
    // 81457 (blast) is in HOST_MAP with an absolute URL.
    expect(createSafeTxService({ chainId: 81457 })).toBeInstanceOf(HttpSafeTxService);
  });

  it("requires a backend for proxied chains", () => {
    expect(() => createSafeTxService({ chainId: 1 })).toThrow(
      /served through a backend proxy/,
    );
    expect(createSafeTxService({ chainId: 1, backend: {} })).toBeInstanceOf(
      BackendSafeTxService,
    );
  });

  it("rejects an unsupported chain", () => {
    expect(() => createSafeTxService({ chainId: 999999 })).toThrow(
      /not supported on chain 999999/,
    );
  });
});
