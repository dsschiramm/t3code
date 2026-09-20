/**
 * Decodes the Frontend API hostname embedded in a Clerk publishable key
 * (`pk_test_<base64 hostname>$`). Only the macOS passkey signing setup in
 * build-desktop-artifact.ts still needs it.
 */
export function clerkFrontendApiHostnameFromPublishableKey(publishableKey: string): string {
  const encodedFrontendApi = publishableKey.split("_").slice(2).join("_");
  const frontendApi = globalThis.atob(encodedFrontendApi).replace(/\$$/u, "");
  if (frontendApi.length === 0 || frontendApi.includes("/")) {
    throw new Error("Invalid Clerk frontend API decoded from publishable key.");
  }
  return new URL(`https://${frontendApi}`).hostname;
}
