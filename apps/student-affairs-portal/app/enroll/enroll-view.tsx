"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CAMPUS_PASS_JSONLD_CONTEXT, type DppMetadata } from "@campus-pass/shared";
import { generateProgramCode, generateStudentId, generateWalletAddress } from "../generators";
import { api, type Program } from "../orchestrator";

const ADD_NEW = "__add_new__";
const CURRENT_YEAR = new Date().getFullYear();
const SIGNUP_YEARS = Array.from({ length: 7 }, (_, i) => String(CURRENT_YEAR - i));

interface EnrollResult {
  tokenId: string;
  cid: string;
  tokenURI: string;
  txHash: string;
}

// Server-safe placeholder — no randomness here. The actual random Student ID /
// wallet get filled in by a client-only effect after mount, and freshly
// regenerated (also client-side, inside the submit handler) after each
// enrollment. Calling Math.random() directly in a useState initializer would
// run once during server render and again during client hydration, producing
// two different values for the same controlled input and a hydration mismatch.
function freshForm() {
  return {
    program: "",
    studentId: "",
    walletAddress: "",
    givenName: "",
    familyName: "",
    email: "",
    signupYear: String(CURRENT_YEAR),
    notes: "",
  };
}

function randomizedForm() {
  return { ...freshForm(), studentId: generateStudentId(), walletAddress: generateWalletAddress() };
}

