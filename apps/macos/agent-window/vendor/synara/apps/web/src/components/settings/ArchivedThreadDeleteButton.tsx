// FILE: ArchivedThreadDeleteButton.tsx
// Purpose: Per-row archived-thread delete with inline confirmation (RareUI DeleteButton
// interaction adapted to the flat settings design system: no dialog, no motion dep).
// Layer: Settings UI components
// Exports: ArchivedThreadDeleteButton

import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { CheckIcon, TrashCanIcon, XIcon } from "~/lib/icons";

export function ArchivedThreadDeleteButton({
  threadTitle,
  onConfirm,
  disabled: disabledProp,
}: {
  readonly threadTitle: string;
  readonly onConfirm: () => void | Promise<void>;
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const disabled = disabledProp ?? false;

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open ]);

  const cancel = () => {
    if (busy) return;
    setOpen(false);
    triggerRef.current?.focus();
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <Button
        ref={triggerRef}
        size="icon-xs"
        variant="ghost"
        aria-label={`Delete "${threadTitle}"`}
        aria-expanded={false}
        title="Delete"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <TrashCanIcon />
      </Button>
    );
  }

  return (
    <div
      data-slot="archived-thread-delete"
      data-state="open"
      className="flex items-center gap-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
    >
      <span aria-hidden className="px-0.5 text-[11px] text-muted-foreground">
        Delete?
      </span>
      <Button
        ref={confirmRef}
        size="icon-xs"
        variant="destructive"
        aria-label={`Confirm delete "${threadTitle}"`}
        title="Confirm delete"
        disabled={disabled || busy}
        onClick={() => void confirm()}
      >
        <CheckIcon />
      </Button>
      <Button
        size="icon-xs"
        variant="outline"
        aria-label="Cancel delete"
        title="Cancel"
        disabled={disabled || busy}
        onClick={cancel}
      >
        <XIcon />
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        Confirm deletion
      </span>
    </div>
  );
}
