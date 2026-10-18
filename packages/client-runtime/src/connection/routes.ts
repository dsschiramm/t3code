import {
  isLocalLoopbackHost,
  isPrivateNetworkHost,
  isSharedAddressSpaceHost,
  isTailnetHost,
} from "@t3tools/shared/hostClassification";
import type { DesktopSshEnvironmentTarget } from "@t3tools/contracts";
import * as Option from "effect/Option";

import {
  BearerConnectionProfile,
  type ConnectionCatalogEntry,
  type ConnectionRoute,
} from "./catalog.ts";
import { BearerConnectionTarget, type ConnectionTarget } from "./model.ts";

/**
 * A saved environment can hold several routes: direct URLs (LAN, tailnet,
 * other VPNs, public) and SSH. The client connects over the first route in
 * preference order that answers as the expected environment, and moves back
 * to a better one when it becomes reachable again.
 */

export type ConnectionRouteKind = "loopback" | "lan" | "tailnet" | "vpn" | "public" | "ssh";

export function connectionRouteId(target: ConnectionTarget): string {
  switch (target._tag) {
    case "PrimaryConnectionTarget":
      return "primary";
    case "BearerConnectionTarget":
    case "SshConnectionTarget":
      return target.connectionId;
  }
}

export function connectionRoutes(entry: ConnectionCatalogEntry): ReadonlyArray<ConnectionRoute> {
  return [{ target: entry.target, profile: entry.profile }, ...(entry.alternateRoutes ?? [])];
}

export function entryWithRoutes(
  entry: ConnectionCatalogEntry,
  routes: ReadonlyArray<ConnectionRoute>,
): ConnectionCatalogEntry {
  const [first, ...rest] = routes;
  if (first === undefined) {
    throw new Error("A saved environment needs at least one route.");
  }
  const { alternateRoutes: _previous, ...base } = entry;
  return {
    ...base,
    target: first.target,
    profile: first.profile,
    ...(rest.length === 0 ? {} : { alternateRoutes: rest }),
  };
}

export function routeEntry(
  entry: ConnectionCatalogEntry,
  route: ConnectionRoute,
): ConnectionCatalogEntry {
  return entryWithRoutes(entry, [route]);
}

/** The base URL of a direct route, or null for SSH. */
export function routeHttpBaseUrl(route: ConnectionRoute): string | null {
  if (route.target._tag === "PrimaryConnectionTarget") return route.target.httpBaseUrl;
  const profile = Option.getOrNull(route.profile);
  return profile?._tag === "BearerConnectionProfile" ? profile.httpBaseUrl : null;
}

function routeHostname(route: ConnectionRoute): string | null {
  const httpBaseUrl = routeHttpBaseUrl(route);
  if (httpBaseUrl === null) return null;
  try {
    return new URL(httpBaseUrl).hostname;
  } catch {
    return null;
  }
}

export function connectionRouteKind(route: ConnectionRoute): ConnectionRouteKind {
  switch (route.target._tag) {
    case "SshConnectionTarget":
      return "ssh";
    case "PrimaryConnectionTarget":
    case "BearerConnectionTarget": {
      const hostname = routeHostname(route);
      if (hostname === null) return "public";
      if (isLocalLoopbackHost(hostname)) return "loopback";
      if (isTailnetHost(hostname)) return "tailnet";
      if (isSharedAddressSpaceHost(hostname)) return "vpn";
      return isPrivateNetworkHost(hostname) ? "lan" : "public";
    }
  }
}

const ROUTE_KIND_RANK: Record<ConnectionRouteKind, number> = {
  loopback: 0,
  lan: 1,
  tailnet: 2,
  vpn: 2,
  public: 3,
  ssh: 4,
};

/**
 * Where a newly added route goes: after every saved route of the same or a
 * faster kind, so LAN lands ahead of tailnet.
 * Users can reorder afterwards; this only picks a sensible starting point.
 */
export function insertRoute(
  routes: ReadonlyArray<ConnectionRoute>,
  route: ConnectionRoute,
): ReadonlyArray<ConnectionRoute> {
  const rank = ROUTE_KIND_RANK[connectionRouteKind(route)];
  const index = routes.findIndex(
    (existing) => ROUTE_KIND_RANK[connectionRouteKind(existing)] > rank,
  );
  return index === -1
    ? [...routes, route]
    : [...routes.slice(0, index), route, ...routes.slice(index)];
}

export function upsertRoute(
  routes: ReadonlyArray<ConnectionRoute>,
  route: ConnectionRoute,
): ReadonlyArray<ConnectionRoute> {
  const id = connectionRouteId(route.target);
  return routes.some((existing) => connectionRouteId(existing.target) === id)
    ? routes.map((existing) => (connectionRouteId(existing.target) === id ? route : existing))
    : insertRoute(routes, route);
}

