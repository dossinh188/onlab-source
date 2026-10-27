import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ônlab — Góc học tập AI",
  description: "Biến tài liệu thành tóm tắt, thẻ ghi nhớ và bài luyện tập. Học chủ động cùng AI.",
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
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
