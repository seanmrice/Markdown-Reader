import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, readFile } from "node:fs/promises";
import { build as esbuild } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "dist");

await rm(distDir, { recursive: true, force: true });

const isProd = process.env.NODE_ENV === "production";

const envVars = {};
try {
  const envContent = await readFile(path.resolve(here, ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
  }
} catch {}

const shared = {
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  sourcemap: isProd ? false : "linked",
  logLevel: "info",
  external: ["electron", "electron-updater", "font-list"],
};

await Promise.all([
  esbuild({
    ...shared,
    entryPoints: [path.resolve(here, "src/main.ts")],
    outfile: path.resolve(distDir, "main.cjs"),
    define: {
      __POSTHOG_API_KEY__: JSON.stringify(envVars.POSTHOG_API_KEY ?? ""),
      __POSTHOG_HOST__: JSON.stringify(envVars.POSTHOG_HOST ?? ""),
    },
  }),
  esbuild({
    ...shared,
    entryPoints: [path.resolve(here, "src/preload.ts")],
    outfile: path.resolve(distDir, "preload.cjs"),
  }),
]);
