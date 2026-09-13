import { isParserQuery } from "../../../../../packages/protocol/src/terminal-queries.js";
import { XTERM_CSS, XTERM_JS } from "./xterm-bundle.ts";

export { isParserQuery } from "../../../../../packages/protocol/src/terminal-queries.js";

export interface TerminalDocumentOptions {
  readonly terminalId: string;
  readonly cols: number;
  readonly rows: number;
  readonly title?: string;
}

const MAX_IO_BYTES = 64 * 1024;

function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * A self-contained xterm.js document. It is used by WKWebView/Android
 * WebView and by the web iframe, so both clients execute the same terminal
 * emulator and ANSI parser with no CDN or runtime network request.
 */
export function terminalDocument(options: TerminalDocumentOptions): string {
  const config = json({ terminalId: options.terminalId, cols: options.cols, rows: options.rows, title: options.title ?? "Terminal" });
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
${XTERM_CSS}
html,body,#caret-terminal{width:100%;height:100%;margin:0;overflow:hidden;background:#10131b;color:#f4f6fb}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
#caret-terminal{padding:10px;box-sizing:border-box}
.xterm-viewport{overflow-y:auto!important}
</style></head><body><div id="caret-terminal" role="application" aria-label="${options.title ? options.title.replace(/[&<>"']/g, "") : "Terminal"}" tabindex="0"></div>
<script>${XTERM_JS}</script>
<script>(function(){
"use strict";
var config=${config};
var maxBytes=${MAX_IO_BYTES};
var terminal=null;
var lastSequence=-1;
var replaying=false;
var replayEndRequested=false;
var replayWrites=0;
function bytes(value){try{return new TextEncoder().encode(value).length}catch(_){return value.length}}
function post(message){
  var text=JSON.stringify({source:"caret-terminal",payload:message});
  try{if(window.ReactNativeWebView&&typeof window.ReactNativeWebView.postMessage==="function"){window.ReactNativeWebView.postMessage(text);return}}catch(_){}
  try{if(window.parent&&window.parent!==window){window.parent.postMessage(text,"*")}}catch(_){}
}
function safeMessage(event){
  var value=event&&event.data;
  if(typeof value!=="string") return null;
  try{value=JSON.parse(value)}catch(_){return null}
  if(value&&value.source==="caret-terminal") value=value.payload;
  return value&&typeof value.type==="string"?value:null;
}
${String(isParserQuery.toString()).replace(/^export\\s+/, "")}
function installParserGuards(){
  var parser=terminal&&terminal.parser;
  if(!parser)return;
  if(typeof parser.registerCsiHandler==="function"){
    parser.registerCsiHandler({final:"c"},function(params){return isParserQuery("csi",params,undefined,"c")});
    parser.registerCsiHandler({prefix:">",final:"c"},function(params){return isParserQuery("csi",params,">","c")});
    parser.registerCsiHandler({final:"n"},function(params){return isParserQuery("csi",params,undefined,"n")});
    parser.registerCsiHandler({prefix:"?",final:"n"},function(params){return isParserQuery("csi",params,"?","n")});
    parser.registerCsiHandler({final:"t"},function(params){return isParserQuery("csi",params,undefined,"t")});
    parser.registerCsiHandler({intermediates:"$",final:"p"},function(params){return isParserQuery("csi",params,undefined,"p")});
    parser.registerCsiHandler({prefix:"?",intermediates:"$",final:"p"},function(params){return isParserQuery("csi",params,"?","p")});
  }
  if(typeof parser.registerDcsHandler==="function"){
    parser.registerDcsHandler({intermediates:"$",final:"q"},function(data){return isParserQuery("dcs",data,"$","q")});
  }
  if(typeof parser.registerOscHandler==="function"){
    parser.registerOscHandler(4,function(data){return isParserQuery("osc",data,"4")});
    parser.registerOscHandler(10,function(data){return isParserQuery("osc",data,"10")});
    parser.registerOscHandler(11,function(data){return isParserQuery("osc",data,"11")});
    parser.registerOscHandler(12,function(data){return isParserQuery("osc",data,"12")});
  }
}
function finishReplay(){
  if(!replayEndRequested||replayWrites!==0)return;
  // xterm drains parser work asynchronously. Keep onData suppressed for one
  // task after the final write so a device-status response cannot become a
  // durable shell input command.
  setTimeout(function(){if(replayEndRequested&&replayWrites===0)replaying=false},0);
}
function writeOutput(sequence,data){
  if(!terminal||typeof sequence!=="number"||!Number.isSafeInteger(sequence)||sequence<=lastSequence||typeof data!=="string"||bytes(data)>maxBytes)return;
  lastSequence=sequence;
  if(!replaying){terminal.write(data);return}
  replayWrites++;
  try{terminal.write(data,function(){replayWrites=Math.max(0,replayWrites-1);finishReplay()})}catch(_){replayWrites=Math.max(0,replayWrites-1);finishReplay()}
}
function beginReplay(cols,rows,historyTruncated,recovery){
  replaying=true;replayEndRequested=false;replayWrites=0;
  try{terminal.reset()}catch(_){}
  lastSequence=-1;
  if(Number.isSafeInteger(cols)&&Number.isSafeInteger(rows))try{terminal.resize(cols,rows)}catch(_){}
  if(historyTruncated){
    // The host keeps a bounded chunk history. Once its prefix is gone, replay
    // cannot reconstruct an ANSI emulator state, so reset explicitly and only
    // continue with live output instead of presenting a false reconstruction.
    try{terminal.write(recovery ? "\\r\\n\\u001b[2m[terminal screen restoring…]\\u001b[0m\\r\\n" : "\\r\\n\\u001b[2m[terminal history expired; live output follows]\\u001b[0m\\r\\n")}catch(_){}
  }
}
function endReplay(){replayEndRequested=true;finishReplay()}
function replay(outputs,cols,rows,historyTruncated,recovery){
  if(!terminal||!Array.isArray(outputs))return;
  beginReplay(cols,rows,historyTruncated,recovery);
  for(var i=0;i<outputs.length;i++){var item=outputs[i];if(item&&typeof item.sequence==="number")writeOutput(item.sequence,item.data)}
  endReplay();
}
function receive(event){
  var message=safeMessage(event);if(!message||!terminal)return;
  if(message.type==="replay_start"){
    beginReplay(message.cols,message.rows,message.historyTruncated===true,message.recovery===true);
    return;
  }
  if(message.type==="replay_end"){
    endReplay();
    return;
  }
  if(message.type==="replay"){replay(message.outputs,message.cols,message.rows,message.historyTruncated===true,message.recovery===true);return}
  if(message.type==="output"){writeOutput(message.sequence,message.data);return}
  if(message.type==="resize"&&Number.isSafeInteger(message.cols)&&Number.isSafeInteger(message.rows))try{terminal.resize(message.cols,message.rows)}catch(_){}
  if(message.type==="focus")terminal.focus();
}
window.addEventListener("message",receive);
try{
  terminal=new globalThis.Terminal({cols:config.cols,rows:config.rows,scrollback:2000,cursorBlink:true,convertEol:false,allowProposedApi:false,theme:{background:"#10131b",foreground:"#f4f6fb",cursor:"#9a8cff",selectionBackground:"#3e386e",black:"#10131b",red:"#f17c89",green:"#60d3a5",yellow:"#e7b36d",blue:"#8c9eff",magenta:"#d7a6ff",cyan:"#65d6e8",white:"#f4f6fb",brightBlack:"#6f7890",brightRed:"#ff9aa6",brightGreen:"#83e4bd",brightYellow:"#f2c98f",brightBlue:"#aeb8ff",brightMagenta:"#e7c4ff",brightCyan:"#9be8f2",brightWhite:"#ffffff"}});
  terminal.open(document.getElementById("caret-terminal"));
  installParserGuards();
  terminal.onData(function(data){if(replaying)return;if(typeof data==="string"&&data.length&&bytes(data)<=maxBytes)post({type:"input",terminalId:config.terminalId,data:data})});
  post({type:"ready",terminalId:config.terminalId});
}catch(error){post({type:"error",terminalId:config.terminalId,message:String(error&&error.message||error)})}
})();</script></body></html>`;
}

export function terminalMessage(value: unknown): { type: string; [key: string]: unknown } | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const payload = record.source === "caret-terminal" ? record.payload : parsed;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const message = payload as Record<string, unknown>;
    return typeof message.type === "string" ? message as { type: string; [key: string]: unknown } : null;
  } catch {
    return null;
  }
}
