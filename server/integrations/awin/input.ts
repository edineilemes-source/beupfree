import { createReadStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { createGunzip } from "node:zlib";

export type FeedDownloadOptions = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number };
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 250 * 1024 * 1024;

export function sanitizeFeedLocation(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname ? "/[redacted]" : ""}`;
  } catch {
    return "[local-feed]";
  }
}

function byteLimiter(maxBytes: number) {
  let bytes = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > maxBytes ? new Error(`Feed excede o limite de ${maxBytes} bytes`) : null, chunk);
    },
  });
}

export function openGzipFile(path: string, maxBytes = DEFAULT_MAX_BYTES): Readable {
  return createReadStream(path).pipe(byteLimiter(maxBytes)).pipe(createGunzip()).pipe(byteLimiter(maxBytes));
}

export async function downloadGzipFeed(urlValue: string, options: FeedDownloadOptions = {}): Promise<Readable> {
  const initial = new URL(urlValue);
  if (!['http:', 'https:'].includes(initial.protocol)) throw new Error("Feed Awin deve usar HTTP ou HTTPS");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? 2;
  let current = initial;

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(current, { redirect: "manual", signal: controller.signal, headers: { Accept: "text/csv,application/gzip,application/octet-stream" } });
    } catch (error) {
      throw new Error(`Falha ao baixar feed Awin de ${sanitizeFeedLocation(urlValue)}: ${error instanceof Error && error.name === "AbortError" ? "timeout" : "erro de rede"}`);
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === maxRedirects) throw new Error(`Redirect inválido ao baixar feed Awin (${response.status})`);
      const next = new URL(location, current);
      if (next.protocol !== current.protocol || next.hostname !== current.hostname) throw new Error("Redirect do feed Awin para origem diferente foi recusado");
      current = next;
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`Resposta inválida do feed Awin (HTTP ${response.status})`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`Feed excede o limite de ${maxBytes} bytes`);
    return Readable.fromWeb(response.body as never).pipe(byteLimiter(maxBytes)).pipe(createGunzip()).pipe(byteLimiter(maxBytes));
  }
  throw new Error("Limite de redirects do feed Awin excedido");
}
