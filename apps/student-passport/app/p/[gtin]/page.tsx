import Link from "next/link";
import { redirect } from "next/navigation";

// The GS1 Resolver resolves a serialized scan (`/01/GTIN/21/SERIAL`) against the
// base GTIN document, then appends the qualifier as `?serial=...` on the link's
// href rather than looking up a separate per-serial document (confirmed against
// the vendored resolver's own test suite). This route is what a resolver-issued
// redirect actually lands on — it forwards into the real passport page.
export default async function GtinFallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ gtin: string }>;
  searchParams: Promise<{ serial?: string }>;
}) {
  const { gtin } = await params;
  const { serial } = await searchParams;

  if (serial) {
    redirect(`/p/${gtin}/${serial}`);
  }

  return (
    <main className="shell">
      <p className="eyebrow">CampusPass</p>
      <h1>Missing serial</h1>
      <p className="error-text">
        GTIN {gtin} was resolved, but no serial/qualifier was provided — nothing to look up.
      </p>
      <Link className="btn btn-secondary" href="/">
        Back
      </Link>
    </main>
  );
}
