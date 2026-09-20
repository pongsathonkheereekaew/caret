# Virtual iPhone as the iOS dev loop (evaluated 2026-09-18)

Question: can [`Lakr233/vphone-cli`](https://github.com/Lakr233/vphone-cli) stand in for a physical
iPhone in §10 items 23, 27, 30, 39 and 41?

Source: the repository itself (MIT, 13.8k stars, last push 2026-09-17), read 2026-09-18. Facts below
are the project's own.

## What it is

Boots a **virtual iPhone** through Apple's Virtualization.framework using Apple's PCC research VM
infrastructure: a real iPhone IPSW merged with a cloudOS IPSW, DFU-restored and patched, then booted
as a guest. Tested bases run from iOS 18.6.2 to 27.0 on Apple-silicon Macs.

- Variants `less`/`regular`/`dev`/`jb`/`exp`; `jb` installs a full jailbreak (Sileo, TrollStore) on
  first boot, and the running VM takes `.ipa`/`.tipa` from its Install menu.
- Reaches the guest over SSH (port 22222) and VNC (5901).
- Exposes a **host control socket** (`<bundle>/vphone.sock`) for screenshots, touch, swipes,
  hardware keys and clipboard, each returning an inline screenshot "for AI-driven E2E testing"; a
  community MCP server wraps it.
- State lives under `~/.vphone/` (VMs, IPSW cache, tools, debs, venv).

## What it would give Caret

The engineering half of every mobile item that is currently blocked on hardware: install the Caret
iOS build into the guest, drive and screenshot its UI from the host, verify the WebView terminal
renderer (item 30), pair and drive the relay from a second device identity, and watch a reconnect
after a host restart (item 39). It is real iOS userland, so app-level behaviour is genuinely
exercised, unlike a simulator, and the control socket is exactly the harness the desktop receipts
already use.

## What it cannot give Caret

- **No cellular radio.** The guest's network is virtualised (NAT/bridged through the host), so item
  23's stated closure — "a receipt from a real iPhone on cellular" — cannot be produced here, and
  neither can anything about radio transitions, carrier state or the network-pressure behaviours a
  physical device shows.
- It needs a host-level security change that only the machine's owner can make, in Recovery mode:
  either `csrutil disable` + `csrutil allow-research-guests enable` + the
  `amfi_get_out_of_my_way=1` boot-arg, or `csrutil enable --without debug` +
  `csrutil allow-research-guests enable` + `vphone-amfidont`.
- It is heavy and sharp-edged: multi-gigabyte iPhone and cloudOS IPSW downloads, a DFU restore and
  CFW install (known `ldid-procursus` hang, iOS 18 `EXC_GUARD` re-patch, region choice during
  setup), and it cannot run on a host that is itself a VM.

## Decision recorded

Use it as the **iOS development and E2E loop** — it removes the "no device" blocker for iterating on
items 23/27/30/39/41 — but it does **not** replace the physical-device clause those items state. Two
honest ways forward, and the choice belongs to the user:

1. keep the clause and use the VM for everything except the final receipt, which still needs a real
   iPhone on cellular; or
2. deliberately relax the clause to "real iOS on a virtual device", recorded as a deviation in §5
   with the reason (no cellular radio exists in a VM), the way §5 already records the other
   deliberate departures.

The first step is the Recovery-mode SIP/AMFI change, which the machine's owner has to perform; the
guest itself and everything after it can be driven from here.

## Host readiness (measured 2026-09-18)

| Check | Measured | Verdict |
|---|---|---|
| macOS / arch | 26.6.2 (25G83), arm64, Apple M3 | in the project's tested table (Mac16,6 hosts with 26.6.x bases) |
| Not a nested VM | `kern.hv_vmm_present = 0` | pass (PV=3 guests cannot boot under a VMM) |
| Homebrew | 7.0.4 at `/opt/homebrew` | pass |
| Xcode + iOS SDK | only Command Line Tools (`xcode-select` -> `/Library/Developer/CommandLineTools`, `xcodebuild` missing) | **blocked**: the guest daemon is cross-compiled with the iOS SDK |
| SIP / AMFI | `csrutil status` = enabled | **blocked**: the Recovery-mode relaxation has not been applied |
| Free disk | 38 GB | **tight**: the pipeline caches a multi-GB iPhone IPSW and a cloudOS IPSW, stages a CFW install, and keeps a VM bundle; Xcode adds several more GB |
