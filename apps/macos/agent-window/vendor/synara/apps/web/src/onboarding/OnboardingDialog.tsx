// FILE: OnboardingDialog.tsx
// Purpose: First-run welcome tour: intro → feature tour → project → done (OMP is the only harness, appearance follows the IDE theme).
//          Owns step navigation and the per-run results the final summary reads.
// Layer: Web UI overlay (mounted once from the root route)
//
// The popup is an 800×540 frame on wide screens so the window never resizes as the
// user moves through the tour; below the md breakpoint the steps stack and the body
// scrolls (the IDE dock is narrow). Hero steps center via child auto-margins, which stay
// reachable when the stacked content overflows.

import { useEffect, useState } from "react";

import { APP_BASE_NAME } from "~/branding";
import { SynaraLogo } from "~/components/SynaraLogo";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { CheckIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { ONBOARDING_INSET_CLASS_NAME } from "./layout";
import {
  isOnboardingSetupStep,
  nextOnboardingStep,
  ONBOARDING_STEPS,
  previousOnboardingStep,
  type OnboardingStep,
} from "./logic";
import { useOnboardingDialogStore } from "./onboardingDialogStore";
import { OnboardingStepFooter } from "./OnboardingStepFooter";
import { DoneStep } from "./steps/DoneStep";
import { FeatureTourStep } from "./steps/FeatureTourStep";
import { ProjectStep, type OnboardingProjectResult } from "./steps/ProjectStep";
import { WelcomeStep } from "./steps/WelcomeStep";

const STEP_TITLES: Record<OnboardingStep, string> = {
  welcome: `Welcome to ${APP_BASE_NAME}`,
  tour: `What ${APP_BASE_NAME} can do`,
  project: "Add your first project",
  done: "You're all set",
};

const STEP_DESCRIPTIONS: Record<Exclude<OnboardingStep, "done">, string> = {
  welcome: "A local-first workspace for coding agents. Setup takes about a minute.",
  tour: "",
  project: `A project is a folder ${APP_BASE_NAME} works in. Git repositories unlock branches, worktrees, diffs and pull requests.`,
};

/** Welcome and Done are hero steps: centered header, no step counter, centered body. */
function isHeroStep(step: OnboardingStep): boolean {
  return step === "welcome" || step === "done";
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function OnboardingFlow(props: {
  onComplete: () => void;
  projectBusy: boolean;
  onProjectBusyChange: (busy: boolean) => void;
}) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [projectResults, setProjectResults] = useState<ReadonlyArray<OnboardingProjectResult>>([]);

  const goBack = () => setStep(previousOnboardingStep(step));
  const goNext = () => setStep(nextOnboardingStep(step));

  // Once the user reaches a setup step the first-run gate must not auto-close the dialog.
  const markEngaged = useOnboardingDialogStore((store) => store.markEngaged);
  useEffect(() => {
    if (isOnboardingSetupStep(step)) markEngaged();
  }, [markEngaged, step]);

  const doneSummary =
    projectResults.length > 0
      ? `${plural(projectResults.length, "project")} added`
      : "No project yet";

  const description = step === "done" ? doneSummary : STEP_DESCRIPTIONS[step];
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const hero = isHeroStep(step);

  const primaryAction = (() => {
    switch (step) {
      case "welcome":
        return { label: "Get started", onPrimary: goNext };
      case "tour":
        return { label: "Set up", onPrimary: goNext };
      case "project":
        return projectResults.length > 0
          ? { label: "Continue", onPrimary: goNext }
          : { label: "Skip for now", onPrimary: goNext };
      case "done":
        return { label: `Start using ${APP_BASE_NAME}`, onPrimary: props.onComplete };
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col outline-none" tabIndex={-1}>
      <DialogHeader
        className={cn(
          "gap-1.5 pt-8 pb-0",
          ONBOARDING_INSET_CLASS_NAME,
          hero && "items-center text-center",
        )}
      >
        {step === "welcome" ? <SynaraLogo aria-hidden className="mb-3.5 size-11" /> : null}
        {step === "done" ? (
          <span
            aria-hidden
            className="mb-3.5 flex size-11 items-center justify-center rounded-full bg-success/8 text-success dark:bg-success/16"
          >
            <CheckIcon className="size-5" />
          </span>
        ) : null}
        {hero ? null : (
          <span className="text-[length:var(--app-font-size-ui-sm,11px)] font-medium tracking-[0.04em] text-muted-foreground/70 uppercase">
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </span>
        )}
        <DialogTitle className="text-[22px] tracking-[-0.01em]">{STEP_TITLES[step]}</DialogTitle>
        {description ? (
          <DialogDescription className="max-w-[560px] text-[length:var(--app-font-size-ui-lg,13px)] leading-normal">
            {description}
          </DialogDescription>
        ) : null}
      </DialogHeader>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto pt-6",
          ONBOARDING_INSET_CLASS_NAME,
          hero && "pb-6 [&>*]:my-auto",
        )}
      >
        {step === "welcome" ? <WelcomeStep /> : null}
        {step === "tour" ? <FeatureTourStep /> : null}
        {step === "project" ? (
          <ProjectStep
            results={projectResults}
            onBusyChange={props.onProjectBusyChange}
            onResult={(result) =>
              setProjectResults((current) =>
                current.some((entry) => entry.projectId === result.projectId)
                  ? current
                  : [...current, result],
              )
            }
          />
        ) : null}
        {step === "done" ? <DoneStep /> : null}
      </div>
      <OnboardingStepFooter
        step={step}
        onBack={goBack}
        onSkip={props.onComplete}
        primaryLabel={primaryAction.label}
        onPrimary={primaryAction.onPrimary}
        primaryBusy={step === "project" && props.projectBusy}
        navigationLocked={props.projectBusy}
      />
    </div>
  );
}

export function OnboardingDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  // Project creation cannot be aborted: closing the tour mid-create would report a skip
  // while a project still appears afterwards, so dismissal waits for it to settle.
  const [projectBusy, setProjectBusy] = useState(false);
  const handleOpenChange = (open: boolean) => {
    if (!open && projectBusy) return;
    props.onOpenChange(open);
  };
  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogPopup showCloseButton className="h-[540px] max-h-full max-w-[800px]">
        {/* Remount per open so a replay from Settings starts at the first step. */}
        {props.open ? (
          <OnboardingFlow
            onComplete={props.onComplete}
            projectBusy={projectBusy}
            onProjectBusyChange={setProjectBusy}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
