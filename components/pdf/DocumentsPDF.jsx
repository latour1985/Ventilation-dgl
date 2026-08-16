// components/pdf/DocumentsPDF.jsx
//
// Définitions PDF (via @react-pdf/renderer) des documents client :
// devis, facture et bon de travail. Le MÊME rendu servira plus tard de
// pièce jointe au courriel envoyé au client (généré côté backend).
//
// Note : on n'utilise que la police intégrée Helvetica (encodage WinAnsi),
// donc pas de caractères hors Latin-1 (ex. pas de flèche « → »).

import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// En-tête : logo de l'entreprise + coordonnées côte à côte.
const sLogo = {
  rangee: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 46, height: 40, objectFit: "contain", marginRight: 10 },
  infos: { flex: 1 },
  logoPied: { width: 14, height: 12, objectFit: "contain", marginRight: 5 },
  rangeePied: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10 },
};

// Grille de photos de chantier (avant/après) intégrée au bon de travail.
const sPhotos = {
  rangee: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  photo: { width: 118, height: 88, objectFit: "cover", borderRadius: 4, marginRight: 6, marginBottom: 6 },
};

// Repli si aucune configuration n'est fournie (voir lib/supabase/entreprise.js).
const CONFIG_REPLI = { nomLegal: "Ventilation DGL inc.", tauxTps: 5, tauxTvq: 9.975 };
const tauxAffiche = (t) => String(t ?? 0).replace(".", ",");
const argent = (n) => `${Number(n || 0).toFixed(2)} $`;

const sAdr = { rangee: { flexDirection: "row", marginTop: 6 }, col: { width: "50%", paddingRight: 8 } };

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9, color: "#334155", fontFamily: "Helvetica", lineHeight: 1.4 },
  header: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 6, marginBottom: 10 },
  company: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#131B2E" },
  small: { fontSize: 8, color: "#64748b" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#131B2E", marginTop: 4 },
  meta: { fontSize: 8, color: "#64748b", marginTop: 1 },
  clientName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1e293b", marginTop: 1 },
  block: { marginTop: 6 },
  descBox: { backgroundColor: "#f8fafc", padding: 8, borderRadius: 4, marginTop: 3, fontSize: 8, color: "#475569" },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginTop: 10 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#94a3b8" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingVertical: 3 },
  cDesc: { width: "54%" },
  cQte: { width: "12%", textAlign: "center" },
  cPrix: { width: "17%", textAlign: "right" },
  cMont: { width: "17%", textAlign: "right" },
  cell: { fontSize: 8, color: "#475569" },
  cellStrong: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1e293b" },
  // Description de l'item sous son nom — plus petite et grise, pour
  // rester lisible sans voler la vedette au nom du produit.
  cellDesc: { fontSize: 7, color: "#64748b", marginTop: 1.5, lineHeight: 1.35 },
  totals: { marginTop: 8 },
  tRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  tLabel: { fontSize: 8, color: "#64748b" },
  tVal: { fontSize: 8, color: "#475569" },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 4, marginTop: 4 },
  grandLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  grandVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  termsTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#64748b", marginTop: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 },
  clause: { fontSize: 7.5, color: "#475569", marginTop: 5 },
  sub: { fontSize: 7.5, color: "#475569", marginTop: 2, marginLeft: 10 },
  bold: { fontFamily: "Helvetica-Bold", color: "#1e293b" },
  semibold: { fontFamily: "Helvetica-Bold", color: "#334155" },
  merci: { fontSize: 8, fontStyle: "italic", color: "#64748b", textAlign: "center", marginTop: 8 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  sigField: { width: "45%" },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#cbd5e1", height: 24 },
  sigLabel: { fontSize: 7, color: "#94a3b8", marginTop: 3 },
  signed: { backgroundColor: "#ecfdf5", color: "#047857", fontSize: 8, fontFamily: "Helvetica-Bold", padding: 6, borderRadius: 4, marginTop: 12 },
  footer: { fontSize: 7, color: "#94a3b8", textAlign: "center", marginTop: 16 },
});

