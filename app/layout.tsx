import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KGM Hiring Portal",
    template: "%s | KGM Hiring",
  },
  description: "Candidate assessments and hiring operations for KGM.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.jpeg", type: "image/jpeg" },
      { url: "/favicon.jpg", type: "image/jpeg" },
    ],
    shortcut: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/apple-icon.jpeg", type: "image/jpeg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-svh bg-background font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