export function findRouteToSameAddress(
  routes: ReadonlyArray<ConnectionRoute>,
  route: ConnectionRoute,
): ConnectionRoute | undefined {
  const key = routeAddressKey(route);
  return key === null ? undefined : routes.find((existing) => routeAddressKey(existing) === key);
}

function routeAddressKey(route: ConnectionRoute): string | null {
  const profile = Option.getOrNull(route.profile);
  switch (profile?._tag) {
    case "BearerConnectionProfile":
      return `bearer:${profile.httpBaseUrl.replace(/\/+$/, "")}`;
    case "SshConnectionProfile":
      return `ssh:${sshTargetKey(profile.target)}`;
    default:
      return null;
  }
}

/** Short user-facing route description: "LAN", "Tailscale", "VPN", a URL, or an SSH host. */
export function connectionRouteLabel(route: ConnectionRoute): string {
  switch (connectionRouteKind(route)) {
    case "loopback":
      return "This device";
    case "lan":
      return "LAN";
    case "tailnet":
      return "Tailscale";
    case "vpn":
      return "VPN";
    case "ssh": {
      const profile = Option.getOrNull(route.profile);
      return profile?._tag === "SshConnectionProfile"
        ? `SSH ${profile.target.username ? `${profile.target.username}@` : ""}${profile.target.hostname}`
        : "SSH";
    }
    case "public":
      return routeHostname(route) ?? "Remote link";
  }
}

/** The address shown under a route, or null when it has none. */
export function connectionRouteAddress(route: ConnectionRoute): string | null {
  if (route.target._tag === "SshConnectionTarget") {
    const profile = Option.getOrNull(route.profile);
    return profile?._tag === "SshConnectionProfile" ? profile.target.alias : null;
  }
  return routeHttpBaseUrl(route);
}

/**
 * The routes after the server reports where it listens. Each newly reported
 * address becomes a learned route that authenticates the same way as the route
 * in use: the paired token of the bearer route. A learned route the server still reports keeps its place, so the
 * user's order holds; one it no longer reports is dropped, so a changed LAN
 * address replaces the old one. Routes the user saved are never touched, and
 * an address already saved is not learned twice.
 */
