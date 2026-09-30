import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dev Task Sheet",
  description: "Daily task sheet for the dev customization team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
