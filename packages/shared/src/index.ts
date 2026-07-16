/** GS1 product/item identity, as encoded in the NFC/QR Digital Link URI. */
export interface Gs1Identity {
  gtin: string;
  serial: string;
}

/** Auth-service-issued JWT payload (RS256), per HLD §4.1 / §5. */
export interface HubJwtClaims {
  sub: string; // wallet address or pseudonymized subject id
  gtin: string;
  serial: string;
  role: string;
  course_permissions: string[];
  iss: string;
  aud: string;
}

/** Ethical/social value data point shown on the public DPP portal. */
export interface EthicalClaim {
  label: string;
  value: string;
  unit?: string;
}

/** Extended JSON-LD context so the non-schema.org passport terms expand to real IRIs. */
export const CAMPUS_PASS_JSONLD_CONTEXT = [
  "https://schema.org",
  {
    "@version": 1.1,
    schema: "https://schema.org/",
    gs1: "https://gs1.org/voc/",
    cp: "https://campus-pass.local/vocab#",
    serial: "schema:serialNumber",
    origin: "cp:origin",
    warrantyStatus: "cp:warrantyStatus",
    ingredients: { "@id": "gs1:ingredientStatement" },
    supplyChain: {
      "@id": "cp:supplyChain",
      "@container": "@list",
      "@context": { step: "cp:step", location: "cp:location", date: "cp:date" },
    },
    ethicalClaims: {
      "@id": "cp:ethicalClaim",
      "@container": "@list",
      "@context": { label: "cp:label", value: "cp:value", unit: "schema:unitText" },
    },
    assembly: {
      "@id": "cp:assembly",
      "@context": {
        instructionsUrl: { "@id": "cp:assemblyInstructions", "@type": "@id" },
        recyclingInfoUrl: { "@id": "cp:recyclingInfo", "@type": "@id" },
      },
    },
  },
];

/** JSON-LD product passport metadata, pinned to IPFS and referenced by the SBT tokenURI. */
export interface DppMetadata {
  "@context": string | (string | Record<string, unknown>)[];
  "@type": string;
  gtin: string;
  serial: string;
  name: string;
  description?: string;
  origin?: string;
  supplyChain?: { step: string; location?: string; date?: string }[];
  ingredients?: string[];
  ethicalClaims?: EthicalClaim[];
  assembly?: { instructionsUrl?: string; recyclingInfoUrl?: string };
  warrantyStatus?: string;
}

/** Result of minting/looking up a Soulbound Token for one GS1 item. */
export interface SbtRecord {
  gtin: string;
  serial: string;
  tokenId: string;
  owner: `0x${string}`;
  ipfsCid: string;
  active: boolean;
  mintedAt: string;
}
