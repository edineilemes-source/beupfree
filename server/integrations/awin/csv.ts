import { Readable } from "node:stream";

export class AwinCsvError extends Error {}

/** RFC 4180-style streaming CSV reader, including quoted commas/newlines. */
export async function* parseCsvRows(input: Readable): AsyncGenerator<string[]> {
  input.setEncoding("utf8");
  let field = "";
  let row: string[] = [];
  let quoted = false;
  let pendingQuote = false;
  let pendingCr = false;
  let firstChunk = true;

  const pushRow = () => {
    row.push(field);
    const completed = row;
    row = [];
    field = "";
    return completed;
  };

  for await (const rawChunk of input) {
    let chunk = String(rawChunk);
    if (firstChunk) {
      chunk = chunk.replace(/^\uFEFF/, "");
      firstChunk = false;
    }
    for (let index = 0; index < chunk.length; index++) {
      const char = chunk[index];
      if (pendingCr) {
        pendingCr = false;
        if (char === "\n") continue;
      }
      if (quoted) {
        if (pendingQuote) {
          if (char === '"') {
            field += '"';
            pendingQuote = false;
            continue;
          }
          quoted = false;
          pendingQuote = false;
        } else if (char === '"') {
          pendingQuote = true;
          continue;
        } else {
          field += char;
          continue;
        }
      }
      if (char === '"' && field.length === 0) quoted = true;
      else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        yield pushRow();
        pendingCr = char === "\r";
      } else if (char !== '"' || field.length > 0) field += char;
    }
  }

  if (quoted && !pendingQuote) throw new AwinCsvError("CSV terminou dentro de um campo entre aspas");
  if (field.length || row.length) yield pushRow();
}

export async function* parseAwinCsv(input: Readable) {
  let headers: string[] | null = null;
  let rowNumber = 0;
  for await (const values of parseCsvRows(input)) {
    rowNumber++;
    if (!headers) {
      headers = values.map((value) => value.trim());
      if (!headers.length || headers.some((value) => !value)) throw new AwinCsvError("Header CSV vazio ou inválido");
      if (new Set(headers).size !== headers.length) throw new AwinCsvError("Header CSV contém colunas duplicadas");
      continue;
    }
    if (values.length === 1 && values[0] === "") continue;
    const raw: Record<string, string> = {};
    for (let index = 0; index < headers.length; index++) raw[headers[index]] = values[index] ?? "";
    yield { raw, rowNumber };
  }
  if (!headers) throw new AwinCsvError("CSV vazio");
}

