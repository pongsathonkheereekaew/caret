// FILE: publicAssetUrl.ts
// Purpose: Resolve static assets relative to the standalone Agent Window bundle.
// Layer: web UI utility
//
// The upstream web app is normally served from `/`, while Cedia loads the
// bundle through vscode-file/file URLs. Vite's relative base is therefore part
// of the runtime contract for every asset path built in JavaScript.
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\/+/, "")}`;
}
