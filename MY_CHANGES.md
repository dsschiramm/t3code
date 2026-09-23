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

Ao fazer merge da main: manter esses itens removidos.

- Telemetria: `apps/server/src/telemetry/AnalyticsService.ts` e usos em server, ws e testes (`analyticsService`, `client.connected`, `client.thread.started`, `client.turn.requested`).
- Tailscale: `packages/tailscale`, `scripts/lib/dev-share.ts`, flags `--tailscale`, `--tailscale-serve`, `--tailscale-serve-port`, `--share`, env `T3CODE_TAILSCALE_SERVE`, config `tailscaleServeEnabled` e `tailscaleServePort`.
- GitHub: `.github/workflows/*`, `.github/scripts/*`, `.github/VOUCHED.td`.
- T3 Connect (parcial, ver pendências):
  - Server: `cli/connect.ts`, `relay/AgentAwarenessRelay.ts`, em `apps/server/src/cloud/` os arquivos `CliState`, `CliTokenManager`, `ManagedEndpointRuntime`, `cliAuthHtml`, `config`, `environmentKeys`, `http`, `publicConfig`, `relayResponse`, `relayTracing`, `traceRelayRequest`.
  - Contracts: `relay.ts`, `relayClient.ts`, export `@t3tools/contracts/relay`, grupo HTTP `connect`, RPCs `cloud.getRelayClientStatus` e `cloud.installRelayClient`, capability `agentActivityPublishing`, campo `relayManaged`.
  - Mantidos de propósito: `bootService`, `pinnedRuntime`, `selfUpdate`, `serviceLauncherClient`, `servicePreflight`, `serviceProtocol` (usados por `t3 service`, `update`, `uninstall`), scopes `relay:read` e `relay:write`, `shared/relaySigning` (usado pelo `GrokAdapter`).
- Removidos: `infra/relay`, `packages/shared` (relay*, connectAuth, agentAwareness, relayTracing), `client-runtime` (relay/, alvo Relay, DPoP), web (`cloud/`, `components/clerk`, `components/cloud`, rota `/connect`), desktop (`DesktopClerk`, trocado por `DesktopSingleInstance`), mobile (`features/cloud`, `features/agent-awareness`, telas de conta e notificações), dependências Clerk e `jose`.
- Mantido: `shared/relaySigning` (usado pelo `GrokAdapter`), scopes `relay:read` e `relay:write`, subsistema de assinatura de passkey do macOS em `scripts/build-desktop-artifact.ts` (só ativa com `T3CODE_APPLE_TEAM_ID`), docs.
- Padrões recorrentes a observar em merges futuros (a main continua adicionando features em cima dessas áreas):
  - Mobile: qualquer tela/import novo ligado a Clerk/T3 Connect (ex. `SettingsAuthRouteScreen`) — remover.
  - `SettingsEnvironmentsRouteScreen.tsx` / `ConnectionEnvironmentRow.tsx`: partes de cloud/relay (`splitEnvironmentSections`, `environmentSections.ts`, campo `isRelayManaged`, `CloudEnvironmentRows`) — remover; manter features novas que sejam só locais (ex. navegação para `SettingsEnvironmentDetailRouteScreen`).
  - `WelcomeWizard.tsx`: `ConnectAccountOption` / `cloudEnabled` — remover.
  - `SettingsSidebarNav.tsx`: `T3ConnectSidebarSignIn` — remover.
  - `ConnectionsSettings.tsx`: diálogos/lógica de Tailscale HTTPS (`shouldShowEndpointUrl`, `disableTailscaleServeDialogOpen`, etc.) — remover; texto que cita "T3 Connect ou Tailscale HTTPS" como exemplo de túnel — simplificar.
  - `apps/server/src/cli/pair.ts`: imports de `@t3tools/tailscale` — remover (manter outros imports não relacionados que estejam no mesmo bloco, ex. `DEFAULT_SIGNAL_EXPORT`).
  - Showcase mobile (App Store screenshots): a cena `agent-activity` (`stageShowcaseAgentActivity.ts`, `showcaseAgentActivity.ts`, wiring em `ShowcaseCaptureCoordinator.tsx`/`nativeShowcaseScene.ts`/`scripts/mobile-showcase*.ts`) depende do stack de push notification do `agent-awareness` removido — remover a cena inteira (arquivos, entrada em `SHOWCASE_SCENES`, helpers de lock-screen/AXe no script).
  - `pnpm-lock.yaml`: resolver como `--ours`, depois rodar `pnpm install --no-frozen-lockfile` (ou `npx pnpm@<versão do packageManager> install --no-frozen-lockfile` se o binário local do pnpm estiver corrompido) para regenerar contra os `package.json`/`pnpm-workspace.yaml` já mesclados.

## Regras de merge

- Arquivos `.md` e docs: usar a versão da `main`.
- Conflitos em arquivos removidos (modify/delete): manter removido.
- `pnpm-lock.yaml`: sem o importer `packages/tailscale`.

## Histórico de merges da main

- 2026-09-20: merge de `main` (7445aa733) na `dev`.
- 2026-09-23: merge de `main` (68fb7f4b8) na `dev`.
