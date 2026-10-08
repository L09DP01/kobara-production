type EditorialSignalBarProps = {
  kind: "solution" | "resource";
  slug: string;
};

const solutionSignals: Record<string, string[]> = {
  ecommerce: ["Panier", "Checkout", "Paiement", "Commande"],
  woocommerce: ["Boutique", "Extension", "Kobara", "Statut"],
  saas: ["API", "Paiement", "Webhook", "Produit"],
  "mobile-apps": ["Application", "Serveur", "Checkout", "Retour"],
  marketplaces: ["Plateforme", "Référence", "Paiement", "Rapport"],
  agencies: ["Agence", "Marchand", "API", "Suivi"],
  "small-business": ["Vente", "Lien ou QR", "Paiement", "Solde"],
  creators: ["Audience", "Partage", "Checkout", "Reçu"],
};

const resourceSignals: Record<string, string[]> = {
  guides: ["Découvrir", "Configurer", "Encaisser", "Suivre"],
  blog: ["Marché", "Produit", "Technique", "Opérations"],
  help: ["Question", "Diagnostic", "Réponse", "Support"],
  faq: ["Compte", "Paiement", "Retrait", "API"],
  security: ["Identité", "Accès", "Transaction", "Alerte"],
  changelog: ["Version", "Changement", "Impact", "Action"],
  status: ["Dashboard", "API", "Checkout", "Webhooks"],
};

export function EditorialSignalBar({ kind, slug }: EditorialSignalBarProps) {
  const labels = (kind === "solution" ? solutionSignals : resourceSignals)[slug] ?? ["Kobara", "Paiement", "Confirmation", "Suivi"];
  const accent = kind === "solution" ? "#F45D2C" : "#315FCC";

  return (
    <div className="mt-14 overflow-hidden border-y border-[#D9DDE2] bg-white/75" aria-label={kind === "solution" ? "Parcours de la solution" : "Repères de la ressource"}>
      <svg viewBox="0 0 1200 128" role="img" className="h-auto min-h-[104px] w-full min-w-[760px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`signal-${kind}-${slug}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FBCDB1" />
            <stop offset="0.5" stopColor={accent} />
            <stop offset="1" stopColor="#10131D" />
          </linearGradient>
        </defs>
        <path d="M64 64H1136" stroke="#D9DDE2" strokeWidth="1" />
        <path d="M64 64H1136" stroke={`url(#signal-${kind}-${slug})`} strokeWidth="2" strokeDasharray={kind === "resource" ? "3 11" : "0"} />
        {labels.map((label, index) => {
          const x = 110 + index * 326;
          const active = index === 1 || index === 2;
          return (
            <g key={label}>
              <circle cx={x} cy="64" r={active ? 22 : 15} fill="white" stroke={active ? accent : "#10131D"} strokeWidth={active ? 2 : 1.5} />
              <circle cx={x} cy="64" r={active ? 6 : 4} fill={active ? accent : "#10131D"} />
              {kind === "resource" && <circle cx={x} cy="64" r={active ? 31 : 24} fill="none" stroke={accent} strokeOpacity="0.16" />}
              <text x={x} y="108" textAnchor="middle" fill="#5C5E66" fontSize="12" fontWeight="600">{label}</text>
              <text x={x} y="25" textAnchor="middle" fill="#9D9EA3" fontSize="10" fontWeight="700">0{index + 1}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
