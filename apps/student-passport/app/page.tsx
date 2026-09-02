"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [program, setProgram] = useState("NORDICPOLY-CS");
  const [studentId, setStudentId] = useState("S-2024-0117");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!program || !studentId) return;
    router.push(`/p/${encodeURIComponent(program)}/${encodeURIComponent(studentId)}`);
  }

  return (
    <main className="shell">
      <p className="eyebrow">CampusPass</p>
      <h1>Student Passport</h1>
      <p>
        Tapping a CampusPass card or scanning its QR code normally lands here directly. For
        local testing, enter a program code and student ID to look one up.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="program">Program code</label>
          <input
            id="program"
            className="input"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            placeholder="NORDICPOLY-CS"
          />
        </div>
        <div className="field">
          <label htmlFor="studentId">Student ID</label>
          <input
            id="studentId"
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="S-2024-0117"
          />
        </div>
        <button className="btn" type="submit">
          View passport
        </button>
      </form>
    </main>
  );
}
