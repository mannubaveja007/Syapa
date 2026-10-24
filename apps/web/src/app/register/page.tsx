"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-20 pb-16">
      <div className="border border-border rounded-lg bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-foreground mb-2">Create Syapa account</h1>
        <p className="text-xs text-muted mb-6">
          Set up your workspace for live meeting transcripts and negotiation sparring.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Alex Smith"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@domain.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" /> : <span>Create account</span>}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
