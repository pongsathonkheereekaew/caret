import type { ContextMenuItem } from "@synara/contracts";

export type CediaContextMenuPresenter = <T extends string>(
	items: readonly ContextMenuItem<T>[],
	position?: { x: number; y: number },
) => Promise<T | null>;

function showCediaContextMenu<T extends string>(
	items: readonly ContextMenuItem<T>[],
	position?: { x: number; y: number },
): Promise<T | null> {
	return new Promise((resolve) => {
		if (typeof document === "undefined") {
			resolve(null);
			return;
		}
		const overlay = document.createElement("div");
		overlay.style.cssText = "position:fixed;inset:0;z-index:9999";
		const menu = document.createElement("div");
		menu.className = "fixed z-[10000] min-w-[180px] rounded-xl border border-white/[0.08] shadow-xl animate-in fade-in zoom-in-95";
		menu.style.top = `${position?.y ?? 0}px`;
		menu.style.left = `${position?.x ?? 0}px`;
		menu.style.backgroundColor = "color-mix(in srgb, var(--popover) 90%, transparent)";
		menu.style.backdropFilter = "blur(24px)";
		const inner = document.createElement("div");
		inner.className = "p-1";
		menu.appendChild(inner);
		const buttons: HTMLButtonElement[] = [];
		let focused = -1;
		const close = (value: T | null) => {
			document.removeEventListener("keydown", onKeyDown);
			overlay.remove();
			menu.remove();
			resolve(value);
		};
		const focus = (index: number) => {
			if (index < 0 || index >= buttons.length) return;
			buttons[focused]?.classList.remove("bg-[var(--sidebar-accent)]");
			focused = index;
			buttons[focused]?.classList.add("bg-[var(--sidebar-accent)]");
			buttons[focused]?.focus();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") { event.preventDefault(); close(null); }
			else if (event.key === "ArrowDown") { event.preventDefault(); focus(focused < buttons.length - 1 ? focused + 1 : 0); }
			else if (event.key === "ArrowUp") { event.preventDefault(); focus(focused > 0 ? focused - 1 : buttons.length - 1); }
			else if (event.key === "Enter" && focused >= 0) { event.preventDefault(); close(items[focused]!.id); }
		};
		overlay.addEventListener("mousedown", () => close(null));
		document.addEventListener("keydown", onKeyDown);
		items.forEach((item, index) => {
			const desktopItem = item as ContextMenuItem<T> & { iconDataUrl?: string };
			const destructive = item.destructive === true || item.id === "delete";
			if ((item.separatorBefore === true || destructive) && index > 0) {
				const separator = document.createElement("div");
				separator.className = "mx-2.5 my-1 h-px bg-border";
				inner.appendChild(separator);
			}
			const button = document.createElement("button");
			button.type = "button";
			button.className = "flex w-full min-h-7 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[length:var(--app-font-size-ui,12px)] text-foreground/86 transition-colors";
			if (desktopItem.iconDataUrl) {
				const image = document.createElement("img");
				image.src = desktopItem.iconDataUrl;
				image.alt = "";
				image.className = "size-4 shrink-0 opacity-70";
				button.appendChild(image);
			} else if (item.icon) {
				const icon = document.createElement("span");
				icon.textContent = "•";
				icon.className = "size-4 shrink-0 text-center opacity-70";
				button.appendChild(icon);
			}
			const label = document.createElement("span");
			label.textContent = item.label;
			button.appendChild(label);
			button.addEventListener("click", () => close(item.id));
			button.addEventListener("mouseenter", () => focus(index));
			button.addEventListener("mouseleave", () => { button.classList.remove("bg-[var(--sidebar-accent)]"); focused = -1; });
			buttons.push(button);
			inner.appendChild(button);
		});
		document.body.append(overlay, menu);
		requestAnimationFrame(() => {
			const rect = menu.getBoundingClientRect();
			if (rect.right > window.innerWidth) menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
			if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
		});
	});
}

/** Keep the native bridge on Synara's tested DOM menu when no macOS menu host is available. */
export function createCediaContextMenuPresenter(
	presenter: CediaContextMenuPresenter = showCediaContextMenu,
): CediaContextMenuPresenter {
	return async <T extends string>(items: readonly ContextMenuItem<T>[], position?: { x: number; y: number }) =>
		await presenter(items, position);
}
