import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const prod = process.argv.includes("production");

await rm("dist", { recursive: true, force: true });
await mkdir("dist/icons", { recursive: true });

const ctx = await esbuild.context({
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    sidebar: "src/sidebar/sidebar.ts",
    options: "src/options/options.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "firefox115",
  platform: "browser",
  sourcemap: prod ? false : "inline",
  minify: prod,
  logLevel: "info",
});

await ctx.rebuild();

// Copie des fichiers statiques dans dist/ (= extension chargeable)
await cp("manifest.json", "dist/manifest.json");
await cp("src/sidebar/sidebar.html", "dist/sidebar.html");
await cp("src/options/options.html", "dist/options.html");
await cp("styles/sidebar.css", "dist/sidebar.css");
await cp("icons", "dist/icons", { recursive: true });

if (prod) {
  await ctx.dispose();
  console.log("Build terminé → dist/");
} else {
  await ctx.watch();
  console.log("Watch actif…");
}
