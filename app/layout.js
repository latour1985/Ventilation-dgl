import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ventilation DGL — Gestion",
  description: "Applications de gestion Ventilation DGL inc. (admin + technicien)",
};

// CADRAGE iOS (constat du propriétaire, 2026-08-17) : sans
// « viewport-fit: cover », l'iPhone cadre mal la page (encoche, barre
// de geste). Couplé aux marges de sécurité env(safe-area-inset-*) de
// globals.css, le contenu respecte les zones réservées de l'appareil.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
