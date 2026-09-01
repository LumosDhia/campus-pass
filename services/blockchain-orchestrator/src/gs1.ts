const RESOLVER_DOMAIN = process.env.RESOLVER_DOMAIN ?? "https://id-hub.io";

/** Canonical GS1 Digital Link URI for one item, per HLD §5 step 1: `/01/GTIN/21/SERIAL`. */
export function buildGs1DigitalLinkUri(gtin: string, serial: string): string {
  return `${RESOLVER_DOMAIN}/01/${encodeURIComponent(gtin)}/21/${encodeURIComponent(serial)}`;
}
