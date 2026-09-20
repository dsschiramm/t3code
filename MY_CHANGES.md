# Minhas alterações na dev (fork)

Registro dos commits do autor `daniel` que divergem da `main`. Consultar ao fazer merge da `main` na `dev`.

## Commits

| Hash      | Data       | Commit                                  |
| --------- | ---------- | --------------------------------------- |
| 7e26234f2 | 2026-09-08 | feat(telemetry): remove telemetry       |
| dfde2babc | 2026-09-13 | feat(remote)!: remove Tailscale support |
| 9efa889fc | 2026-09-14 | feat(github): remove github workflows   |

## O que manter removido em cada merge

- Telemetria: `apps/server/src/telemetry/AnalyticsService.ts` e usos em server, ws e testes (`analyticsService`, `client.connected`, `client.thread.started`, `client.turn.requested`).
- Tailscale: `packages/tailscale`, `scripts/lib/dev-share.ts`, flags `--tailscale`, `--tailscale-serve`, `--tailscale-serve-port`, `--share`, env `T3CODE_TAILSCALE_SERVE`, config `tailscaleServeEnabled` e `tailscaleServePort`.
- GitHub: `.github/workflows/*`, `.github/scripts/*`, `.github/VOUCHED.td`.

## Regras de merge

- Arquivos `.md` e docs: usar a versão da `main`.
- Conflitos em arquivos removidos (modify/delete): manter removido.
- `pnpm-lock.yaml`: sem o importer `packages/tailscale`.

## Histórico de merges da main

- 2026-09-20: merge de `main` (7445aa733) na `dev`.
