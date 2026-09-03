import type {
  AddMessagePayload,
  EstimateGasPayload,
  GetMessagesOptions,
  ListResponse,
  ProposeTransactionPayload,
  SafeInfo,
  SafeMessageItem,
  SafeTransactionItem,
  SafeTxService,
} from "./types";

/**
 * Error thrown for a non-2xx transaction service response.
 *
 * The `response` property mirrors the axios error shape the SDK used to throw,
 * because callers read `error.response.data` to surface the service's own
 * validation message (which is far more useful than the status text).
 */
export class SafeTxServiceError extends Error {
  readonly response: { status: number; statusText: string; data: unknown };

  constructor(
    message: string,
    status: number,
    statusText: string,
    data: unknown,
  ) {
    super(message);
    this.name = "SafeTxServiceError";
    this.response = { status, statusText, data };
  }
}

export interface HttpSafeTxServiceOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

/** Talks to a Safe transaction service over HTTP. */
export class HttpSafeTxService implements SafeTxService {
  private readonly baseUrl: string;
  private readonly doFetch: typeof globalThis.fetch;
  private readonly headers: Record<string, string>;

  constructor({ baseUrl, fetch: fetchImpl, headers }: HttpSafeTxServiceOptions) {
    const impl = fetchImpl ?? globalThis.fetch;
    if (!impl) {
      throw new Error(
        "No fetch implementation available; pass options.fetch",
      );
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.doFetch = impl;
    this.headers = headers ?? {};
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    { params, body }: { params?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) query.set(key, String(value));
    }
    const queryString = query.toString();
    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ""}`;

    const response = await this.doFetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...this.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new SafeTxServiceError(
        `${method} ${path} failed with ${response.status}`,
        response.status,
        response.statusText,
        data,
      );
    }

    return data as T;
  }

  getSafeInfo(safeAddress: string): Promise<SafeInfo> {
    return this.request("GET", `/v1/safes/${safeAddress}/`);
  }

  getPendingTransactions(
    safeAddress: string,
    nonce: number,
  ): Promise<ListResponse<SafeTransactionItem>> {
    return this.request("GET", `/v1/safes/${safeAddress}/multisig-transactions/`, {
      params: { executed: false, nonce__gte: nonce },
    });
  }

  async proposeTransaction(
    safeAddress: string,
    payload: ProposeTransactionPayload,
  ): Promise<void> {
    await this.request("POST", `/v1/safes/${safeAddress}/multisig-transactions/`, {
      body: payload,
    });
  }

  async confirmTransaction(safeTxHash: string, signature: string): Promise<void> {
    await this.request(
      "POST",
      `/v1/multisig-transactions/${safeTxHash}/confirmations/`,
      { body: { signature } },
    );
  }

  async estimateSafeTxGas(
    safeAddress: string,
    payload: EstimateGasPayload,
  ): Promise<string | undefined> {
    const estimation = await this.request<{ safeTxGas: string }>(
      "POST",
      `/v1/safes/${safeAddress}/multisig-transactions/estimations/`,
      { body: payload },
    );
    return estimation?.safeTxGas;
  }

  getMessages(
    safeAddress: string,
    options?: GetMessagesOptions,
  ): Promise<ListResponse<SafeMessageItem>> {
    return this.request("GET", `/v1/safes/${safeAddress}/messages/`, {
      params: options as Record<string, unknown>,
    });
  }

  async addMessage(
    safeAddress: string,
    payload: AddMessagePayload,
  ): Promise<void> {
    await this.request("POST", `/v1/safes/${safeAddress}/messages/`, {
      body: payload,
    });
  }

  getMessage(messageHash: string): Promise<SafeMessageItem> {
    return this.request("GET", `/v1/messages/${messageHash}/`);
  }

  async addMessageSignature(
    messageHash: string,
    signature: string,
  ): Promise<void> {
    await this.request("POST", `/v1/messages/${messageHash}/signatures/`, {
      body: { signature },
    });
  }
}
