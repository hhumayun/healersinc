/**
 * Post-generation fixups for orval output.
 *
 * orval emits zod v4 syntax (`zod.int()`, `zod.uuid()`), but this workspace
 * pins zod 3.25.x, which ships v4 behind the `zod/v4` subpath. Rewriting the
 * import is what lets the generated schemas compile and run unchanged.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.resolve(here, "..", "..", "api-zod", "src", "generated");

const entries = await readdir(generatedDir);
let patched = 0;

for (const entry of entries) {
  if (!entry.endsWith(".ts")) continue;

  const file = path.join(generatedDir, entry);
  const source = await readFile(file, "utf8");
  const next = source.replace(
    /(from\s+['"])zod(['"])/g,
    (_match, prefix, suffix) => `${prefix}zod/v4${suffix}`,
  );

  if (next !== source) {
    await writeFile(file, next);
    patched += 1;
  }
}

console.log(`postprocess: rewrote zod imports in ${patched} file(s)`);