const CLAUSES = [
  { t: "1. Validité du prix.", c: "Les prix indiqués sur nos devis sont valides pour une durée de 30 jours à compter de la date d'émission. En raison des ajustements de prix fréquents de la part de nos distributeurs et fournisseurs, les tarifs seront maintenus pour une période maximale de 30 jours à la suite de l'acceptation formelle du devis." },
  { t: "2. Ordre des travaux et exclusions.", c: "", subs: [
    { st: "Ordre de réalisation :", sc: " pour garantir la conformité et le bon déroulement du chantier, la séquence d'exécution s'effectue dans l'ordre suivant : 1. Plomberie, 2. Ventilation, puis 3. Électricité." },
    { st: "Câblage électrique préalable (résidentiel seulement) :", sc: " l'installation de la ventilation doit précéder le passage des fils électriques. Si l'électricien intervient avant l'équipe de ventilation, des frais supplémentaires de 1 000 $ + taxes seront facturés en raison du ralentissement et du prolongement des travaux. Ventilation DGL inc. ne sera aucunement responsable en cas de bris ou de dommage aux fils électriques." },
    { st: "Travaux exclus :", sc: " sauf mention explicite et détaillée sur le devis, tous les travaux d'électricité, de plomberie ou de menuiserie sont strictement exclus de notre offre de service." },
  ] },
  { t: "3. Responsabilité et dommages cachés.", c: "Ventilation DGL inc. ne pourra être tenue responsable des dommages causés à des éléments ou structures cachés (tels que la tuyauterie, le câblage ou l'ossature) situés derrière un mur, un plafond ou un plancher qui n'était pas ouvert ou accessible lors de l'évaluation initiale et de l'établissement de la soumission." },
  { t: "4. Politiques d'annulation et de modification de rendez-vous.", c: "Afin d'assurer la gestion et la planification efficace de nos équipes sur le terrain, les conditions suivantes s'appliquent :", subs: [
    { st: "Appels de service :", sc: " un préavis minimal de 24 heures est requis pour toute annulation ou modification. À défaut de respecter ce délai, le dépôt versé lors de la réservation sera non remboursable et conservé à titre de frais d'administration et d'immobilisation de plage horaire." },
    { st: "Travaux d'une journée complète ou plus :", sc: " un préavis minimal de 72 heures ouvrables est requis. En cas d'annulation ou de report dans un délai inférieur à 72 heures ouvrables, des frais fixes équivalents à 3 heures de déplacement pour 2 techniciens au tarif régulier en vigueur seront facturés." },
  ] },
  { t: "5. Travaux en temps et matériel (T&M).", c: "Dans le cadre de travaux effectués en mode « temps et matériel » (facturés au taux horaire auquel s'ajoute le coût des matériaux), la signature du bon de travail par le client atteste de la réception des travaux et de son entière satisfaction à l'égard du travail accompli. En cas de demande de modification ultérieure ou d'omission constatée après la signature du bon de travail, tout retour sur place fera l'objet d'une nouvelle intervention et le client s'engage à assumer à nouveau les frais de déplacement minimaux ainsi que les heures de main-d'œuvre et les matériaux requis." },
  { t: "6. Litige et paiement.", c: "Les factures sont payables selon les conditions convenues sur le devis. En cas de litige ou de défaut de paiement à la suite des travaux effectués, le recouvrement du solde pourra être porté devant les tribunaux compétents. Tous les frais judiciaires et d'avocat engagés pour la perception seront entièrement à la charge du client s'il est reconnu en défaut." },
  { t: "7. Intérêts sur les paiements en retard.", c: "Si les termes de paiement ne sont pas respectés, des intérêts de 2 % par mois de retard pourront être facturés, pour un total de 24 % annuellement." },
  { t: "8. Preuve d'acceptation et prévalence du contrat.", c: "L'acceptation du devis par le client — qu'elle soit effectuée par écrit, par signature électronique ou manuscrite, par confirmation verbale, par l'émission d'un bon de travail ou de commande, ou par toute autre forme de communication — constitue un consentement ferme. Le présent devis ainsi que ses termes et conditions priment et prévalent expressément sur tout autre document ou contrat qui pourrait être signé ou soumis ultérieurement par le client ou un tiers, sauf modification écrite dûment approuvée par Ventilation DGL inc." },
  { t: "9. Validité continue des conditions.", c: "Les présents termes et conditions demeurent pleinement en vigueur pour l'ensemble des travaux, même lorsqu'ils ne sont pas reproduits sur un document émis par la suite — notamment sur la facture. Ayant été acceptés par le client lors de l'autorisation des travaux (signature du devis, du bon de commande ou du bon de travail, ou toute autre forme d'acceptation prévue à la clause 8), ils continuent de régir l'exécution des travaux, la facturation et le paiement, sans qu'il soit nécessaire de les rappeler sur chaque document subséquent." },
];

