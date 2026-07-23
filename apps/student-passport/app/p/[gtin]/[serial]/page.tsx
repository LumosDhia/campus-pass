import Link from "next/link";
import type { DppMetadata } from "@campus-pass/shared";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:4002";
const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL ?? "http://localhost:8081";

interface SbtRecord {
  tokenId: string;
  owner: string;
  tokenURI: string;
  active: boolean;
}

interface Claim {
  label: string;
  value: string;
  timestamp: string;
}

// Minimal multi-language support for the static UI chrome (HLD §6 Phase 4).
// Dynamic passport content (name, claims, supply chain) is authored once per
// item and shown as-is — translating that would mean per-language metadata
// fields, out of scope for this MVP.
const STRINGS = {
  en: {
    notFoundTitle: "Not found",
    notFound: (a: string, b: string) => `No passport is registered for ${a} / ${b}.`,
    back: "Back",
    enrolled: "Enrolled",
    notEnrolled: "Not enrolled",
    active: "Active",
    revoked: "Revoked",
    identity: "Student",
    identityProduct: "Item",
    program: "Program",
    studentId: "Student ID",
    gtin: "GTIN",
    serial: "Serial",
    credentialId: "Credential ID",
    tokenId: "Token ID",
    wallet: "Wallet",
    cohort: "Cohort",
    origin: "Origin",
    warranty: "Warranty",
    verifiedRecord: "Verified record",
    nothingLogged: "Nothing logged yet.",
    atEnrollment: "At enrollment",
    ethicalImpact: "Ethical impact",
    ingredients: "Ingredients",
    supplyChain: "Supply chain",
    technicalDocs: "Technical Docs",
    assemblyInstructions: "Assembly instructions",
    recyclingInfo: "Recycling info",
    needHelp: "Need help?",
    chatDescStudent: "Chat with the registrar's office — your student ID and enrollment status are shared automatically.",
    chatDescProduct: "Chat with an operator — your serial number and warranty status are shared automatically.",
    startChat: "Start chat (not wired up in this MVP)",
    lookUpAnother: "← Look up another item",
  },
  fr: {
    notFoundTitle: "Introuvable",
    notFound: (a: string, b: string) => `Aucun passeport enregistré pour ${a} / ${b}.`,
    back: "Retour",
    enrolled: "Inscrit",
    notEnrolled: "Non inscrit",
    active: "Actif",
    revoked: "Révoqué",
    identity: "Étudiant",
    identityProduct: "Article",
    program: "Programme",
    studentId: "N° étudiant",
    gtin: "GTIN",
    serial: "N° de série",
    credentialId: "ID d'identifiant",
    tokenId: "ID de jeton",
    wallet: "Portefeuille",
    cohort: "Cohorte",
    origin: "Origine",
    warranty: "Garantie",
    verifiedRecord: "Historique vérifié",
    nothingLogged: "Rien n'a encore été enregistré.",
    atEnrollment: "À l'inscription",
    ethicalImpact: "Impact éthique",
    ingredients: "Ingrédients",
    supplyChain: "Chaîne d'approvisionnement",
    technicalDocs: "Documentation technique",
    assemblyInstructions: "Instructions de montage",
    recyclingInfo: "Informations de recyclage",
    needHelp: "Besoin d'aide ?",
    chatDescStudent: "Discutez avec le service scolarité — votre numéro étudiant et votre statut sont partagés automatiquement.",
    chatDescProduct: "Discutez avec un opérateur — votre numéro de série et le statut de garantie sont partagés automatiquement.",
    startChat: "Démarrer le chat (non connecté dans ce MVP)",
    lookUpAnother: "← Rechercher un autre article",
  },
} as const;

type Lang = keyof typeof STRINGS;

async function getRecord(gtin: string, serial: string): Promise<SbtRecord | null> {
  const res = await fetch(`${ORCHESTRATOR_URL}/sbt/${gtin}/${serial}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Orchestrator error: ${res.status}`);
  return res.json();
}

