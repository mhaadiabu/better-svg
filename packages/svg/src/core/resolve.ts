import { decodeDataUrl, isInlineSvg } from "./url.js";
import { resolveSvgSource as resolveLocalSvg, type SvgNameInput } from "./local.js";
import { cacheMarkup, getCachedMarkup } from "./cache.js";

type MarkupResponse = { markup: string; publicResponse: boolean };
type PendingRequest = {
  controller: AbortController;
  consumers: number;
  result: Promise<MarkupResponse>;
};

const pending = new Map<string, PendingRequest>();

export type ResolveOptions = {
  fetchOptions?: RequestInit;
  signal: AbortSignal;
  cache: boolean;
  redirect?: RequestRedirect;
};

const fetchMarkup = async (source: string, options: ResolveOptions): Promise<MarkupResponse> => {
  const fetchImpl = typeof fetch === "function" ? fetch : undefined;
  if (!fetchImpl) throw new Error("Fetch is not available in this environment.");

  const headers = new Headers(options.fetchOptions?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "image/svg+xml");
  }

  const response = await fetchImpl(source, {
    ...options.fetchOptions,
    headers,
    signal: options.signal,
    redirect: options.redirect ?? options.fetchOptions?.redirect,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
  }

  const markup = await response.text();
  const directives = (response.headers.get("Cache-Control") ?? "")
    .toLowerCase()
    .split(",")
    .map((directive) => directive.split("=")[0]?.trim());
  const publicResponse =
    directives.includes("public") &&
    !directives.some((directive) => ["private", "no-store", "no-cache"].includes(directive ?? ""));
  return { markup, publicResponse };
};

const consumeRequest = (
  key: string,
  request: PendingRequest,
  signal: AbortSignal,
): Promise<MarkupResponse> =>
  new Promise((resolve, reject) => {
    request.consumers++;
    const release = () => {
      signal.removeEventListener("abort", abort);
      request.consumers--;
      if (request.consumers === 0 && pending.get(key) === request) {
        pending.delete(key);
        request.controller.abort();
      }
    };
    const abort = () => {
      release();
      reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    request.result.then(
      (result) => {
        if (signal.aborted) return;
        release();
        resolve(result);
      },
      (error: unknown) => {
        if (signal.aborted) return;
        release();
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });

export const resolveMarkup = async (source: string, options: ResolveOptions): Promise<string> => {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("SVG src is required.");
  if (isInlineSvg(trimmed)) return trimmed;
  const dataSvg = decodeDataUrl(trimmed);
  if (dataSvg) return dataSvg;
  if (options.signal.aborted)
    throw options.signal.reason ?? new DOMException("The operation was aborted.", "AbortError");

  const useCache = options.cache && options.fetchOptions === undefined;
  if (!useCache) return (await fetchMarkup(source, options)).markup;
  const cached = getCachedMarkup(source, options.redirect);
  if (cached !== undefined) return cached;

  const key = JSON.stringify([source, options.redirect ?? "follow"]);
  let request = pending.get(key);
  const joined = request !== undefined;
  if (!request) {
    const controller = new AbortController();
    const result = fetchMarkup(source, { ...options, signal: controller.signal });
    request = {
      controller,
      consumers: 0,
      result: result
        .then((response) => {
          if (response.publicResponse && !controller.signal.aborted && pending.get(key) === request)
            cacheMarkup(source, response.markup, options.redirect);
          return response;
        })
        .finally(() => {
          if (pending.get(key) === request) pending.delete(key);
        }),
    };
    pending.set(key, request);
  }
  const response = await consumeRequest(key, request, options.signal);
  if (joined && !response.publicResponse) return (await fetchMarkup(source, options)).markup;
  return response.markup;
};

export const resolveSource = (src: string | undefined, name: SvgNameInput | undefined) => {
  if (name) return resolveLocalSvg(name);
  return src;
};
