"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, MessageSquare, Trash2, Loader2, CheckCircle2, Play } from "lucide-react";
import Link from "next/link";

interface ContextDoc {
  id: string;
  title: string;
  type: "BRIEF" | "CHAT";
  content: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<ContextDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"BRIEF" | "CHAT">("BRIEF");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchDocs = async () => {
    try {
      const res = await fetch("/api/context");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.contexts) setDocs(data.contexts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!content.trim() || !title.trim()) return;

    setUploading(true);
    try {
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), type, content: content.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload document");
      }

      setSuccess(`Successfully uploaded and generated ${data.chunksCount} pgvector chunks!`);
      setTitle("");
      setContent("");
      await fetchDocs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document and its vector embeddings?")) return;
    try {
      await fetch(`/api/context/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            Project Briefs & Client Chats
          </h1>
          <p className="text-xs text-muted mt-1">
            Upload client documentation. All text is chunked and embedded with pgvector to ground the Bad Client simulator.
          </p>
        </div>

        <Link
          href="/simulator"
          className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary-hover inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Launch simulator</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* UPLOAD FORM */}
        <div className="lg:col-span-1 border border-border rounded-lg bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Upload New Context</h2>
          <p className="text-xs text-muted mb-4">Paste project requirements or past Slack/email threads.</p>

          {error && (
            <div className="mb-4 p-2.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-2.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {success}
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Document Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fintech Mobile App Brief v1"
                className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Context Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "BRIEF" | "CHAT")}
                className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="BRIEF">Project Brief / Specification</option>
                <option value="CHAT">Chat Log / Slack / Email Thread</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Document Content</label>
              <textarea
                required
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste the raw text of the brief or chat here…"
                className="w-full px-3 py-2 text-xs font-mono rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="nowrap w-full py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" />
                  <span>Embedding…</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* DOCUMENTS LIST */}
        <div className="lg:col-span-2">
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Grounded Documents ({docs.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-xs text-muted">
                Loading documents…
              </div>
            ) : docs.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                No briefs or chat logs uploaded yet. Use the form on the left to add documents.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {docs.map((doc) => (
                  <div key={doc.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        {doc.type === "BRIEF" ? (
                          <FileText className="w-4 h-4 text-accent" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                        )}
                        <span className="text-xs font-semibold text-foreground">{doc.title}</span>
                        <span className="text-[10px] font-mono border border-border px-1.5 py-0.5 rounded text-muted">
                          {doc.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                        {doc.content}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1 text-muted hover:text-destructive border border-border rounded hover:bg-surface-subtle"
                      aria-label="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