async function getMetadata(tokenURI: string): Promise<DppMetadata> {
  const cid = tokenURI.replace(/^ipfs:\/\//, "");
  const res = await fetch(`${IPFS_GATEWAY_URL}/ipfs/${cid}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`IPFS gateway error: ${res.status}`);
  return res.json();
}

async function getClaims(gtin: string, serial: string): Promise<Claim[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/sbt/${gtin}/${serial}/claims`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.claims ?? [];
}

export default async function PassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ gtin: string; serial: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { gtin, serial } = await params;
  const { lang: langParam } = await searchParams;
  const lang: Lang = langParam === "fr" ? "fr" : "en";
  const t = STRINGS[lang];

  const record = await getRecord(gtin, serial);

  if (!record) {
    return (
      <main className="shell">
        <p className="eyebrow">CampusPass</p>
        <h1>{t.notFoundTitle}</h1>
        <p className="error-text">{t.notFound(gtin, serial)}</p>
        <Link className="btn btn-secondary" href="/">
          {t.back}
        </Link>
      </main>
    );
  }

  const [metadata, claims] = await Promise.all([getMetadata(record.tokenURI), getClaims(gtin, serial)]);
  const isPerson = metadata["@type"] === "Person";

  return (
    <main className="shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="eyebrow">CampusPass</p>
        <span className="mono muted" style={{ fontSize: 12 }}>
          <Link href={`/p/${gtin}/${serial}?lang=en`} className={lang === "en" ? "" : "muted"}>
            EN
          </Link>
          {" · "}
          <Link href={`/p/${gtin}/${serial}?lang=fr`} className={lang === "fr" ? "" : "muted"}>
            FR
          </Link>
        </span>
      </div>

      <h1>{isPerson ? `${t.identity} ${serial}` : metadata.name}</h1>
      <span className={`badge ${record.active ? "badge-active" : "badge-inactive"}`}>
        {record.active ? (isPerson ? t.enrolled : t.active) : isPerson ? t.notEnrolled : t.revoked}
      </span>

      {metadata.description && <p style={{ marginTop: 16 }}>{metadata.description}</p>}

      <div className="card">
        <p className="section-title" style={{ marginTop: 0 }}>
          {isPerson ? t.identity : t.identityProduct}
        </p>
        <ul className="list mono">
          <li>
            {isPerson ? t.program : t.gtin}: {metadata.gtin}
          </li>
          <li>
            {isPerson ? t.studentId : t.serial}: {metadata.serial}
          </li>
          <li>
            {isPerson ? t.credentialId : t.tokenId}: {record.tokenId}
          </li>
          <li>
            {t.wallet}: {record.owner}
          </li>
          {metadata.origin && (
            <li>
              {isPerson ? t.cohort : t.origin}: {metadata.origin}
            </li>
          )}
          {metadata.warrantyStatus && (
            <li>
              {t.warranty}: {metadata.warrantyStatus}
            </li>
          )}
        </ul>
      </div>

      <p className="section-title">{t.verifiedRecord}</p>
      <div className="card">
        {claims.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            {t.nothingLogged}
          </p>
        )}
        {claims.length > 0 && (
          <ul className="list">
            {claims.map((claim, i) => (
              <li key={i}>
                <span className="muted">{claim.label}: </span>
                {claim.value}
                <span className="muted" style={{ float: "right", fontSize: 12 }}>
                  {new Date(claim.timestamp).toLocaleDateString(lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {metadata.ethicalClaims && metadata.ethicalClaims.length > 0 && (
        <>
          <p className="section-title">{isPerson ? t.atEnrollment : t.ethicalImpact}</p>
          <div className="card">
            <ul className="list">
              {metadata.ethicalClaims.map((claim, i) => (
                <li key={i}>
                  <span className="muted">{claim.label}: </span>
                  {claim.value}
                  {claim.unit ? ` ${claim.unit}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {metadata.ingredients && metadata.ingredients.length > 0 && (
        <>
          <p className="section-title">{t.ingredients}</p>
          <div className="card">
            <ul className="list">
              {metadata.ingredients.map((ingredient, i) => (
                <li key={i}>{ingredient}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {metadata.supplyChain && metadata.supplyChain.length > 0 && (
        <>
          <p className="section-title">{t.supplyChain}</p>
          <div className="card">
            <ul className="list">
              {metadata.supplyChain.map((step, i) => (
                <li key={i}>
                  {step.step}
                  {step.location && <span className="muted"> — {step.location}</span>}
                  {step.date && <span className="muted"> · {step.date}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {metadata.assembly && (metadata.assembly.instructionsUrl || metadata.assembly.recyclingInfoUrl) && (
        <>
          <p className="section-title">{t.technicalDocs}</p>
          <div className="card">
            <ul className="list">
              {metadata.assembly.instructionsUrl && (
                <li>
                  <a href={metadata.assembly.instructionsUrl}>{t.assemblyInstructions} →</a>
                </li>
              )}
              {metadata.assembly.recyclingInfoUrl && (
                <li>
                  <a href={metadata.assembly.recyclingInfoUrl}>{t.recyclingInfo} →</a>
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      <p className="section-title">{t.needHelp}</p>
      <div className="card">
        <p style={{ marginBottom: 12 }}>{isPerson ? t.chatDescStudent : t.chatDescProduct}</p>
        <button
          className="btn btn-secondary"
          type="button"
          disabled
          data-serial={metadata.serial}
          data-warranty-status={metadata.warrantyStatus ?? "n/a"}
        >
          {t.startChat}
        </button>
      </div>

      <hr className="divider" />
      <Link className="muted mono" href="/" style={{ fontSize: 13 }}>
        {t.lookUpAnother}
      </Link>
    </main>
  );
}
