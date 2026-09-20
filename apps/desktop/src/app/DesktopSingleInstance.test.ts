import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronWindow from "../electron/ElectronWindow.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import * as DesktopSingleInstance from "./DesktopSingleInstance.ts";

const makeLayer = (options: { readonly hasLock: boolean; readonly events: string[] }) => {
  const environment = DesktopEnvironment.DesktopEnvironment.of({
    stateDir: "/tmp/t3-state",
    isDevelopment: true,
    appDataDirectory: "/tmp/app-data",
    userDataDirName: "t3code-dev",
    legacyUserDataDirName: "T3 Code (Dev)",
    path: { join: (...parts: ReadonlyArray<string>) => parts.join("/") },
  } as unknown as DesktopEnvironment.DesktopEnvironment["Service"]);

  const electronApp = {
    setPath: (name: string, value: string) =>
      Effect.sync(() => {
        options.events.push(`setPath:${name}:${value}`);
      }),
    requestSingleInstanceLock: Effect.sync(() => {
      options.events.push("requestSingleInstanceLock");
      return options.hasLock;
    }),
    quit: Effect.sync(() => {
      options.events.push("quit");
    }),
    on: (eventName: string) =>
      Effect.sync(() => {
        options.events.push(`on:${eventName}`);
      }),
  } as unknown as ElectronApp.ElectronApp["Service"];

  return DesktopSingleInstance.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(DesktopEnvironment.DesktopEnvironment, environment),
        Layer.succeed(ElectronApp.ElectronApp, electronApp),
        FileSystem.layerNoop({ exists: () => Effect.succeed(false) }),
      ),
    ),
  );
};

const run = (options: { readonly hasLock: boolean; readonly events: string[] }) =>
  Effect.gen(function* () {
    const singleInstance = yield* DesktopSingleInstance.DesktopSingleInstance;
    return yield* Effect.exit(Effect.scoped(singleInstance.configure));
  }).pipe(
    Effect.provide(makeLayer(options)),
    Effect.provideService(ElectronApp.ElectronApp, {
      quit: Effect.sync(() => {
        options.events.push("quit");
      }),
      on: (eventName: string) =>
        Effect.sync(() => {
          options.events.push(`on:${eventName}`);
        }),
    } as unknown as ElectronApp.ElectronApp["Service"]),
    Effect.provideService(
      ElectronWindow.ElectronWindow,
      {} as ElectronWindow.ElectronWindow["Service"],
    ),
  );

describe("DesktopSingleInstance", () => {
  it.effect("sets userData before acquiring the single-instance lock", () => {
    const events: string[] = [];
    return Effect.gen(function* () {
      yield* run({ hasLock: true, events });
      assert.deepEqual(events.slice(0, 2), [
        "setPath:userData:/tmp/app-data/t3code-dev",
        "requestSingleInstanceLock",
      ]);
    });
  });

  it.effect("registers the second-instance handler in the primary instance", () => {
    const events: string[] = [];
    return Effect.gen(function* () {
      const exit = yield* run({ hasLock: true, events });
      assert.isTrue(Exit.isSuccess(exit));
      assert.isFalse(events.includes("quit"));
      assert.isTrue(events.includes("on:second-instance"));
    });
  });

  it.effect("quits and interrupts startup in a secondary instance", () => {
    const events: string[] = [];
    return Effect.gen(function* () {
      const exit = yield* run({ hasLock: false, events });
      assert.isTrue(Exit.hasInterrupts(exit));
      assert.isTrue(events.includes("quit"));
      assert.isFalse(events.includes("on:second-instance"));
    });
  });
});
