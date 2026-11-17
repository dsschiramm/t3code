// Fork helper: `node scripts/merge-main.mjs [ref]` merges `main` into the current branch without
// committing, then drops every path the fork keeps removed (see MY_CHANGES.md), takes the fork's
// lockfile, and lists what still needs a human. Finish with `pnpm install --no-frozen-lockfile`.
import * as NodeChildProcess from "node:child_process";

const REMOVED = [
  ".agents/",
  ".claude/",
  ".cursor/",
  ".devcontainer/",
  ".github/",
  ".repos/",
  "infra/relay/",
  "packages/tailscale/",
  "patches/@clerk",
  "patches/@alchemy",
  "patches/alchemy@",
  "scripts/lib/dev-share.ts",
  "apps/server/src/relay/",
  "apps/server/src/cli/connect",
  "apps/web/src/cloud/",
  "apps/web/src/components/clerk/",
  "apps/web/src/components/cloud/",
  "apps/mobile/src/features/cloud/",
  "apps/mobile/src/features/agent-awareness/",
  "packages/client-runtime/src/relay/",
  "docs/user/telemetry.md",
  "docs/user/t3-connect-troubleshooting.md",
];
const REMOVED_FILES = [
  /^apps\/server\/src\/cloud\/(?!(bootService|npmRelease|pinnedRuntime|selfUpdate|serviceLauncherClient|servicePreflight|serviceProtection|serviceProtocol|serviceSelectionLock)\b)/,
  /^apps\/server\/src\/telemetry\/(?!ProviderUsageAnalytics\.ts$)/,
  /^packages\/(shared\/src\/(relay(?!Signing)|agentAwareness|connectAuth)|contracts\/src\/relay)/,
];

const git = (...args) =>
  NodeChildProcess.execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
const removed = (file) =>
  REMOVED.some((p) => file.startsWith(p)) || REMOVED_FILES.some((r) => r.test(file));

NodeChildProcess.spawnSync("git", ["merge", "--no-commit", process.argv[2] ?? "main"], {
  stdio: "inherit",
});

const status = git("status", "--porcelain", "-z", "--untracked-files=no")
  .split("\0")
  .filter((entry) => entry.length > 3);
const drop = status.map((entry) => entry.slice(3)).filter(removed);
for (let i = 0; i < drop.length; i += 200) {
  NodeChildProcess.spawnSync(
    "git",
    ["rm", "-rf", "--quiet", "--ignore-unmatch", "--", ...drop.slice(i, i + 200)],
    {
      stdio: "ignore",
    },
  );
}
console.log(`dropped ${drop.length} paths the fork keeps removed`);

if (status.some((entry) => entry.slice(3) === "pnpm-lock.yaml" && /^(UU|AA)/.test(entry))) {
  git("checkout", "--ours", "--", "pnpm-lock.yaml");
  git("add", "pnpm-lock.yaml");
  console.log("kept the fork's pnpm-lock.yaml; run `pnpm install --no-frozen-lockfile`");
}

const left = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
console.log(`${left.length} unmerged files:`);
for (const file of left) console.log(`  ${file}`);
