/**
 * Parser-side terminal query detection.
 *
 * These sequences make xterm emit a reply. Consume them on the inbound parser
 * (or strip them from bytes written into a host emulator) so a user key such as
 * modified F3 (`CSI 1;2R`) is never mistaken for a cursor-position report.
 * This file is plain JavaScript so Function#toString can be embedded in the
 * mobile xterm document as the single implementation.
 */

export function isParserQuery(kind, paramsOrData, prefix, final) {
  if (kind === "osc") {
    const data = typeof paramsOrData === "string" ? paramsOrData : String(paramsOrData ?? "");
    if (prefix === "4") {
      const slots = data.split(";");
      for (let i = 0; i + 1 < slots.length; i += 2) {
        if (/^\d+$/.test(slots[i]) && slots[i + 1] === "?") return true;
      }
      return false;
    }
    return data.split(";").includes("?");
  }
  if (kind === "dcs") return true;
  const params = Array.isArray(paramsOrData) ? paramsOrData : [];
  const first = params[0];
  const value = typeof first === "number" ? first : undefined;
  if (final === "c" && (prefix === undefined || prefix === ">" || prefix === "")) return value === undefined || value === 0;
  if (final === "n") return prefix === "?" ? value === 6 : value === 5 || value === 6;
  if (final === "t") return value === 14 || value === 16 || value === 18;
  if (final === "p") return true;
  return false;
}

function sevenBitIntroducer(data) {
  if (typeof data !== "string" || data.length === 0) return data;
  const code = data.charCodeAt(0);
  if (code === 0x9b) return "\x1b[" + data.slice(1);
  if (code === 0x9d) return "\x1b]" + data.slice(1);
  if (code === 0x90) return "\x1bP" + data.slice(1);
  return data;
}

/** VS Code PTY replies that are not also user keys. Must not match modified F3. */
export function isSyntheticTerminalReply(data) {
  if (typeof data !== "string" || data.length === 0) return false;
  const value = sevenBitIntroducer(data);
  if (/^\x1b\[[?>]?[0-9;]*[cnyt]$/.test(value)) return true;
  if (/^\x1b\](?:4|10|11|12);/.test(value)) return true;
  if (/^\x1bP\$q/.test(value)) return true;
  // Cursor-position reports share CSI-R with modified F3 (`CSI 1;2-8 R`).
  if (/^\x1b\[[0-9]+;[0-9]+R$/.test(value) && !/^\x1b\[1;[2-8]R$/.test(value)) return true;
  return false;
}

function csiParams(raw) {
  if (!raw) return [];
  return raw.split(";").map((part) => (part === "" ? undefined : Number(part)));
}

const MAX_QUERY_CARRY = 4096;
const ST = /\x07|\x1b\\|\x9c/;

function sequenceKind(data, index) {
  const code = data.charCodeAt(index);
  if (code === 0x9b) return { kind: "csi", body: index + 1 };
  if (code === 0x9d) return { kind: "osc", body: index + 1 };
  if (code === 0x90) return { kind: "dcs", body: index + 1 };
  if (code !== 0x1b) return undefined;
  if (index + 1 >= data.length) return { incomplete: true };
  const next = data.charCodeAt(index + 1);
  if (next === 0x5b) return { kind: "csi", body: index + 2 };
  if (next === 0x5d) return { kind: "osc", body: index + 2 };
  if (next === 0x50) return { kind: "dcs", body: index + 2 };
  return undefined;
}

function consumeTerminated(data, body, terminator) {
  const rest = data.slice(body);
  const match = rest.match(terminator);
  if (!match || match.index === undefined) return { incomplete: true };
  return { end: body + match.index + match[0].length, payload: rest.slice(0, match.index) };
}

/**
 * Remove inbound query sequences before they reach a host emulator. Holds a
 * bounded incomplete introducer across chunks (C1 or 7-bit). This is not
 * scrollback restoration.
 */
export function takeTerminalParserQueries(data, carry) {
  const held = typeof carry === "string" ? (carry.length > MAX_QUERY_CARRY ? carry.slice(-MAX_QUERY_CARRY) : carry) : "";
  const incoming = typeof data === "string" ? data : "";
  const source = held + incoming;
  let output = "";
  let index = 0;
  while (index < source.length) {
    const intro = sequenceKind(source, index);
    if (!intro) {
      output += source[index];
      index += 1;
      continue;
    }
    if (intro.incomplete) {
      const rest = source.slice(index);
      if (rest.length > MAX_QUERY_CARRY) {
        output += source[index];
        index += 1;
        continue;
      }
      return { text: output, carry: rest };
    }
    if (intro.kind === "osc") {
      const terminated = consumeTerminated(source, intro.body, ST);
      if (terminated.incomplete) {
        const rest = source.slice(index);
        if (rest.length > MAX_QUERY_CARRY) {
          output += source[index];
          index += 1;
          continue;
        }
        return { text: output, carry: rest };
      }
      const payload = terminated.payload;
      const identMatch = payload.match(/^(4|10|11|12);([\s\S]*)$/);
      if (identMatch && isParserQuery("osc", identMatch[2], identMatch[1])) {
        index = terminated.end;
        continue;
      }
      output += source.slice(index, terminated.end);
      index = terminated.end;
      continue;
    }
    if (intro.kind === "dcs") {
      const terminated = consumeTerminated(source, intro.body, ST);
      if (terminated.incomplete) {
        const rest = source.slice(index);
        if (rest.length > MAX_QUERY_CARRY) {
          output += source[index];
          index += 1;
          continue;
        }
        return { text: output, carry: rest };
      }
      if (terminated.payload.startsWith("$q") && isParserQuery("dcs", terminated.payload.slice(2), "$", "q")) {
        index = terminated.end;
        continue;
      }
      output += source.slice(index, terminated.end);
      index = terminated.end;
      continue;
    }
    const rest = source.slice(intro.body);
    const decrqm = rest.match(/^([?]?)([0-9;]*)\$p/);
    if (decrqm) {
      index = intro.body + decrqm[0].length;
      continue;
    }
    const csi = rest.match(/^([?>]?)([0-9;]*)([A-Za-z])/);
    if (!csi) {
      if (/^[?>0-9;$]*$/.test(rest) && rest.length <= MAX_QUERY_CARRY) return { text: output, carry: source.slice(index) };
      output += source[index];
      index += 1;
      continue;
    }
    const prefixChar = csi[1] || undefined;
    const params = csiParams(csi[2]);
    if (isParserQuery("csi", params, prefixChar, csi[3])) {
      index = intro.body + csi[0].length;
      continue;
    }
    output += source.slice(index, intro.body + csi[0].length);
    index = intro.body + csi[0].length;
  }
  return { text: output, carry: "" };
}

export function stripTerminalParserQueries(data, carry) {
  return takeTerminalParserQueries(data, carry).text;
}
