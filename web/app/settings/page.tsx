"use client";

import { useState } from "react";

export default function Settings() {
  const [token, setToken] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens", { method: "POST" });
      const data = await res.json();
      setToken(data.token);
      setScope(`${data.scope} · ${data.owner}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>CLI token</h1>
      <div className="sub">
        Mint a token so the <code>archmantic</code> CLI can push the architecture model to this
        organization without the database URL.
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            background: "#7aa2f7",
            color: "#0f1115",
            border: 0,
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Generating…" : "Generate token"}
        </button>

        {token ? (
          <div style={{ marginTop: 16 }}>
            <div className="sub">Scope: {scope}</div>
            <pre
              style={{
                marginTop: 8,
                background: "#0f1115",
                border: "1px solid #232734",
                borderRadius: 8,
                padding: 12,
                overflow: "auto",
                userSelect: "all",
              }}
            >
              {token}
            </pre>
            <div className="sub">Copy it now — it won&apos;t be shown again. Then in your repo:</div>
            <pre
              style={{
                marginTop: 8,
                background: "#0f1115",
                border: "1px solid #232734",
                borderRadius: 8,
                padding: 12,
                overflow: "auto",
              }}
            >
              {`# .env.local\nARCHMANTIC_TOKEN=${token}\nARCHMANTIC_API_URL=${typeof window !== "undefined" ? window.location.origin : ""}`}
            </pre>
            <div className="sub">
              Then <code>archmantic push</code> uploads to this org via the API.
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
