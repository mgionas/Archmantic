"use client";

import { useCallback, useEffect, useState } from "react";

interface TokenRow {
  id: string;
  prefix: string | null;
  label: string | null;
  created_at: string;
}

export default function Settings() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [scope, setScope] = useState<string>("");
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens");
    if (!res.ok) return;
    const data = await res.json();
    setTokens(data.tokens ?? []);
    setScope(data.scope ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: label || null }),
      });
      const data = await res.json();
      setFresh(data.token);
      setLabel("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function rename(t: TokenRow) {
    const next = window.prompt("Token label:", t.label ?? "");
    if (next === null) return;
    await fetch("/api/tokens", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, label: next }),
    });
    await load();
  }

  async function revoke(t: TokenRow) {
    if (!window.confirm(`Revoke ${t.label || "this token"}? Any CLI using it will stop working.`)) return;
    await fetch(`/api/tokens?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
    await load();
  }

  const apiUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main>
      <h1>CLI tokens</h1>
      <div className="sub">
        Tokens let the <code>archmantic</code> CLI push your architecture model to{" "}
        <strong>{scope || "this scope"}</strong> without the database URL. Stored hashed — shown once at creation.
      </div>

      <div className="card" style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. laptop, CI)"
          style={{
            background: "#0f1115",
            border: "1px solid #232734",
            borderRadius: 8,
            color: "#e6e9ef",
            padding: "8px 10px",
            flex: 1,
          }}
        />
        <button onClick={generate} disabled={busy} style={btn}>
          {busy ? "Generating…" : "Generate token"}
        </button>
      </div>

      {fresh ? (
        <div className="card" style={{ marginTop: 12, borderColor: "#7aa2f7" }}>
          <div className="sub">Copy it now — it won&apos;t be shown again:</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <code style={{ ...codeBox, flex: 1, color: "#e6e9ef", userSelect: "all" }}>{fresh}</code>
            <button onClick={() => navigator.clipboard?.writeText(fresh)} style={btn}>
              Copy
            </button>
          </div>
          <div className="sub" style={{ marginTop: 10 }}>Add to your repo&apos;s <code>.env.local</code>:</div>
          <pre style={{ ...codeBox, marginTop: 6 }}>{`ARCHMANTIC_TOKEN=${fresh}\nARCHMANTIC_API_URL=${apiUrl}`}</pre>
          <button onClick={() => setFresh(null)} style={{ ...btnGhost, marginTop: 8 }}>
            Dismiss
          </button>
        </div>
      ) : null}

      <h2>Your tokens</h2>
      {tokens.length === 0 ? (
        <div className="card empty">No tokens yet. Generate one above.</div>
      ) : (
        <div className="card">
          {tokens.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #1f232e",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{t.label || <span className="empty">unnamed</span>}</div>
                <div className="sub">
                  <code>{t.prefix ? `${t.prefix}••••••••` : "arch_••••"}</code> · created{" "}
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => rename(t)} style={btnGhost}>
                Rename
              </button>
              <button onClick={() => revoke(t)} style={{ ...btnGhost, color: "#f87171", borderColor: "#3a1f22" }}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

const btn: React.CSSProperties = {
  background: "#7aa2f7",
  color: "#0f1115",
  border: 0,
  borderRadius: 8,
  padding: "8px 14px",
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#8b93a7",
  border: "1px solid #232734",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
};
const codeBox: React.CSSProperties = {
  background: "#0f1115",
  border: "1px solid #232734",
  borderRadius: 8,
  padding: 12,
  overflow: "auto",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};
