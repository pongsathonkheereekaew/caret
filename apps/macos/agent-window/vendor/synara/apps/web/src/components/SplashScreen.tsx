// FILE: SplashScreen.tsx
// Purpose: Render a neutral Cedia loading state while the app is booting a route or session.
// Layer: Shared app loading presentation

export function SplashScreen({
  errorMessage,
  onRetry,
}: {
  errorMessage?: string | null;
  onRetry?: (() => void) | null;
}) {
  const showRetry = Boolean(errorMessage && onRetry);

  return (
    <div
      role={errorMessage ? "alert" : "status"}
      aria-live={errorMessage ? "assertive" : "polite"}
      className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-5 select-none">
        {!errorMessage ? (
          <span className="text-sm text-muted-foreground">Loading Cedia…</span>
        ) : null}

        {errorMessage ? (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
            <span className="text-sm text-muted-foreground/75">{errorMessage}</span>
            {showRetry ? (
              <button
                type="button"
                className="rounded-md border border-border/70 px-3 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-[var(--sidebar-accent)]"
                onClick={onRetry ?? undefined}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