export function mergeLearnedRoutes(input: {
  readonly entry: ConnectionCatalogEntry;
  readonly activeRoute: ConnectionRoute;
  readonly reported: ReadonlyArray<ReportedEndpoint>;
  /** Plain HTTP routes are unusable from an HTTPS page (mixed content). */
  readonly allowInsecure: boolean;
}): ReadonlyArray<ConnectionRoute> | null {
  const { entry } = input;
  const active = input.activeRoute.target;
  const saved = connectionRoutes(entry);
  // The primary and SSH routes have no credential a learned route could reuse.
  if (active._tag !== "BearerConnectionTarget") return null;
  // A route learned over another learned route inherits the paired token it borrows.
  const sharedCredential = credentialConnectionId(active.connectionId);

  // Usable reported addresses, by origin.
  const reported = new Map<string, URL>();
  const tailscaleOrigins = new Set<string>();
  for (const endpoint of input.reported) {
    let url: URL;
    try {
      url = new URL(endpoint.httpBaseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (url.protocol === "http:" && !input.allowInsecure) continue;
    // A loopback address names whichever device opens it, never the server.
    if (isLocalLoopbackHost(url.hostname)) continue;
    reported.set(url.origin, url);
    if (endpoint.kind === "tailnet") tailscaleOrigins.add(url.origin);
  }
  const normalized = (url: string) => url.replace(/\/+$/, "");
  const known = new Set(
    saved.flatMap((route) => {
      const url = routeHttpBaseUrl(route);
      return url === null || isLearned(route) ? [] : [normalized(url)];
    }),
  );
  const kept = saved.filter((route) => {
    if (!isLearned(route)) return true;
    const url = routeHttpBaseUrl(route);
    if (url === null || !reported.has(normalized(url)) || known.has(normalized(url))) return false;
    if (sendsTokenInClear(saved, route, tailscaleOrigins.has(normalized(url)))) return false;
    known.add(normalized(url));
    return true;
  });
  let next: ReadonlyArray<ConnectionRoute> = kept;
  for (const url of reported.values()) {
    if (known.has(url.origin)) continue;
    if (
      url.protocol === "http:" &&
      sharedCredential !== undefined &&
      !tailscaleOrigins.has(url.origin) &&
      !tokenAllowsPlainHttp(saved, sharedCredential)
    ) {
      continue;
    }
    const httpBaseUrl = `${url.origin}/`;
    const connectionId = learnedConnectionId(
      entry.target.environmentId,
      url.origin,
      sharedCredential,
    );
    next = insertRoute(next, {
      target: new BearerConnectionTarget({
        environmentId: entry.target.environmentId,
        label: entry.target.label,
        connectionId,
      }),
      profile: Option.some(
        new BearerConnectionProfile({
          connectionId,
          environmentId: entry.target.environmentId,
          label: entry.target.label,
          httpBaseUrl,
          wsBaseUrl: `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/`,
          learned: true,
        }),
      ),
    });
  }
  const signature = (routes: ReadonlyArray<ConnectionRoute>) =>
    routes
      .map(
        (route) =>
          `${connectionRouteId(route.target)} ${routeHttpBaseUrl(route) ?? ""} ${connectionRouteKind(route)}`,
      )
      .join("\n");
  return signature(saved) === signature(next) ? null : next;
}

// A paired token goes to a plain HTTP address outside the tailnet only when
// it was paired that way, so a token paired over HTTPS, loopback, or the
// tailnet keeps to the transports it was issued for.
function tokenAllowsPlainHttp(
  routes: ReadonlyArray<ConnectionRoute>,
  credentialId: string,
): boolean {
  const credentialRoute = routes.find((route) => connectionRouteId(route.target) === credentialId);
  return (
    credentialRoute !== undefined &&
    routeHttpBaseUrl(credentialRoute)?.startsWith("http:") === true &&
    (connectionRouteKind(credentialRoute) === "lan" ||
      connectionRouteKind(credentialRoute) === "public")
  );
}

/**
 * Whether connecting over `route` would send a paired token over plain HTTP
 * that it wasn't paired over. Checked against the token the route borrows,
 * so a route learned before this rule existed is refused too.
 */
export function sendsTokenInClear(
  routes: ReadonlyArray<ConnectionRoute>,
  route: ConnectionRoute,
  tailscale?: boolean,
): boolean {
  const profile = Option.getOrNull(route.profile);
  if (profile?._tag !== "BearerConnectionProfile") return false;
  if (
    (tailscale ?? connectionRouteKind(route) === "tailnet") ||
    !profile.httpBaseUrl.startsWith("http:")
  ) {
    return false;
  }
  const credentialId = credentialConnectionId(connectionRouteId(route.target));
  return (
    credentialId !== connectionRouteId(route.target) && !tokenAllowsPlainHttp(routes, credentialId)
  );
}

/** Routes a connect may use: none sends a paired token over plain HTTP it wasn't paired over. */
export function usableRoutes(entry: ConnectionCatalogEntry): ReadonlyArray<ConnectionRoute> {
  const routes = connectionRoutes(entry);
  return routes.filter((route) => !sendsTokenInClear(routes, route));
}

export interface ReportedEndpoint {
  readonly httpBaseUrl: string;
  readonly kind?: string;
}

/**
 * A learned bearer route borrows the credential of the route it was learned
 * from, so its id points back at that credential's owner.
 */
function learnedConnectionId(
  environmentId: string,
  origin: string,
  sharedCredential: string,
): string {
  return `learned:${environmentId}:${origin}@${sharedCredential}`;
}

export function credentialConnectionId(connectionId: string): string {
  const at = connectionId.indexOf("@");
  return connectionId.startsWith("learned:") && at !== -1
    ? connectionId.slice(at + 1)
    : connectionId;
}

export function isLearned(route: ConnectionRoute): boolean {
  const profile = Option.getOrNull(route.profile);
  return profile?._tag === "BearerConnectionProfile" && profile.learned === true;
}

/**
 * Routes left after the user removes one. A learned route borrows the
 * credential of the route it was learned over, so it cannot outlive that
 * route: removing a paired address removes routes that borrow its token.
 */
export function routesAfterRemoving(
  routes: ReadonlyArray<ConnectionRoute>,
  removedId: string,
): ReadonlyArray<ConnectionRoute> {
  const removed = routes.find((route) => connectionRouteId(route.target) === removedId);
  if (removed === undefined) return routes;
  return routes.filter((route) => {
    if (route === removed) return false;
    if (!isLearned(route)) return true;
    return credentialConnectionId(connectionRouteId(route.target)) !== removedId;
  });
}

/** One SSH target, as desktop keys its tunnels: alias, host, user, and port. */
export function sshTargetKey(target: DesktopSshEnvironmentTarget): string {
  return JSON.stringify([target.alias, target.hostname, target.username, target.port]);
}
