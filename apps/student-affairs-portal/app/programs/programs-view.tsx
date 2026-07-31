"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { generateProgramCode } from "../generators";
import { api, type Program } from "../orchestrator";
import { Icon } from "../shell";

const SCAN_BASE_URL = "http://localhost:8090/01";

export function ProgramsView() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [programsRes, itemsRes] = await Promise.all([
        api("/programs", { cache: "no-store" }),
        api("/items", { cache: "no-store" }),
      ]);
      const programsData = await programsRes.json();
      const itemsData = await itemsRes.json();
      const grouped: Record<string, number> = {};
      for (const item of (itemsData.items ?? []) as { gtin: string }[]) {
        grouped[item.gtin] = (grouped[item.gtin] ?? 0) + 1;
      }
      setPrograms(programsData.programs ?? []);
      setCounts(grouped);
    } catch {
      // Orchestrator not reachable yet — leave the list empty rather than crash the page.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm() {
    setNewCode(generateProgramCode());
    setNewName("");
    setError(null);
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setNewName("");
    setNewCode("");
    setError(null);
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim() || newCode;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api("/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: newCode, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to add program (${res.status})`);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Programs</h2>
          <p className="card-sub">{loading ? "Loading…" : `${programs.length} programs`}</p>
        </div>
        {!adding && (
          <button type="button" className="btn" onClick={openForm}>
            <Icon name="plus" />
            Add program
          </button>
        )}
      </div>

      {adding && (
        <form className="inline-form" onSubmit={handleAdd}>
          <div className="row">
            <div className="field">
              <label htmlFor="newProgramName">Program name</label>
              <input
                id="newProgramName"
                className="input"
                placeholder="e.g. Business Administration"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="newProgramCode">Program code</label>
              <input
                id="newProgramCode"
                className="input mono"
                value={newCode}
                disabled
                title="Auto-generated — not editable"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={submitting || !newName.trim()}>
              {submitting ? "Adding…" : "Add program"}
            </button>
            <button type="button" className="btn btn-outline" onClick={closeForm}>
              Cancel
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </form>
      )}

      <div className="table-scroll">
        {!loading && programs.length === 0 && <p className="muted">No programs yet.</p>}
        {programs.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Code</th>
                <th>Credentials</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.code}>
                  <td className="strong">{program.name}</td>
                  <td>
                    <span className="pill mono">{program.code}</span>
                  </td>
                  <td>
                    <span className="badge badge-success">{counts[program.code] ?? 0}</span>
                  </td>
                  <td className="actions-cell">
                    <a className="link" href={`${SCAN_BASE_URL}/${program.code}`} target="_blank" rel="noreferrer">
                      Scan URL
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
