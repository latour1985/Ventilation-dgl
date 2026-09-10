// components/ContactEntreprise.jsx
//
// 📞 « CONTACTER L'ENTREPRISE » (2026-09-10, audit Copilot — retenu par
// le propriétaire) : sur chaque page publique (devis, bon de travail,
// facture), le client a deux gros boutons pour appeler ou écrire à
// l'entreprise — sans chercher les coordonnées en petit dans l'en-tête.
// Un devis qui soulève une question devient un appel, pas un silence.
// Rien ne s'affiche si l'entreprise n'a ni téléphone ni courriel, et
// le bloc disparaît à l'impression (print:hidden) — il n'appartient
// pas au document officiel.
export default function ContactEntreprise({ nom, telephone, courriel }) {
  const tel = String(telephone || "").trim();
  const mail = String(courriel || "").trim();
  if (!tel && !mail) return null;
  return (
    <div className="mt-4 rounded-2xl bg-white p-4 text-center print:hidden">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Une question ? Contactez-nous</p>
      {nom ? <p className="mt-1 text-sm font-extrabold text-[#131B2E]">{nom}</p> : null}
      <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
        {tel && (
          <a
            href={`tel:${tel.replace(/[^\d+]/g, "")}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#131B2E] px-5 py-2.5 text-sm font-bold text-white active:scale-[0.99]"
          >
            📞 Appeler — {tel}
          </a>
        )}
        {mail && (
          <a
            href={`mailto:${mail}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 active:scale-[0.99]"
          >
            ✉️ Écrire un courriel
          </a>
        )}
      </div>
    </div>
  );
}
