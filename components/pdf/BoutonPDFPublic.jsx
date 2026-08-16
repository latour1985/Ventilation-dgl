// components/pdf/BoutonPDFPublic.jsx
//
// Le bouton « Télécharger (PDF) » de la PAGE PUBLIQUE du bon de
// travail (/bon/[jeton]). Chargé dynamiquement (ssr: false) — comme
// BoutonPDF — car @react-pdf/renderer ne tourne que dans le navigateur.
//
// Différence avec BoutonPDF : ici PAS de contexte d'entreprise (page
// publique, personne n'est connecté) — la configuration vient de la
// fonction Postgres bon_travail_public, passée en propriété.

"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BonTravailPublicPDF } from "./DocumentsPDF";

const styleLien = {
  display: "block",
  width: "100%",
  textAlign: "center",
  backgroundColor: "#131B2E",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  padding: "12px 16px",
  borderRadius: "12px",
  textDecoration: "none",
};

export default function BoutonPDFPublic({ bon }) {
  const nomFichier = `Bon-de-travail-${String(bon?.clientNom || "client").replace(/[^a-zA-Z0-9]+/g, "-")}-${bon?.date || ""}.pdf`;
  return (
    <PDFDownloadLink
      document={<BonTravailPublicPDF bon={bon} config={bon?.entreprise} />}
      fileName={nomFichier}
      style={styleLien}
    >
      {({ loading }) => (loading ? "Préparation du PDF…" : "⬇️ Télécharger (PDF)")}
    </PDFDownloadLink>
  );
}
