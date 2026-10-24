"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert, LogOut, Moon, Sun, Terminal } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name?: string; email: string } | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    if (typeof window !== "undefined") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (document.documentElement.classList.contains("dark") || prefersDark) {
        setIsDark(true);
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <header className="border-b border-border bg-surface sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2 active:opacity-80 focus-visible:ring-2">
            <span className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">S</span>
            <span>Syapa</span>
          </Link>

          {!isAuthPage && (
            <nav className="hidden md:flex items-center gap-4 text-xs font-normal">
              <Link
                href="/dashboard"
                className={`transition-colors py-1 active:opacity-80 focus-visible:ring-2 ${pathname === "/dashboard" || pathname.startsWith("/meetings") ? "text-foreground font-medium" : "text-muted hover:text-foreground"}`}
              >
                Meetings
              </Link>
              <Link
                href="/simulator"
                className={`transition-colors py-1 active:opacity-80 focus-visible:ring-2 ${pathname.startsWith("/simulator") || pathname.startsWith("/scorecards") ? "text-foreground font-medium" : "text-muted hover:text-foreground"}`}
              >
                Simulator
              </Link>
              <Link
                href="/practice"
                className={`transition-colors py-1 active:opacity-80 focus-visible:ring-2 ${pathname.startsWith("/practice") ? "text-foreground font-medium" : "text-muted hover:text-foreground"}`}
              >
                Practice
              </Link>
              <Link
                href="/documents"
                className={`transition-colors py-1 active:opacity-80 focus-visible:ring-2 ${pathname === "/documents" ? "text-foreground font-medium" : "text-muted hover:text-foreground"}`}
              >
                Context
              </Link>
              <Link
                href="/settings"
                className={`transition-colors py-1 active:opacity-80 focus-visible:ring-2 ${pathname === "/settings" ? "text-foreground font-medium" : "text-muted hover:text-foreground"}`}
              >
                Extension
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-1.5 text-muted hover:text-foreground border border-border rounded-md bg-surface-subtle active:opacity-80 focus-visible:ring-2 disabled:opacity-50"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted hidden sm:inline">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-muted hover:text-destructive flex items-center gap-1 border border-border px-2.5 py-1 rounded-md active:opacity-80 focus-visible:ring-2 disabled:opacity-50"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle active:opacity-80 focus-visible:ring-2"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary-hover active:opacity-80 focus-visible:ring-2"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
