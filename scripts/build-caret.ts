import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { applyDarwinAppIcon } from "./lib/app-icon.ts";
import { personalCaretArgv } from "./lib/personal-argv.ts";

const root = resolve(import.meta.dir, "..");
/** The host's headless terminal engine (libghostty-vt). Native addon: external + shipped beside the bundle. */
const HOST_TERMINAL_ENGINE = "@coder/libghostty-vt-node";
const portable = process.argv.includes("--portable") || process.argv.includes("--package");
if (portable) execFileSync(process.execPath, [join(root, "scripts/prepare-omp-runtime.ts"), "--standalone"], { cwd: root, stdio: "inherit" });
if (process.argv.includes("--runtime")) execFileSync(process.execPath, [join(root, "scripts/prepare-omp-runtime.ts")], { cwd: root, stdio: "inherit" });
/**
 * Recompute the workbench checksums for the packaged app.
 *
 * The pinned packager writes upstream's `product.json` checksums, which do not describe the files
 * this build actually ships, so every launch raises "Your Caret installation appears to be
 * corrupt. Please reinstall." - a warning about tampering that is not true. A normal VS Code build
 * regenerates these as its last step; this reproduces that for the personal app. It runs before
 * signing, because `product.json` is inside what gets sealed.
 */
async function refreshPackagedChecksums(productJsonPath: string): Promise<void> {
  const appResources = dirname(productJsonPath);
  const product: { checksums?: Record<string, string> } = JSON.parse(await readFile(productJsonPath, "utf8"));
  const checksums = product.checksums;
  if (!checksums) return;
  let refreshed = 0;
  for (const key of Object.keys(checksums)) {
    const file = join(appResources, "out", key);
    try {
      // `ChecksumService.checksum` resolves `hash.digest('base64').replace(/=+$/, '')`, so the
      // padding has to go or every file compares as modified.
      checksums[key] = createHash("sha256").update(await readFile(file)).digest("base64").replace(/=+$/, "");
      refreshed++;
    } catch {
      // A file this build does not ship is left as it is rather than invented.
    }
  }
  await writeFile(productJsonPath, JSON.stringify(product, null, "\t") + "\n");
  console.log(`Refreshed ${refreshed} workbench checksums in ${productJsonPath}`);
}

/**
 * Stamp the packaged `product.json` with the build identity the renderer keys on.
 *
 * The workbench loads the npm packages its bundles leave external (`@xterm/xterm`,
 * `katex`, `vscode-oniguruma`, `vscode-textmate`, `jschardet`, `@vscode/iconv-lite-umd`)
 * through a runtime helper that picks the layout by build identity: a product.json with a
 * `commit` resolves `node_modules.asar`, a commit-less one resolves the plain `node_modules`
 * directory. The pinned packager writes the archive plus a plain directory that only holds
 * the files it had to duplicate (`@vscode/tree-sitter-wasm`, `zod`, ...), so a commit-less
 * packaged app misses every other runtime import. The fetch fails (`ERR_FILE_NOT_FOUND`),
 * `TerminalInstance` never gets its xterm, and the window reports "An unknown error
 * occurred" with no terminal process anywhere - which is what the Apps panel's terminal
 * shows as "terminal not working". Release Code-OSS builds always carry a commit, so
 * upstream never hits this; stamping the pinned revision restores that.
 */
async function stampPackagedIdentity(productJsonPath: string): Promise<void> {
  const product: { commit?: string; version?: string; date?: string } = JSON.parse(await readFile(productJsonPath, "utf8"));
  if (product.commit) {
    return; // A package that already carries an identity is not second-guessed.
  }
  const lock: { sources: { name?: string; revision: string }[] } = JSON.parse(await readFile(join(root, "upstream-lock.json"), "utf8"));
  const pinned = lock.sources.find(source => source.name === "caret-native")?.revision;
  const version = JSON.parse(await readFile(join(root, "desktop/package.json"), "utf8")).version;
  product.commit = pinned;
  product.version = version;
  product.date = new Date().toISOString();
  await writeFile(productJsonPath, JSON.stringify(product, null, "\t") + "\n");
  console.log(`Stamped packaged product identity: ${version}+${String(pinned).slice(0, 12)}`);
}

