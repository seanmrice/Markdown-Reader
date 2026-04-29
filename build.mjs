import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "dist");

await rm(distDir, { recursive: true, force: true });

const shared = {
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  sourcemap: "linked",
  logLevel: "info",
  external: ["electron", "font-list"],
};

await Promise.all([
  esbuild({
    ...shared,
    entryPoints: [path.resolve(here, "src/main.ts")],
    outfile: path.resolve(distDir, "main.cjs"),
  }),
  esbuild({
    ...shared,
    entryPoints: [path.resolve(here, "src/preload.ts")],
    outfile: path.resolve(distDir, "preload.cjs"),
  }),
]);
