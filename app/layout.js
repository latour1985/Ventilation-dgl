import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BandeauEssai from "@/components/BandeauEssai";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  // FLUXYA — la marque du PRODUIT (brief 2026-08-18). Neutre : vendable
  // à d'autres entreprises CVC. © Ventilation DGL inc. (mention légale
  // sur les documents exportés et la page de conditions).
  title: "Fluxya",
  description: "Gestion de temps, bons de travail, devis et projets — intégrée à QuickBooks.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Fluxya",
    statusBarStyle: "black-translucent",
  },
};

// CADRAGE iOS (constat du propriétaire, 2026-08-17) : sans
// « viewport-fit: cover », l'iPhone cadre mal la page (encoche, barre
// de geste). Couplé aux marges de sécurité env(safe-area-inset-*) de
// globals.css, le contenu respecte les zones réservées de l'appareil.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#134e4a",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 🧪 Ruban « version d'essai » — visible seulement hors des
            adresses de production (voir components/BandeauEssai.jsx). */}
        <BandeauEssai />
        {children}
      </body>
    </html>
  );
}
