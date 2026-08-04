// components/pdf/BoutonPDF.jsx
//
// Bouton « Télécharger le PDF » affiché dans les aperçus de documents.
// Génère le fichier PDF côté navigateur via @react-pdf/renderer.
// Ce composant est chargé dynamiquement (ssr: false) depuis page.jsx,
// car @react-pdf/renderer ne fonctionne pas côté serveur.

"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { DevisPDF, FacturePDF, BonTravailPDF } from "./DocumentsPDF";
import { useEntreprise } from "@/lib/contexteEntreprise";

const styleLien = {
  display: "block",
  width: "100%",
  textAlign: "center",
  backgroundColor: "#18181b",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  padding: "11px 16px",
  borderRadius: "12px",
  textDecoration: "none",
  marginTop: "12px",
};

export default function BoutonPDF({ type, devis, bon, travail, clients }) {
  // Adresse de facturation : elle vit sur la fiche client, pas sur le
  // document. On la joint ici pour que le PDF la porte.
  const ficheDevis = (clients || []).find((c) => c.id === devis?.clientId || c.nom === devis?.clientNom);
  const ficheBon = (clients || []).find((c) => c.nom === bon?.client);
  // @react-pdf/renderer a son propre moteur de rendu : le contexte ne
  // traverse pas jusqu'aux documents. On lit donc la configuration ici
  // (on est encore dans l.arbre normal) et on la passe en propriété.
  const config = useEntreprise();
  let doc = null;
  let fichier = "document.pdf";

  if (type === "devis") {
    doc = <DevisPDF devis={{ ...devis, adresseFacturation: ficheDevis?.adresseFacturation, adresseTravaux: devis?.adresseTravaux || ficheDevis?.adresses?.[0]?.ligne1 }} config={config} />;
    fichier = `Devis-${devis?.numero || ""}.pdf`;
  } else if (type === "facture") {
    const factures = bon?.facturesEmises || [];
    const num = factures[factures.length - 1]?.numeroFactureQb || bon?.client || "facture";
    doc = <FacturePDF bon={{ ...bon, adresseFacturation: ficheBon?.adresseFacturation }} config={config} />;
    fichier = `Facture-${num}.pdf`;
  } else if (type === "bon-travail") {
    doc = <BonTravailPDF travail={travail} clients={clients} config={config} />;
    const client = (clients || []).find((c) => c.id === travail?.clientId);
    fichier = `Bon-de-travail-${client?.nom || ""}.pdf`;
  }

  return (
    <PDFDownloadLink document={doc} fileName={fichier} style={styleLien}>
      {({ loading }) => (loading ? "Préparation du PDF…" : "Télécharger le PDF")}
    </PDFDownloadLink>
  );
}
