"use client";

// components/pdf/BoutonPDFDevisPublic.jsx
//
// ⬇️ « Télécharger le PDF » sur la PAGE PUBLIQUE du devis (2026-09-16,
// retour d'un client : « c'est compliqué » — il n'avait que la page
// web). Même document que l'aperçu du bureau (DevisPDF), rendu dans le
// navigateur du client (@react-pdf/renderer ne tourne pas côté serveur —
// à importer en `dynamic(..., { ssr: false })`).
import { PDFDownloadLink } from "@react-pdf/renderer";
import { DevisPDF } from "./DocumentsPDF";

const styleLien = {
  display: "inline-block",
  backgroundColor: "#ffffff",
  color: "#131B2E",
  border: "1px solid #cbd5e1",
  fontSize: "12px",
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: "10px",
  textDecoration: "none",
};

export default function BoutonPDFDevisPublic({ devis, config }) {
  const nomFichier = `Devis-${String(devis?.numero || "").replace(/[^a-zA-Z0-9-]+/g, "-")}.pdf`;
  return (
    <PDFDownloadLink document={<DevisPDF devis={devis} config={config} />} fileName={nomFichier} style={styleLien}>
      {({ loading }) => (loading ? "Préparation du PDF…" : "⬇️ Télécharger en PDF")}
    </PDFDownloadLink>
  );
}
