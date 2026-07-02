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
      { url: "/favicon-dark.jpeg", type: "image/jpeg", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon.jpg", type: "image/jpeg" },
    ],
    shortcut: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [
      { url: "/apple-icon.jpeg", type: "image/jpeg" },
      { url: "/apple-icon-dark.jpeg", type: "image/jpeg", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  const lightIcon = "/favicon.ico";
  const darkIcon = "/favicon-dark.ico";
  const lightAppleIcon = "/apple-icon.jpeg";
  const darkAppleIcon = "/apple-icon-dark.jpeg";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const ensureLink = (rel) => {
    let link = document.querySelector('link[rel="' + rel + '"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    return link;
  };
  const applyIcon = () => {
    const isDark = media.matches;
    const icon = ensureLink("icon");
    icon.href = isDark ? darkIcon : lightIcon;
    icon.sizes = "any";
    const shortcut = ensureLink("shortcut icon");
    shortcut.href = isDark ? darkIcon : lightIcon;
    shortcut.sizes = "any";
    const apple = ensureLink("apple-touch-icon");
    apple.href = isDark ? darkAppleIcon : lightAppleIcon;
  };
  applyIcon();
  media.addEventListener?.("change", applyIcon);
})();
            `.trim(),
          }}
        />
      </head>
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
