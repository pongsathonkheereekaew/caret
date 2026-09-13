/**
 * Keep the terminal document self-contained for native WebView and the web
 * iframe.  The generated module is checked into the mobile package by the
 * release build so terminal rendering never depends on a CDN or network.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(here);
const xtermRoot = join(packageRoot, "node_modules", "@xterm", "xterm");
const output = join(packageRoot, "src", "components", "terminal", "xterm-bundle.ts");

const javascript = readFileSync(join(xtermRoot, "lib", "xterm.js"), "utf8");
const stylesheet = readFileSync(join(xtermRoot, "css", "xterm.css"), "utf8");

writeFileSync(output, `// Generated from @xterm/xterm 6.0.0. Do not edit by hand.\nexport const XTERM_JS = ${JSON.stringify(javascript)};\nexport const XTERM_CSS = ${JSON.stringify(stylesheet)};\n`);
