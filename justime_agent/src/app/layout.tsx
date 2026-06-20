import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { MacAppShell } from "@/components/layout/MacAppShell";
import { MobileViewportGuard } from "@/components/MobileViewportGuard";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "矩时 - 焦虑缓解与任务规划助手",
  description: "专为大学生设计的情绪-任务双驱动智能助手，基于情绪状态提供个性化任务拆解和心理支持",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "矩时",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MacAppShell>{children}</MacAppShell>
          <MobileViewportGuard />
          <KeyboardShortcutsHelp />
          <Toaster />
          <PWAInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
} 