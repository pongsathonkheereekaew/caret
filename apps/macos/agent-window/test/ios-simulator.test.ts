import { expect, it } from "bun:test";

import type { ProcessRunResult } from "../vendor/synara/apps/server/src/processRunner";
import { IosSimulatorBackend } from "../vendor/synara/apps/server/src/device/IosSimulatorBackend";

const result = (stdout = "", code = 0): ProcessRunResult => ({
  stdout,
  stderr: "",
  code,
  signal: null,
  timedOut: false,
});

it("discovers an installed Xcode when xcode-select still points at CommandLineTools", async () => {
  const run = async (command: string, args: readonly string[]): Promise<ProcessRunResult> => {
    if (command === "xcode-select") return result("/Library/Developer/CommandLineTools\n");
    if (command === "xcodebuild") return result("Xcode 27.0\nBuild version 27A266a\n");
    if (command === "xcrun" && args[0] === "simctl" && args[1] === "list") {
      if (args[2] === "devices") {
        return result(
          JSON.stringify({
            devices: {
              "com.apple.CoreSimulator.SimRuntime.iOS-27-0": [
                {
                  udid: "SIM-1",
                  name: "iPhone 17",
                  state: "Shutdown",
                  isAvailable: true,
                },
              ],
            },
          }),
        );
      }
      if (args[2] === "devicetypes") return result(JSON.stringify({ devicetypes: [] }));
    }
    return result("", 1);
  };

  const backend = new IosSimulatorBackend({
    platform: "darwin",
    run,
    helperCacheRoot: "/tmp/cedia-test-no-device-helper-cache",
    listApplications: async () => ["Xcode.app"],
    xcodeBundleUsable: async () => true,
  });

  const availability = await backend.availability();
  expect(availability.kind).toBe("setup-required");
  if (availability.kind !== "setup-required") return;
  expect(availability.steps.slice(0, 4).every((step) => step.done)).toBe(true);
  expect(availability.steps[4]).toMatchObject({
    id: "build-device-helper",
    label: "Build the Cedia device helper",
    done: false,
  });
});
