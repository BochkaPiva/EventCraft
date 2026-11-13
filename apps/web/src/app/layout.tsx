import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/inter";
export const metadata: Metadata = {
  title: "EventCraft",
  description: "Рабочее пространство ивент-агентства",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
