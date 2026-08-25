import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppDataProvider } from "@/lib/appData";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Steady — study companion",
  description:
    "A calm study and course companion for college students with ADHD: one next step at a time, with read-aloud support.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#15171a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint to prevent a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AppDataProvider>
            <AppShell>{children}</AppShell>
          </AppDataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
