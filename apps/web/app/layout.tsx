import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "MUSE Grants — 공고 대시보드",
  description: "지원사업·용역·교육·대관 공고를 모아 보고, 판정하고, 준비하는 대시보드",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MUSE Grants", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1413" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mg-theme');if(t===null)t='light';if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme}catch(e){document.documentElement.dataset.theme='light'}`,
          }}
        />
      </head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
