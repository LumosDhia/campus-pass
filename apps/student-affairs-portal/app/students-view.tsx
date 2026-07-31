"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "./orchestrator";

const STUDENT_PASSPORT_URL = process.env.NEXT_PUBLIC_STUDENT_PASSPORT_URL ?? "http://localhost:3000";
interface RosterEntry {
  tokenId: string;
  owner: string;
  gtin: string; // program code
  serial: string; // student ID
  tokenURI: string;
  givenName?: string | null;
  familyName?: string | null;
  notes?: string | null;
}

export function StudentsView() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);

  const [claimTarget, setClaimTarget] = useState<string | null>(null); // tokenId
  const [claimForm, setClaimForm] = useState({ label: "", value: "" });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      const res = await api("/items", { cache: "no-store" });
      const data = await res.json();
      setRoster(data.items ?? []);
    } catch {
      // Orchestrator not reachable yet — leave the roster empty rather than crash the page.
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  async function submitClaim(entry: RosterEntry) {
    if (!claimForm.label || !claimForm.value) return;
    setClaimSubmitting(true);
    try {
      const res = await api(`/sbt/${entry.gtin}/${entry.serial}/claims`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(claimForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Failed to log achievement (${res.status})`);
      }
      setClaimForm({ label: "", value: "" });
      setClaimTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaimSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Students</h2>
          <p className="card-sub">{rosterLoading ? "Loading…" : `${roster.length} enrolled`}</p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="table-scroll">
      {rosterLoading && <p className="muted">Loading…</p>}
      {!rosterLoading && roster.length === 0 && <p className="muted">No students enrolled yet.</p>}
      {roster.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Program</th>
              <th>Student ID</th>
              <th>Credential</th>
              <th>Wallet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roster.map((entry) => (
              <Fragment key={entry.tokenId}>
                <tr>
                  {entry.givenName && entry.familyName ? (
                    <td>{`${entry.givenName} ${entry.familyName}`}</td>
                  ) : (
                    <td className="mono">{entry.serial}</td>
                  )}
                  <td><span className="pill mono">{entry.gtin}</span></td>
                  <td className="mono">{entry.serial}</td>
                  <td>{entry.tokenId}</td>
                  <td className="mono">
                    {entry.owner.slice(0, 6)}…{entry.owner.slice(-4)}
                  </td>
                  <td className="actions-cell">
                    <a
                      href={`${STUDENT_PASSPORT_URL}/p/${entry.gtin}/${entry.serial}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                    >
                      View passport
                    </a>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setClaimTarget(claimTarget === entry.tokenId ? null : entry.tokenId);
                        setClaimForm({ label: "", value: "" });
                      }}
                    >
                      + Log achievement
                    </button>
                  </td>
                </tr>
                {claimTarget === entry.tokenId && (
                  <tr>
                    <td colSpan={6} className="expand-cell">
                      {entry.notes && <p className="muted">{entry.notes}</p>}
                      <div className="row expand-row">
                        <div className="field">
                          <input
                            className="input"
                            placeholder="Label (e.g. Volunteer hours)"
                            value={claimForm.label}
                            onChange={(e) => setClaimForm((f) => ({ ...f, label: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <input
                            className="input"
                            placeholder="Value (e.g. 12 — Ocean Cleanup Program)"
                            value={claimForm.value}
                            onChange={(e) => setClaimForm((f) => ({ ...f, value: e.target.value }))}
                          />
                        </div>
                        <button
                          className="btn"
                          disabled={claimSubmitting}
                          onClick={() => submitClaim(entry)}
                        >
                          {claimSubmitting ? "Logging…" : "Log"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}