const dist = join(root, "dist");
await mkdir(dist, { recursive: true });
for (const [entrypoint, output] of [["apps/host/src/cli.ts", "host/cli.js"], ["apps/host/src/runtime-lock.ts", "host/runtime-lock.ts"]]) {
  // `@coder/libghostty-vt-node` is the host's headless terminal engine (libghostty-vt).
  // It carries a native addon, which cannot live inside a bundle, so it stays external
  // and the package is copied beside the bundle below.
  const result = await Bun.build({ entrypoints: [join(root, entrypoint!)], outdir: join(dist, "host"), target: "node", format: "esm", naming: output!.split("/").at(-1)!, sourcemap: "external", external: [HOST_TERMINAL_ENGINE] });
  if (!result.success) throw new AggregateError(result.logs, `Build failed: ${entrypoint}`);
}
// Ship the engine with the host: the bundle imports it at runtime, and `node-gyp-build`
// resolves the addon from the package's own prebuilds directory.
function installedPackage(name: string, from = root): string {
  // Resolve the way the runtime would: bun links a workspace dependency into the
  // workspace's node_modules and keeps transitive ones in its store layout.
  try {
    return dirname(Bun.resolveSync(`${name}/package.json`, from));
  } catch {
    throw new Error(`Host runtime dependency is missing: ${name} (run bun install)`);
  }
}
const hostEngine = installedPackage(HOST_TERMINAL_ENGINE, join(root, "apps", "host"));
const prebuild = join(hostEngine, "prebuilds", `${process.platform}-${process.arch}`);
if (!existsSync(prebuild)) throw new Error(`The host terminal engine has no prebuild for ${process.platform}-${process.arch}: ${prebuild}`);
for (const [name, from] of [[HOST_TERMINAL_ENGINE, join(root, "apps", "host")], ["node-gyp-build", hostEngine]] as const) {
  await cp(installedPackage(name, from), join(dist, "host", "node_modules", name), { recursive: true });
}
const extensionOutput = join(dist, "mac-extension");
await mkdir(extensionOutput, { recursive: true });
const extension = await Bun.build({ entrypoints: [join(root, "apps/macos/src/extension.ts")], outdir: join(extensionOutput, "out"), target: "node", format: "cjs", external: ["vscode"], naming: "extension.js", sourcemap: "external" });
if (!extension.success) throw new AggregateError(extension.logs, "Mac extension build failed");
const manifest = JSON.parse(await readFile(join(root, "apps/macos/package.json"), "utf8"));
delete manifest.type; manifest.name = "caret"; manifest.publisher = "caret";
manifest.contributes.configuration.properties["caret.hostNodePath"].default = portable ? "" : process.env.CARET_HOST_NODE ?? process.execPath;
manifest.contributes.configuration.properties["caret.hostScriptPath"].default = portable ? "" : join(dist, "host", "cli.js");
await writeFile(join(extensionOutput, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
await cp(join(root, "apps/macos/media"), join(extensionOutput, "media"), { recursive: true });
if (portable) {
  const node = process.env.CARET_HOST_NODE;
  if (!node) throw new Error("Set CARET_HOST_NODE to the Node 24 executable to bundle");
  const version = execFileSync(node, ["--version"], { encoding: "utf8" }).trim();
  if (!/^v24\./.test(version)) throw new Error("Caret host bundle requires Node 24");
  const runtime = join(extensionOutput, "runtime");
  await mkdir(join(runtime, "node/bin"), { recursive: true });
  await cp(node, join(runtime, "node/bin/node"));
  await cp(join(dirname(node), "../LICENSE"), join(runtime, "node/LICENSE"));
  await cp(join(dist, "host"), join(runtime, "host"), { recursive: true });
  await writeFile(join(runtime, "host/package.json"), JSON.stringify({ private: true, type: "module" }) + "\n");
  await mkdir(join(runtime, "omp"), { recursive: true });
  await cp(join(dist, "omp-standalone/omp"), join(runtime, "omp/omp"));
  await cp(join(root, "upstream/omp/LICENSE"), join(runtime, "omp/LICENSE"));
  // Build evidence is kept outside the runnable payload: it contains source paths.
  await cp(join(root, "docs/upstream-notices"), join(runtime, "notices"), { recursive: true });
}
// Code-OSS Electron packaging and the DMG builder both consume this icon.
const brandIcon = join(root, "assets/brand/insert-v1/caret.icns");
await mkdir(join(dist, "brand"), { recursive: true });
await cp(brandIcon, join(dist, "brand/caret.icns"));
if (process.argv.includes("--desktop")) {
  execFileSync(process.execPath, [join(root, "scripts/prepare-desktop.ts")], { cwd: root, stdio: "inherit" });
  // The retained, ignored Code-OSS checkout is a build output. Tracked source stays above.
  await cp(extensionOutput, join(root, "desktop/extensions/caret"), { recursive: true });
  await cp(brandIcon, join(root, "desktop/resources/darwin/code.icns"));
  await writeFile(join(root, "desktop/argv.json"), JSON.stringify(personalCaretArgv(), null, 2) + "\n");
  // `desktop/scripts/code.sh` launches `.build/electron/<nameShort>.app`, which
  // keeps whatever icon the last `gulp electron` run baked in. Refresh it here
  // so the dev window shows the Caret icon without a full Electron re-fetch.
  const desktopName = JSON.parse(await readFile(join(root, "desktop/product.json"), "utf8")).nameShort;
  await applyDarwinAppIcon(join(root, "desktop/.build/electron", `${desktopName}.app`), brandIcon);
}
if (process.argv.includes("--package")) {
  const app = join(root, `VSCode-darwin-${process.arch}`, "Caret.app");
  const appExtension = join(app, "Contents/Resources/app/extensions/caret");
  // This target is generated by the pinned Code-OSS packaging task.
  await readFile(join(app, "Contents/Info.plist"));
  await rm(appExtension, { recursive: true, force: true });
  await cp(extensionOutput, appExtension, { recursive: true });
  // Tree-sitter opens WASM by a real node_modules path, outside Electron ASAR
  // resolution. Reuse the exact filtered assets emitted by the pinned packager.
  const appResources = join(app, "Contents/Resources/app");
  await cp(join(appResources, "node_modules.asar.unpacked/@vscode/tree-sitter-wasm"),
    join(appResources, "node_modules/@vscode/tree-sitter-wasm"), { recursive: true });
  // Product decision 2026-09-13: single agent surface. Remove the bundled
  // Copilot Chat agent UI (ships in the `copilot` dir) so it cannot front its
  // own Sessions/Chats over the Caret shell. OMP stays the only harness.
  // `github`/`github-authentication` stay: unrelated to the agent UI.
  // Re-apply on every --package: the pinned Code-OSS packager restores it.
  await rm(join(appResources, "extensions/copilot"), { recursive: true, force: true });
  await writeFile(join(app, "Contents/Resources/app/argv.json"), JSON.stringify(personalCaretArgv(), null, 2) + "\n");
  // Before the checksum pass: it rewrites this same file, so the identity has to be
  // in place first or the next launch resolves its runtime imports from the wrong layout.
  await stampPackagedIdentity(join(appResources, "product.json"));
  await refreshPackagedChecksums(join(appResources, "product.json"));
  // The packager bakes `desktop/resources/darwin/code.icns` into the bundle, so
  // an app packaged before an icon change would keep the old artwork. Re-apply
  // the brand icon before signing; anything written after this breaks the seal.
  await applyDarwinAppIcon(app, brandIcon);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
  console.log(`Prepared local ad-hoc signed app (not notarized): ${app}`);
}
console.log(`Built Caret host and Mac extension in ${dist}`);