// `config` vient des Paramètres de l'entreprise (transmis par
// BoutonPDF) : plus rien n'est écrit en dur ici.
function EnTetePDF({ config }) {
  const e = config || CONFIG_REPLI;
  // Ligne RBQ + CMMTQ : chaque morceau ne s'affiche que s'il existe.
  const assoc = Array.isArray(e.associations) ? e.associations : e.membreCmmtq ? ["cmmtq"] : [];
  const ligneRbq = [
    e.numeroRbq ? `RBQ# ${e.numeroRbq}` : null,
    assoc.includes("cmmtq") ? "Membre de la CMMTQ" : null,
    assoc.includes("cetaf") ? "Membre de la CETAF" : null,
    assoc.includes("cmeq") ? "Membre de la CMEQ" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={s.header}>
      {/* LOGO + coordonnées côte à côte. Le logo est servi depuis
          /public/logo-dgl.png (fichier fourni par l'entreprise). */}
      <View style={sLogo.rangee}>
        <Image src="/logo-dgl.png" style={sLogo.logo} />
        <View style={sLogo.infos}>
          <Text style={s.company}>{e.nomLegal}</Text>
          {e.adresse ? <Text style={s.small}>{e.adresse}</Text> : null}
          {(e.telephone || e.courriel) ? <Text style={s.small}>{[e.telephone, e.courriel].filter(Boolean).join(" · ")}</Text> : null}
          {e.numeroTps ? <Text style={s.small}>Nº d'inscription TPS/TVH : {e.numeroTps}</Text> : null}
          {e.numeroTvq ? <Text style={s.small}>Nº d'enregistrement TVQ : {e.numeroTvq}</Text> : null}
          {ligneRbq ? <Text style={s.small}>{ligneRbq}</Text> : null}
        </View>
      </View>
    </View>
  );
}

// ⚠️ MULTI-ENTREPRISES : le TITRE suit la raison sociale configurée,
// mais le TEXTE des clauses ci-dessous reste propre à Ventilation DGL
// (c'est un texte juridique). Une autre entreprise devra pouvoir saisir
// ses propres conditions — à prévoir dans les Paramètres au moment de
// l'ouverture à une deuxième entreprise.
// ADRESSES SUR LE DOCUMENT — « facturé à » et « adresse des travaux ».
// Une facture sans adresse de facturation se fait retourner par la
// comptabilité du client. L'adresse des travaux ne s'affiche que si
// elle diffère : la répéter n'ajoute rien et allonge le document.
function AdressesPDF({ clientNom, adresseFacturation, adresseTravaux }) {
  const differente =
    adresseTravaux && adresseTravaux.trim() && adresseTravaux.trim() !== (adresseFacturation || '').trim();
  return (
    <View style={sAdr.rangee}>
      <View style={sAdr.col}>
        <Text style={s.meta}>Facturé à :</Text>
        <Text style={s.clientName}>{clientNom || '—'}</Text>
        {adresseFacturation ? <Text style={s.small}>{adresseFacturation}</Text> : null}
      </View>
      {differente ? (
        <View style={sAdr.col}>
          <Text style={s.meta}>Adresse des travaux :</Text>
          <Text style={s.small}>{adresseTravaux}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TermesPDF({ config }) {
  const e = config || CONFIG_REPLI;
  return (
    <View>
      <Text style={s.termsTitle}>TERMES ET CONDITIONS GÉNÉRALES — {(e.nomLegal || "").toUpperCase()}</Text>
      {CLAUSES.map((cl, i) => (
        <View key={i}>
          <Text style={s.clause}>
            <Text style={s.bold}>{cl.t} </Text>
            {cl.c}
          </Text>
          {cl.subs?.map((sb, j) => (
            <Text key={j} style={s.sub}>
              <Text style={s.semibold}>{sb.st}</Text>
              {sb.sc}
            </Text>
          ))}
        </View>
      ))}
      <Text style={s.merci}>Merci de votre collaboration et de votre confiance.</Text>
    </View>
  );
}

function LigneTotaux({ sousTotal, config }) {
  const e = config || CONFIG_REPLI;
  const tps = sousTotal * ((e.tauxTps ?? 5) / 100);
  const tvq = sousTotal * ((e.tauxTvq ?? 9.975) / 100);
  const total = sousTotal + tps + tvq;
  return (
    <View style={s.totals}>
      <View style={s.tRow}><Text style={s.tLabel}>Sous-total</Text><Text style={s.tVal}>{argent(sousTotal)}</Text></View>
      <View style={s.tRow}><Text style={s.tLabel}>TPS ({tauxAffiche(e.tauxTps)}%)</Text><Text style={s.tVal}>{argent(tps)}</Text></View>
      <View style={s.tRow}><Text style={s.tLabel}>TVQ ({tauxAffiche(e.tauxTvq)}%)</Text><Text style={s.tVal}>{argent(tvq)}</Text></View>
      <View style={s.grand}><Text style={s.grandLabel}>Total</Text><Text style={s.grandVal}>{argent(total)}</Text></View>
    </View>
  );
}

function PiedPage({ config }) {
  const e = config || CONFIG_REPLI;
  const ligne = [
    `© ${new Date().getFullYear()} ${e.nomLegal}`,
    e.numeroRbq ? `RBQ# ${e.numeroRbq}` : null,
    e.membreCmmtq ? "Membre de la CMMTQ" : null,
  ].filter(Boolean).join(" · ");
  return (
    <View style={sLogo.rangeePied}>
      <Image src="/logo-dgl.png" style={sLogo.logoPied} />
      <Text style={[s.footer, { marginTop: 0 }]}>{ligne}</Text>
    </View>
  );
}

export function DevisPDF({ devis, config }) {
  const lignes = devis?.lignes || [];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <EnTetePDF config={config} />
        <Text style={s.title}>DEVIS {devis?.numero}</Text>
        <Text style={s.meta}>Date : {devis?.date}</Text>
        <AdressesPDF clientNom={devis?.clientNom} adresseFacturation={devis?.adresseFacturation} adresseTravaux={devis?.adresseTravaux} />

        <View style={s.tableHead}>
          <Text style={[s.th, s.cDesc]}>Description</Text>
          <Text style={[s.th, s.cQte]}>Qté</Text>
          <Text style={[s.th, s.cPrix]}>Prix</Text>
          <Text style={[s.th, s.cMont]}>Montant</Text>
        </View>
        {lignes.map((l) => (
          <View style={s.row} key={l.uid} wrap={false}>
            <View style={s.cDesc}>
              <Text style={s.cellStrong}>{l.nom || "—"}</Text>
              {/* DESCRIPTION — modèles, garantie, numéros AHRI, ce qui
                  est inclus. C'est l'argumentaire de vente : il doit
                  être sur le PDF que le client reçoit, pas seulement à
                  l'écran du bureau. Les sauts de ligne de QuickBooks
                  sont conservés tels quels. */}
              {l.description ? <Text style={s.cellDesc}>{l.description}</Text> : null}
            </View>
            <Text style={[s.cell, s.cQte]}>{l.quantite}</Text>
            <Text style={[s.cell, s.cPrix]}>{argent(l.prix_vendant)}</Text>
            <Text style={[s.cellStrong, s.cMont]}>{argent(l.prix_vendant * l.quantite)}</Text>
          </View>
        ))}

        <LigneTotaux sousTotal={devis?.totalVendant || 0} config={config} />
        <TermesPDF config={config} />

        <View style={s.sigRow}>
          <View style={s.sigField}><View style={s.sigLine} /><Text style={s.sigLabel}>Signature du client</Text></View>
          <View style={s.sigField}><View style={s.sigLine} /><Text style={s.sigLabel}>Date</Text></View>
        </View>

        <PiedPage config={config} />
      </Page>
    </Document>
  );
}

export function FacturePDF({ bon, config }) {
  const factures = bon?.facturesEmises || [];
  const derniere = factures[factures.length - 1];
  const montant = derniere?.montant ?? bon?.montant ?? 0;
  const numero = derniere?.numeroFactureQb || "À émettre";
  const date = derniere?.date || bon?.date;
  const lignes = bon?.lignesNonListees || [];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <EnTetePDF config={config} />
        <Text style={s.title}>FACTURE {numero}</Text>
        <Text style={s.meta}>Date : {date}</Text>
        {bon?.adresseTravaux ? <Text style={s.meta}>Adresse des travaux : {bon.adresseTravaux}</Text> : null}
        <AdressesPDF clientNom={bon?.client} adresseFacturation={bon?.adresseFacturation} adresseTravaux={bon?.adresseTravaux} />

        {lignes.length > 0 ? (
          <View>
            <View style={s.tableHead}>
              <Text style={[s.th, { width: "80%" }]}>Description</Text>
              <Text style={[s.th, { width: "20%", textAlign: "right" }]}>Montant</Text>
            </View>
            {lignes.map((it) => (
              <View style={s.row} key={it.id}>
                <Text style={[s.cell, { width: "80%" }]}>{it.description}</Text>
                <Text style={[s.cellStrong, { width: "20%", textAlign: "right" }]}>{argent(parseFloat(it.prix))}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.block}>
            <Text style={s.descBox}>{derniere?.detail || bon?.description || bon?.projet}</Text>
          </View>
        )}

        <LigneTotaux sousTotal={montant} config={config} />
        <TermesPDF config={config} />
        <PiedPage config={config} />
      </Page>
    </Document>
  );
}

export function BonTravailPDF({ travail, clients, config }) {
  const client = (clients || []).find((c) => c.id === travail?.clientId);
  const adresse = travail?.adresseTravaux || (client?.adresses?.[0] ? `${client.adresses[0].nom} — ${client.adresses[0].ligne1}` : null);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <EnTetePDF config={config} />
        <Text style={s.title}>BON DE TRAVAIL</Text>
        <Text style={s.meta}>Date : {travail?.date}</Text>
        {adresse ? <Text style={s.meta}>Adresse des travaux : {adresse}</Text> : null}
        <Text style={[s.meta, { marginTop: 4 }]}>Client :</Text>
        <Text style={s.clientName}>{client?.nom || "—"}</Text>

        <View style={s.block}>
          <Text style={[s.th, { marginBottom: 2 }]}>DESCRIPTION DES TRAVAUX</Text>
          <Text style={s.descBox}>{travail?.noteTerrain || travail?.titre || "Détails à venir."}</Text>
        </View>

        {/* PHOTOS DU CHANTIER (avant/après) — les vraies images prises par
            le technicien, intégrées au document envoyé au client. */}
        {travail?.photosAvantUrls?.length > 0 ? (
          <View style={s.block}>
            <Text style={[s.th, { marginBottom: 2 }]}>PHOTOS AVANT TRAVAUX</Text>
            <View style={sPhotos.rangee}>
              {travail.photosAvantUrls.map((u, i) => (
                <Image key={i} src={u} style={sPhotos.photo} />
              ))}
            </View>
          </View>
        ) : null}
        {travail?.photosApresUrls?.length > 0 ? (
          <View style={s.block}>
            <Text style={[s.th, { marginBottom: 2 }]}>PHOTOS APRES TRAVAUX</Text>
            <View style={sPhotos.rangee}>
              {travail.photosApresUrls.map((u, i) => (
                <Image key={i} src={u} style={sPhotos.photo} />
              ))}
            </View>
          </View>
        ) : null}

        {travail?.montant != null ? (
          <View style={s.grand}><Text style={s.grandLabel}>Montant</Text><Text style={s.grandVal}>{argent(travail.montant)}</Text></View>
        ) : null}

        <TermesPDF config={config} />

        <Text style={s.signed}>Signé électroniquement par le client à la fin de l'intervention.</Text>
        <PiedPage config={config} />
      </Page>
    </Document>
  );
}

// ============================================================
// BON DE TRAVAIL PUBLIC — le PDF que le CLIENT télécharge depuis la
// page /bon/[jeton]. Un DESCRIPTIF : description, photos avant/après
// avec leurs légendes, signature. JAMAIS de prix, d'heures ni de
// conditions de vente — ni soumission ni facture (décision du
// propriétaire, 2026-08-15). `bon` vient de chargerBonPublic().
// ============================================================
const sPhotoLegende = {
  bloc: { width: 118, marginRight: 6, marginBottom: 6 },
  legende: { fontSize: 6.5, color: "#64748b", marginTop: 1.5, lineHeight: 1.3 },
};

function GrillePhotosPDF({ titre, urls, legendes }) {
  if (!urls?.length) return null;
  return (
    <View style={s.block}>
      <Text style={[s.th, { marginBottom: 2 }]}>{titre}</Text>
      <View style={sPhotos.rangee}>
        {urls.map((u, i) => (
          <View key={i} style={sPhotoLegende.bloc}>
            <Image src={u} style={[sPhotos.photo, { marginRight: 0, marginBottom: 0 }]} />
            {legendes?.[u] ? <Text style={sPhotoLegende.legende}>{legendes[u]}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function BonTravailPublicPDF({ bon, config }) {
  const unites = (bon?.unites || []).filter((u) => (u.modele || "").trim() || (u.serie || "").trim());
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <EnTetePDF config={config} />
        <Text style={s.title}>BON DE TRAVAIL — TRAVAUX RÉALISÉS</Text>
        <Text style={s.meta}>Date des travaux : {bon?.date || "—"}</Text>
        {bon?.adresseTravaux ? <Text style={s.meta}>Adresse des travaux : {bon.adresseTravaux}</Text> : null}
        <Text style={[s.meta, { marginTop: 4 }]}>Client :</Text>
        <Text style={s.clientName}>{bon?.clientNom || "—"}</Text>

        <View style={s.block}>
          <Text style={[s.th, { marginBottom: 2 }]}>DESCRIPTION DES TRAVAUX</Text>
          <Text style={s.descBox}>{bon?.description || bon?.titre || "Voir les photos ci-dessous."}</Text>
        </View>

        {unites.length > 0 ? (
          <View style={s.block}>
            <Text style={[s.th, { marginBottom: 2 }]}>ÉQUIPEMENT VÉRIFIÉ</Text>
            {unites.map((u, i) => (
              <Text key={i} style={s.cell}>
                {u.modele || "—"}{u.serie ? ` · Nº de série ${u.serie}` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        <GrillePhotosPDF titre="PHOTOS AVANT TRAVAUX" urls={bon?.photosAvant} legendes={bon?.legendes} />
        <GrillePhotosPDF titre="PHOTOS APRES TRAVAUX" urls={bon?.photosApres} legendes={bon?.legendes} />

        {bon?.clientAbsent ? (
          <Text style={s.signed}>Client absent à la fin des travaux — bon transmis sans signature.</Text>
        ) : bon?.signeParNom ? (
          <Text style={s.signed}>Signé électroniquement par : {bon.signeParNom}</Text>
        ) : null}

        <Text style={[s.footer, { marginTop: 12 }]}>
          Document descriptif des travaux réalisés — ne constitue ni une soumission ni une facture.
        </Text>
        <PiedPage config={config} />
      </Page>
    </Document>
  );
}
