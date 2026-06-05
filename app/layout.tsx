import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행 플래너",
  description: "친구들과 함께하는 여행 계획 & 기록",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
