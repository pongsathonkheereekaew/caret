/** Local browser fixture for the real bundled xterm renderer. No host or model access. */
import { terminalDocument } from "../apps/ios/src/components/terminal/document.ts";
const page = `<!doctype html><html><head><meta charset="utf-8"><title>Caret terminal browser fixture</title></head><body>
<h1>Caret terminal browser fixture</h1><p>No host connection or model calls.</p>
<button id="replay">Replay initial screen</button><button id="live">Append live output</button><button id="queries">Send status queries</button>
<iframe title="Caret terminal" id="terminal" src="/terminal" sandbox="allow-scripts" style="display:block;width:850px;height:400px;border:1px solid #999"></iframe>
<h2>Renderer messages</h2><pre id="messages"></pre>
<script>
let sequence=0;
const frame=document.getElementById('terminal'), messages=document.getElementById('messages');
function send(payload){frame.contentWindow.postMessage(JSON.stringify({source:'caret-terminal',payload}),'*')}
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;try{const value=JSON.parse(event.data);messages.textContent+=JSON.stringify(value.payload)+'\\n'}catch{}});
document.getElementById('replay').onclick=()=>{sequence=0;send({type:'replay_start',cols:80,rows:20,historyTruncated:false});send({type:'output',sequence:sequence++,data:'Initial screen\\r\\n'});send({type:'replay_end'})};
document.getElementById('live').onclick=()=>send({type:'output',sequence:sequence++,data:'Live output continues\\r\\n'});
document.getElementById('queries').onclick=()=>send({type:'output',sequence:sequence++,data:'\\x1b[6n\\x1b[c\\x1b[>c\\x1b[?6n\\x1b[?25$p\\x1b]10;?\\x07\\x1b]10;?;?\\x07\\x1b]4;0;?\\x07'});
</script></body></html>`;
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  return new Response(new URL(request.url).pathname === "/terminal" ? terminalDocument({terminalId:"browser-fixture",cols:80,rows:20,title:"Caret terminal fixture"}) : page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}});
console.log(`Caret terminal browser fixture: http://127.0.0.1:${server.port}`);
process.once("SIGTERM", () => { server.stop(true); process.exitCode = 0; });
