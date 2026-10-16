import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이어쓰기 | 나의 경험으로 쓰는 자기소개서",
  description: "성향을 살펴보고, 강점과 실제 경험을 연결해 자기소개서 초안을 만들어 보세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
