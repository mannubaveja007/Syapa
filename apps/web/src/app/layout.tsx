import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Syapa | Freelancer Meeting Recorder & Bad Client Simulator",
  description: "Record and live transcribe meetings via Chrome MV3. Train negotiation against simulated difficult clients grounded in your real brief and past transcripts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark overflow-x-clip">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-surface-muted selection:text-foreground overflow-x-clip">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
