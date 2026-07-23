import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "ניהול ממוני בטיחות",
  description: "מערכת ניהול לשירותי ממוני בטיחות",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <DirectionProvider direction="rtl">
          <AuthProvider>{children}</AuthProvider>
          <Toaster position="top-center" dir="rtl" />
        </DirectionProvider>
      </body>
    </html>
  );
}
