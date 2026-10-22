/** Local, bounded input only. Writes an audit report to stdout; never opens a database. */
import { readFileSync, statSync } from "node:fs";
import { shadowFixture } from "../server/productIdentity/fixtures";
import { runReconciledShadow } from "../server/productIdentity/shadow";
import { canonical } from "../server/productIdentity/contracts";

try {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("INPUT_REQUIRED");
  const source = args[0];
  let input: unknown;
  if (source === "--fixture") input = shadowFixture();
  else {
    if (source.startsWith("--") || statSync(source).size > 16 * 1024 * 1024) throw new Error("INPUT_INVALID");
    input = JSON.parse(readFileSync(source, "utf8"));
  }
  const report = runReconciledShadow(input);
  process.stdout.write(`${canonical(report)}\n`);
  if (report.status === "FAILED") process.exitCode = 1;
} catch {
  process.stderr.write("SHADOW_LOCAL_INPUT_FAILED: use --fixture or a local reconciled JSON array (maximum 16 MiB).\n");
  process.exitCode = 1;
}
