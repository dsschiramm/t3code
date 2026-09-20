# Minhas alterações na dev (fork)

Registro dos commits do autor `daniel` que divergem da `main`. Consultar ao fazer merge da `main` na `dev`.

## Commits

| Hash      | Data       | Commit                                                          |
| --------- | ---------- | --------------------------------------------------------------- |
| 7e26234f2 | 2026-09-08 | feat(telemetry): remove telemetry                               |
| dfde2babc | 2026-09-13 | feat(remote)!: remove Tailscale support                         |
| 9efa889fc | 2026-09-14 | feat(github): remove github workflows                           |
| cd0d161d9 | 2026-09-20 | refactor(connect)!: remove T3 Connect from server and contracts |

## O que manter removido em cada merge

- Telemetria: `apps/server/src/telemetry/AnalyticsService.ts` e usos em server, ws e testes (`analyticsService`, `client.connected`, `client.thread.started`, `client.turn.requested`).
- Tailscale: `packages/tailscale`, `scripts/lib/dev-share.ts`, flags `--tailscale`, `--tailscale-serve`, `--tailscale-serve-port`, `--share`, env `T3CODE_TAILSCALE_SERVE`, config `tailscaleServeEnabled` e `tailscaleServePort`.
- GitHub: `.github/workflows/*`, `.github/scripts/*`, `.github/VOUCHED.td`.
- T3 Connect (parcial, ver pendências):
  - Server: `cli/connect.ts`, `relay/AgentAwarenessRelay.ts`, em `apps/server/src/cloud/` os arquivos `CliState`, `CliTokenManager`, `ManagedEndpointRuntime`, `cliAuthHtml`, `config`, `environmentKeys`, `http`, `publicConfig`, `relayResponse`, `relayTracing`, `traceRelayRequest`.
  - Contracts: `relay.ts`, `relayClient.ts`, export `@t3tools/contracts/relay`, grupo HTTP `connect`, RPCs `cloud.getRelayClientStatus` e `cloud.installRelayClient`, capability `agentActivityPublishing`, campo `relayManaged`.
  - Mantidos de propósito: `bootService`, `pinnedRuntime`, `selfUpdate`, `serviceLauncherClient`, `servicePreflight`, `serviceProtocol` (usados por `t3 service`, `update`, `uninstall`), scopes `relay:read` e `relay:write`, `shared/relaySigning` (usado pelo `GrokAdapter`).

## Pendências da remoção do T3 Connect

Ainda referenciam o código removido e não compilam: `infra/relay`, `packages/shared` (relay*, connectAuth, agentAwareness), `packages/client-runtime` (relay/, driver relay), `apps/web` (cloud/, components/clerk, components/cloud, routes/connect, state/relay), `apps/desktop` (DesktopClerk), `apps/mobile` (features/cloud, agent-awareness, state/relay). Também `pnpm-workspace.yaml`, `knip.jsonc`, `t3.json`, `.env.example`, `scripts/lib/reference-repos.ts`, `scripts/release-smoke.ts` e dependências Clerk nos `package.json`.

## Regras de merge

- Arquivos `.md` e docs: usar a versão da `main`.
- Conflitos em arquivos removidos (modify/delete): manter removido.
- `pnpm-lock.yaml`: sem o importer `packages/tailscale`.

## Histórico de merges da main

- 2026-09-20: merge de `main` (7445aa733) na `dev`.
