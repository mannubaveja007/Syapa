"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
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
        <h1 className="text-xl font-semibold text-foreground mb-2">Sign in to Syapa</h1>
        <p className="text-xs text-muted mb-6">
          Access your recorded meetings, grounded contexts, and negotiation simulator.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" /> : <span>Sign in</span>}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted">
          Don’t have an account?{" "}
          <Link href="/register" className="text-foreground hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
