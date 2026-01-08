import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Fonction AI/Background";
import { UrlTracker } from "@/components/Tracking/UrlTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio — Lottie ultra léger",
  description: "Portfolio interactif avec animations Lottie et chat IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta httpEquiv="Permissions-Policy" content="interest-cohort=()" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UrlTracker />
        <Background>
          {children}
        </Background>
      </body>
    </html>
  );
}
