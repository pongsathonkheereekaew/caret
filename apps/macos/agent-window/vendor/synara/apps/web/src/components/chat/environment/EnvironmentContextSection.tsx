import { useState } from "react";
import type { Thread } from "~/types";
import { AddPlusIcon, BotIcon, FileIcon, LinkIcon } from "~/lib/icons";
import { EnvironmentLabeledSection, EnvironmentRow } from "./EnvironmentRow";

export interface EnvironmentContextProps {
  messages: Thread["messages"];
  activities: Thread["activities"];
  onOpenUrl: (url: string) => void;
  onAddSource: (source: string) => void;
  onJumpToMessage: (id: Thread["messages"][number]["id"]) => void;
}

function toolStatus(payload: Thread["activities"][number]["payload"]): string {
  if (!payload || typeof payload !== "object" || !("cediaToolStatus" in payload)) return "";
  return typeof payload.cediaToolStatus === "string" ? payload.cediaToolStatus : "";
}

export function EnvironmentContextSection({ messages, activities, onOpenUrl, onAddSource, onJumpToMessage }: EnvironmentContextProps) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState("");
  const sources = new Map<string, { label: string; open: () => void; file: boolean }>();
  for (const message of messages) {
    for (const attachment of message.attachments ?? []) {
      if (attachment.type === "assistant-selection") continue;
      sources.set(attachment.id, { label: attachment.name, file: true, open: () => onJumpToMessage(message.id) });
    }
    if (message.role !== "user") continue;
    for (const line of message.text.split("\n")) {
      const path = /^Source:\s+((?:\/|~\/|\.\.?\/).+)$/.exec(line)?.[1];
      if (path) sources.set(path, { label: path, file: true, open: () => onJumpToMessage(message.id) });
    }
    for (const match of message.text.matchAll(/https?:\/\/[^\s<>"\]\)]+/g)) {
      try {
        const url = new URL(match[0]);
        if (url.username || url.password) continue;
        sources.set(url.href, { label: url.host + url.pathname, file: false, open: () => onOpenUrl(url.href) });
      } catch { /* Only actual web URLs are sources. */ }
    }
  }
  const agents = activities.filter(activity => /^(task|subagent|spawn_agent|delegate)$/i.test(activity.kind));
  const rows = [...sources.entries()];
  return <>
    <EnvironmentLabeledSection label="Subagents">
      {agents.length ? agents.map(agent => <EnvironmentRow key={agent.id} icon={<BotIcon className="size-4" />} label={<span className="truncate" title={agent.summary}>{agent.summary}</span>} trailing={<span className="text-xs text-muted-foreground">{toolStatus(agent.payload)}</span>} />) : <p className="px-2 py-1 text-xs text-muted-foreground">No subagents in this task</p>}
    </EnvironmentLabeledSection>
    <EnvironmentLabeledSection label={<span className="flex items-center justify-between">Sources<button type="button" aria-label="Add source" className="rounded p-1 hover:bg-muted" onClick={() => setAdding(value => !value)}><AddPlusIcon className="size-4" /></button></span>}>
      {adding ? <form className="flex gap-1 px-2" onSubmit={event => { event.preventDefault(); if (!source.trim()) return; onAddSource(source.trim()); setSource(""); setAdding(false); }}>
        <input aria-label="Source URL or file path" placeholder="URL or file path" className="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 text-xs" value={source} onChange={event => setSource(event.target.value)} />
        <button type="submit" className="rounded border px-2 text-xs">Add</button>
      </form> : null}
      {(expanded ? rows : rows.slice(0, 3)).map(([id, item]) => <EnvironmentRow key={id} icon={item.file ? <FileIcon className="size-4" /> : <LinkIcon className="size-4" />} label={<span className="truncate" title={item.label}>{item.label}</span>} onClick={item.open} />)}
      {!rows.length ? <p className="px-2 py-1 text-xs text-muted-foreground">Sources added to messages appear here</p> : null}
      {rows.length > 3 ? <EnvironmentRow icon={<LinkIcon className="size-4" />} label={expanded ? "Show less" : `View all (${rows.length})`} onClick={() => setExpanded(value => !value)} /> : null}
    </EnvironmentLabeledSection>
  </>;
}
