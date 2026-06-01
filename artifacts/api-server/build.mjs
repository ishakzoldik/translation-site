import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

// Some CJS-only packages (e.g. express) need `require` to work inside our ESM bundle
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Packages that cannot be safely bundled — loaded dynamically from node_modules at runtime
    external: [
      "*.node",
      // PDF / document parsing — read files from their own package dirs at runtime
      "pdf-parse",
      "mammoth",
      // Pino logging — uses worker threads that must load from node_modules
      "pino",
      "pino-http",
      "pino-pretty",
      "thread-stream",
      // Native / optional extras
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "pg-native",
      "bufferutil",
      "utf-8-validate",
    ],
    sourcemap: "linked",
    // Make CJS-only packages (e.g. express) work inside our ESM output
    banner: {
      js: `import { createRequire as __crReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __crReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
