"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Key, Copy, Check, Trash2, Plus, Terminal, ExternalLink, ShieldCheck } from "lucide-react";

interface ApiTokenItem {
  id: string;
  name: string;
  token: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenName, setTokenName] = useState("Chrome Extension (Laptop)");
  const [creating, setCreating] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTokens = async () => {
    try {
      const res = await fetch("/api/tokens");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.tokens) setTokens(data.tokens);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);

    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() || "Chrome Extension", expiresInDays: 60 }),
      });

      const data = await res.json();
      if (data.token) {
        setNewlyCreatedToken(data.token.token);
        await fetchTokens();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this extension API token?")) return;
    try {
      await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="pb-6 border-b border-border mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          Connect Chrome Extension
        </h1>
        <p className="text-xs text-muted mt-1">
          Issue personal API authentication tokens to synchronize live transcripts and dual-channel audio from your browser.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* TOKEN GENERATOR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Issue New API Token</h2>
            <p className="text-xs text-muted mb-4">
              Create a secure token for the Syapa Chrome MV3 extension.
            </p>

            <form onSubmit={handleCreateToken} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Token Name</label>
                <input
                  type="text"
                  required
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. Work Macbook Extension"
                  className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creating ? "Generating token…" : "Generate Token"}</span>
              </button>
            </form>
          </div>

          {newlyCreatedToken && (
            <div className="border border-accent/40 bg-accent/5 rounded-lg p-4">
              <span className="text-[11px] text-accent block mb-1 font-semibold">
                New token generated
              </span>
              <p className="text-[11px] text-muted mb-2">
                Copy this token now and paste it into the Chrome extension sidepanel settings:
              </p>
              <div className="flex items-center gap-2 p-2 rounded bg-surface border border-border font-mono text-xs">
                <span className="truncate flex-1 text-foreground select-all">{newlyCreatedToken}</span>
                <button
                  onClick={() => copyToClipboard(newlyCreatedToken)}
                  className="p-1 hover:text-accent active:opacity-80 focus-visible:ring-2 rounded"
                  aria-label="Copy token"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* EXTENSION SETUP GUIDE */}
          <div className="border border-border rounded-lg bg-surface p-5 text-xs text-muted space-y-2">
            <h3 className="font-semibold text-foreground text-xs">How to install extension:</h3>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>Open Chrome and navigate to <code className="text-foreground">chrome://extensions</code></li>
              <li>Toggle <strong className="text-foreground">Developer mode</strong> (top right)</li>
              <li>Click <strong className="text-foreground">Load unpacked</strong></li>
              <li>Select <code className="text-foreground">apps/extension/.output/chrome-mv3</code></li>
              <li>Click the Syapa extension icon to open the Side Panel</li>
              <li>Paste your API token above to connect</li>
            </ol>
          </div>
        </div>

        {/* ACTIVE TOKENS LIST */}
        <div className="lg:col-span-2">
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Active Personal Tokens ({tokens.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-xs text-muted">
                Loading tokens…
              </div>
            ) : tokens.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                No active tokens found. Generate one using the form on the left.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tokens.map((t) => (
                  <div key={t.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-semibold text-foreground">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
                        <span>Created: {new Date(t.createdAt).toLocaleDateString()}</span>
                        <span>Token prefix: <code className="font-mono text-foreground">{t.token.substring(0, 10)}…</code></span>
                        {t.lastUsedAt && (
                          <span className="text-[var(--success)]">
                            Last active: {new Date(t.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(t.token)}
                        className="p-1.5 text-muted hover:text-foreground border border-border rounded hover:bg-surface-subtle"
                        title="Copy full token"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRevoke(t.id)}
                        className="p-1.5 text-muted hover:text-destructive border border-border rounded hover:bg-surface-subtle"
                        title="Revoke token"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