export function EnrollView() {
  const [form, setForm] = useState(freshForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollResult | null>(null);

  const [rosterGtins, setRosterGtins] = useState<string[]>([]);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [addingProgram, setAddingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramCode, setNewProgramCode] = useState("");

  // Fill in the random Student ID / wallet after mount (client-only — see the
  // comment on freshForm above for why this can't happen in useState directly).
  useEffect(() => {
    setForm((f) => ({ ...f, studentId: generateStudentId(), walletAddress: generateWalletAddress() }));
  }, []);
  // Programs are a real, shared Postgres table now (see DECISIONS.md) — not
  // per-browser localStorage. Still merged below with any gtin that shows up
  // in the roster but isn't a registered program (e.g. minted directly via the
  // API), so it doesn't just silently disappear from the dropdown.
  const loadPrograms = useCallback(async () => {
    try {
      const res = await api("/programs", { cache: "no-store" });
      const data = await res.json();
      setPrograms(data.programs ?? []);
    } catch {
      // Orchestrator not reachable yet — leave the list empty rather than crash the page.
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // Programs minted directly via the API still appear in the dropdown.
  useEffect(() => {
    api("/items", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setRosterGtins([...new Set<string>((data.items ?? []).map((r: { gtin: string }) => r.gtin))]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (rosterGtins.length === 0) return;
    setPrograms((current) => {
      const known = new Set(current.map((p) => p.code));
      const additions = rosterGtins.filter((code) => !known.has(code)).map((code) => ({ code, name: code }));
      return additions.length ? [...current, ...additions] : current;
    });
  }, [rosterGtins, programs.length]);

  function updateField(key: keyof ReturnType<typeof freshForm>) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleProgramSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW) {
      setNewProgramCode(generateProgramCode());
      setAddingProgram(true);
      return;
    }
    setForm((f) => ({ ...f, program: e.target.value }));
  }

  async function confirmNewProgram() {
    const name = newProgramName.trim() || newProgramCode;
    try {
      const res = await api("/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: newProgramCode, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Failed to add program (${res.status})`);
      }
      setPrograms((current) => [...current, { code: newProgramCode, name }]);
      setForm((f) => ({ ...f, program: newProgramCode }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNewProgramName("");
      setNewProgramCode("");
      setAddingProgram(false);
    }
  }

  function cancelNewProgram() {
    setAddingProgram(false);
    setNewProgramName("");
    setNewProgramCode("");
  }

  // The code field always mirrors whichever program is currently selected (or
  // being created) — a separate, always-visible, read-only field next to the
  // name, rather than only appearing transiently while adding a new one.
  const selectedProgramCode = addingProgram ? newProgramCode : programs.find((p) => p.code === form.program)?.code ?? "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const metadata: DppMetadata = {
      "@context": CAMPUS_PASS_JSONLD_CONTEXT,
      "@type": "Person",
      gtin: form.program,
      serial: form.studentId,
      name: form.studentId,
      origin: form.signupYear,
    };

    try {
      const res = await api("/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gtin: form.program,
          serial: form.studentId,
          ownerAddress: form.walletAddress,
          metadata,
          details: {
            givenName: form.givenName,
            familyName: form.familyName,
            email: form.email,
            notes: form.notes || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Enrollment failed (${res.status})`);
      }
      setResult(data);
      setForm(randomizedForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card card-narrow">
      <div className="card-header">
        <div>
          <h2 className="card-title">Enroll a student</h2>
          <p className="card-sub">Pins their pseudonymous passport to IPFS and mints their non-transferable campus credential.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label htmlFor="program">Program name</label>
              {addingProgram ? (
                <input
                  id="program"
                  className="input"
                  placeholder="e.g. Business Administration"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  autoFocus
                />
              ) : (
                <select id="program" className="input" required value={form.program} onChange={handleProgramSelect}>
                  <option value="" disabled>
                    Select a program…
                  </option>
                  {programs.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                  <option value={ADD_NEW}>+ Add new program…</option>
                </select>
              )}
            </div>
            <div className="field">
              <label htmlFor="programCode">Program code</label>
              <input
                id="programCode"
                className="input mono"
                value={selectedProgramCode}
                disabled
                title="Auto-generated — not editable"
                placeholder="—"
              />
            </div>
          </div>
  
          {addingProgram && (
            <div style={{ display: "flex", gap: 8, marginTop: -6, marginBottom: 14 }}>
              <button type="button" className="btn" onClick={confirmNewProgram} disabled={!newProgramName.trim()}>
                Add program
              </button>
              <button type="button" className="btn btn-outline" onClick={cancelNewProgram}>
                Cancel
              </button>
            </div>
          )}
  
          <div className="row">
            <div className="field">
              <label htmlFor="studentId">Student ID</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  id="studentId"
                  className="input mono"
                  required
                  value={form.studentId}
                  onChange={updateField("studentId")}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-icon"
                  title="Generate a new random ID"
                  
                  onClick={() => setForm((f) => ({ ...f, studentId: generateStudentId() }))}
                >
                  ↻
                </button>
              </div>
            </div>
          </div>
  
          <div className="field">
            <label htmlFor="walletAddress">Student wallet address</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                id="walletAddress"
                className="input mono"
                required
                value={form.walletAddress}
                onChange={updateField("walletAddress")}
              />
              <button
                type="button"
                className="btn btn-outline btn-icon"
                title="Generate a new random address"
                
                onClick={() => setForm((f) => ({ ...f, walletAddress: generateWalletAddress() }))}
              >
                ↻
              </button>
            </div>
          </div>
  
          <div className="row">
            <div className="field">
              <label htmlFor="givenName">Given name</label>
              <input id="givenName" className="input" required value={form.givenName} onChange={updateField("givenName")} />
            </div>
            <div className="field">
              <label htmlFor="familyName">Family name</label>
              <input id="familyName" className="input" required value={form.familyName} onChange={updateField("familyName")} />
            </div>
          </div>
  
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={form.email} onChange={updateField("email")} />
          </div>
  
          <div className="row">
            <div className="field">
              <label htmlFor="signupYear">Signing up year</label>
              <select id="signupYear" className="input" value={form.signupYear} onChange={updateField("signupYear")}>
                {SIGNUP_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
  
          <div className="field">
            <label htmlFor="notes">Private notes (registrar only, never published)</label>
            <textarea id="notes" className="input" rows={3} value={form.notes} onChange={updateField("notes")} />
          </div>
  
          <button className="btn" type="submit" disabled={submitting || !form.program}>
            {submitting ? "Enrolling…" : "Enroll student"}
          </button>
  
          {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
  
          {result && (
            <div className="result-panel">
              <p className="card-title">Enrolled</p>
              <ul className="list mono">
                <li>Credential ID: {result.tokenId}</li>
                <li>IPFS CID: {result.cid}</li>
                <li>Tx: {result.txHash}</li>
              </ul>
            </div>
          )}
      </form>
    </div>
  );
}
