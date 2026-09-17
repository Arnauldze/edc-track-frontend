"use client";

// ══════════════════════════════════════════════════════════════
// FinancementEditor — saisie du financement d'un projet
// Utilisé à la création (assistant) et à la modification (détail projet).
// Une ligne par source : montant, devise, équivalent en FCFA et part du
// budget. Budget et pourcentages sont affichés en direct ; le serveur les
// recalcule à l'enregistrement avec le même algorithme (lib/financement.ts).
// ══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Handshake, Landmark, Plus, Trash2, X } from "lucide-react";
import { type CurrencyContribution } from "@/components/financing/BailleurMultiCurrency";
import { ExchangeRateModal } from "@/components/financing/ExchangeRateModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CURRENCIES, formatCurrency } from "@/lib/helpers/currencyHelpers";
import { formatMoney } from "@/lib/utils";
import {
  BASE_CURRENCY,
  computeFinancementPreview,
  newContribution,
  newId,
  sourcesDroppedBySwitch,
  validateFinancement,
  type FinancementFormValue,
  type PartieForm,
} from "@/lib/financement";

const BAILLEURS_LIST = [
  "Banque Mondiale",
  "BAD (Banque Africaine de Développement)",
  "BDEAC",
  "AFD (Agence Française de Développement)",
  "Eximbank China",
  "KfW",
  "BEI (Banque Européenne d'Investissement)",
  "Banque Islamique de Développement",
  "JICA (Japan International Cooperation Agency)",
  "FMI",
  "BADEA",
  "Fonds Koweïtien",
  "Fonds Saoudien",
  "Fonds OPEP",
  "BID (Banque Interaméricaine de Développement)",
];

/** Couleurs des sources dans la barre de répartition (classes écrites en entier pour Tailwind). */
export const SOURCE_COLORS = ["bg-type-services", "bg-type-travaux", "bg-type-etudes", "bg-type-fourniture", "bg-type-pi", "bg-accent"];
export const sourceColor = (index: number) => SOURCE_COLORS[index % SOURCE_COLORS.length];

interface FinancementEditorProps {
  value: FinancementFormValue;
  onChange: (value: FinancementFormValue) => void;
  /** Afficher les erreurs de validation (après une tentative d'enregistrement). */
  showErrors?: boolean;
}

type PartieKey = "partiesPubliques" | "partiesPrivees";

const inputClass =
  "h-9 bg-surface border border-line rounded-[var(--radius-sm)] px-2.5 text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors";

const toNumber = (text: string) => {
  const n = parseFloat(String(text).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

/** Montant d'une source : saisie et devise dans un même champ. */
function MontantField({ montant, devise, onMontant, onDevise, label }: { montant: string; devise: string; onMontant: (v: string) => void; onDevise: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center h-9 w-[260px] max-w-full bg-surface border border-line rounded-[var(--radius-sm)] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-colors">
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={montant}
        onChange={(e) => onMontant(e.target.value)}
        placeholder="0"
        className="min-w-0 flex-1 h-full bg-transparent px-2.5 text-[13px] tabular-nums text-fg placeholder:text-fg-subtle focus:outline-none"
      />
      <select
        aria-label={`Devise — ${label}`}
        value={devise}
        onChange={(e) => onDevise(e.target.value)}
        className="h-full bg-transparent border-l border-line pl-2 pr-1 text-[12.5px] font-semibold text-fg focus:outline-none cursor-pointer"
      >
        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
      </select>
    </div>
  );
}

export function FinancementEditor({ value, onChange, showErrors = false }: FinancementEditorProps) {
  const [showBailleurPicker, setShowBailleurPicker] = useState(false);
  const [bailleurSearch, setBailleurSearch] = useState("");
  const [showRates, setShowRates] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ title: string; message: string; apply: () => void } | null>(null);

  const preview = useMemo(() => computeFinancementPreview(value), [value]);
  const errors = useMemo(() => validateFinancement(value), [value]);
  const pctOf = (id: string) => preview.sources[id]?.pct ?? 0;
  const amountOf = (id: string) => preview.sources[id]?.amount ?? 0;

  const update = (patch: Partial<FinancementFormValue>) => onChange({ ...value, ...patch });
  const hiddenSources = sourcesDroppedBySwitch(value);

  // ── Bailleurs ──
  const availableBailleurs = BAILLEURS_LIST.filter(
    (nom) => !value.bailleurs.some((b) => b.nom === nom) && nom.toLowerCase().includes(bailleurSearch.toLowerCase()),
  );

  const addBailleur = (nom: string) => {
    const trimmed = nom.trim();
    if (!trimmed) return;
    if (value.bailleurs.some((b) => b.nom.toLowerCase() === trimmed.toLowerCase())) return;
    update({ bailleurs: [...value.bailleurs, { id: newId("b"), nom: trimmed, contributions: [newContribution()] }] });
    setBailleurSearch("");
    setShowBailleurPicker(false);
  };

  const setContributions = (id: string, contributions: CurrencyContribution[]) =>
    update({ bailleurs: value.bailleurs.map((b) => (b.id === id ? { ...b, contributions } : b)) });

  const askRemove = (title: string, message: string, apply: () => void) => setPendingRemoval({ title, message, apply });

  // ── Parties PPP ──
  const addPartie = (key: PartieKey) =>
    update({ [key]: [...value[key], { id: newId(key === "partiesPubliques" ? "pub" : "priv"), nom: "", montant: "", devise: BASE_CURRENCY }] });

  const updatePartie = (key: PartieKey, id: string, patch: Partial<PartieForm>) =>
    update({ [key]: value[key].map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  // ── Répartition ──
  const repartition: { id: string; nom: string; pct: number; color: string }[] = [];
  if (value.type === "MOP") {
    if (value.budgetNational.enabled) repartition.push({ id: "national", nom: "Budget national", pct: pctOf("national"), color: sourceColor(0) });
    value.bailleurs.forEach((b, i) => repartition.push({ id: b.id, nom: b.nom, pct: pctOf(b.id), color: sourceColor(i + 1) }));
  } else {
    [...value.partiesPubliques, ...value.partiesPrivees].forEach((p, i) =>
      repartition.push({ id: p.id, nom: p.nom || "Sans nom", pct: pctOf(p.id), color: sourceColor(i) }),
    );
  }

  const foreignCurrencies = preview.usedCurrencies.filter((c) => c !== BASE_CURRENCY);
  const equivalentFCFA = (montant: string, devise: string) => {
    const brut = toNumber(montant);
    if (!brut || devise === BASE_CURRENCY) return "";
    const rate = value.tauxChange[devise];
    return rate ? `≈ ${formatMoney(brut * rate, 0)} FCFA` : "taux de change manquant";
  };

  // ── Rendu d'une source ──
  const sourceCard = (
    { color, titre, sousTitre, pct, onRemove, children }:
    { color: string; titre: React.ReactNode; sousTitre?: React.ReactNode; pct: number; onRemove?: () => void; children: React.ReactNode },
  ) => (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-3 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${color}`} aria-hidden />
        <div className="flex-1 min-w-0">{titre}</div>
        {sousTitre && <span className="text-[11.5px] text-fg-subtle whitespace-nowrap">{sousTitre}</span>}
        <span className="w-14 text-right text-[13px] font-semibold tabular-nums text-fg" title="Part du budget, calculée à partir des montants">
          {pct.toFixed(1).replace(".", ",")} %
        </span>
        <span className="w-6 flex justify-end">
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-fg-subtle hover:text-danger transition-colors" title="Retirer">
              <Trash2 size={15} />
            </button>
          )}
        </span>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Mode de financement ── */}
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-fg-muted">Mode de financement</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {([
            ["MOP", Landmark, "Maîtrise d'ouvrage publique (MOP)", "L'État finance, seul ou avec des bailleurs de fonds."],
            ["PPP", Handshake, "Partenariat public-privé (PPP)", "Des parties publiques et privées se partagent le financement."],
          ] as const).map(([type, Icon, titre, texte]) => {
            const actif = value.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => type !== value.type && update({ type })}
                aria-pressed={actif}
                className={`flex-1 flex gap-3 text-left px-4 py-3.5 rounded-[var(--radius-md)] border transition-colors ${actif ? "border-primary bg-primary-subtle ring-1 ring-primary" : "border-line bg-surface hover:border-line-strong"}`}
              >
                <span className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-full border-[1.5px] ${actif ? "border-[5px] border-primary bg-surface" : "border-line-strong"}`} aria-hidden />
                <span className="min-w-0">
                  <span className={`flex items-center gap-2 text-[13.5px] font-semibold ${actif ? "text-primary-fg" : "text-fg"}`}>
                    <Icon size={16} /> {titre}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{texte}</span>
                </span>
              </button>
            );
          })}
        </div>
        {hiddenSources > 0 && (
          <div className="flex gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-warning" />
            <p className="text-[12px] leading-relaxed text-fg-muted">
              {hiddenSources} source{hiddenSources > 1 ? "s" : ""} saisie{hiddenSources > 1 ? "s" : ""} en {value.type === "MOP" ? "PPP" : "MOP"} ne {hiddenSources > 1 ? "seront" : "sera"} pas enregistrée{hiddenSources > 1 ? "s" : ""} : un projet {value.type} ne retient que ses propres sources. Revenez en {value.type === "MOP" ? "PPP" : "MOP"} pour les conserver.
            </p>
          </div>
        )}
      </section>

      {/* ── Sources ── */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[12px] font-semibold text-fg-muted">Sources de financement</h3>
          <p className="text-[12px] text-fg-subtle">
            {foreignCurrencies.length > 0
              ? foreignCurrencies.map((c) => `1 ${c} = ${formatMoney(value.tauxChange[c] ?? 0, value.tauxChange[c] && value.tauxChange[c] < 10 ? 3 : 0)} FCFA`).join(" · ")
              : "Montants convertis en FCFA"}
            {" · "}
            <button type="button" onClick={() => setShowRates(true)} className="font-semibold text-primary-fg hover:underline">
              Modifier les taux
            </button>
          </p>
        </div>

        {value.type === "MOP" ? (
          <>
            {sourceCard({
              color: sourceColor(0),
              titre: (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.budgetNational.enabled}
                    onChange={(e) => update({ budgetNational: { ...value.budgetNational, enabled: e.target.checked } })}
                    className="w-4 h-4 accent-[var(--primary)]"
                  />
                  <span className="text-[13px] font-semibold text-fg">Budget national</span>
                  <span className="text-[11.5px] text-fg-subtle">État du Cameroun</span>
                </label>
              ),
              pct: value.budgetNational.enabled ? pctOf("national") : 0,
              children: value.budgetNational.enabled ? (
                <div className="flex flex-wrap items-center gap-3">
                  <MontantField
                    label="Montant du budget national"
                    montant={value.budgetNational.montant}
                    devise={value.budgetNational.devise}
                    onMontant={(montant) => update({ budgetNational: { ...value.budgetNational, montant } })}
                    onDevise={(devise) => update({ budgetNational: { ...value.budgetNational, devise } })}
                  />
                  <span className="text-[12px] tabular-nums text-fg-muted">{equivalentFCFA(value.budgetNational.montant, value.budgetNational.devise)}</span>
                </div>
              ) : (
                <p className="text-[12px] text-fg-subtle">Cochez pour inscrire une part financée par l&apos;État.</p>
              ),
            })}

            {value.bailleurs.map((b, i) => (
              <div key={b.id}>
                {sourceCard({
                  color: sourceColor(i + 1),
                  titre: <span className="block truncate text-[13px] font-semibold text-fg">{b.nom}</span>,
                  sousTitre: "Bailleur",
                  pct: pctOf(b.id),
                  onRemove: () => askRemove("Retirer le bailleur", `Retirer « ${b.nom} » du financement ? Le budget sera recalculé.`, () => update({ bailleurs: value.bailleurs.filter((x) => x.id !== b.id) })),
                  children: (
                    <div className="space-y-2">
                      {b.contributions.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center gap-3">
                          <MontantField
                            label={`Contribution ${b.nom}`}
                            montant={c.montant}
                            devise={c.devise}
                            onMontant={(montant) => setContributions(b.id, b.contributions.map((x) => (x.id === c.id ? { ...x, montant } : x)))}
                            onDevise={(devise) => setContributions(b.id, b.contributions.map((x) => (x.id === c.id ? { ...x, devise } : x)))}
                          />
                          <span className="flex-1 min-w-0 text-[12px] tabular-nums text-fg-muted">{equivalentFCFA(c.montant, c.devise)}</span>
                          {b.contributions.length > 1 && (
                            <button type="button" onClick={() => setContributions(b.id, b.contributions.filter((x) => x.id !== c.id))} className="text-fg-subtle hover:text-danger transition-colors" title="Retirer cette devise">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setContributions(b.id, [...b.contributions, newContribution()])} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-fg hover:underline">
                        <Plus size={13} /> Autre devise
                      </button>
                    </div>
                  ),
                })}
              </div>
            ))}

            {showBailleurPicker ? (
              <div className="rounded-[var(--radius-md)] border border-primary bg-surface p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={bailleurSearch}
                    onChange={(e) => setBailleurSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBailleur(bailleurSearch); } if (e.key === "Escape") { setShowBailleurPicker(false); setBailleurSearch(""); } }}
                    placeholder="Nom du bailleur : choisissez dans la liste ou saisissez le vôtre"
                    className={`flex-1 min-w-0 ${inputClass}`}
                  />
                  <button type="button" onClick={() => addBailleur(bailleurSearch)} disabled={!bailleurSearch.trim()} className="h-9 px-3 rounded-[var(--radius-sm)] bg-primary text-on-primary text-[12.5px] font-semibold disabled:opacity-40">
                    Ajouter
                  </button>
                  <button type="button" onClick={() => { setShowBailleurPicker(false); setBailleurSearch(""); }} className="h-9 px-2 text-[12.5px] font-medium text-fg-muted hover:text-fg">
                    Annuler
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {availableBailleurs.length > 0 ? availableBailleurs.map((nom) => (
                    <button key={nom} type="button" onClick={() => addBailleur(nom)} className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-left text-[13px] text-fg hover:bg-hover">
                      <Building2 size={14} className="text-fg-subtle" /> {nom}
                    </button>
                  )) : (
                    <p className="px-2 py-2 text-[12px] text-fg-subtle">Aucun bailleur de la liste ne correspond : « Ajouter » enregistre le nom saisi.</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowBailleurPicker(true)}
                className="flex w-full items-center justify-center gap-2 h-10 rounded-[var(--radius-md)] border border-dashed border-line-strong text-[12.5px] font-semibold text-fg-muted hover:border-primary hover:text-primary-fg transition-colors"
              >
                <Plus size={15} /> Ajouter un bailleur
              </button>
            )}
          </>
        ) : (
          <>
            {([["partiesPubliques", "Partie publique"], ["partiesPrivees", "Partie privée"]] as const).map(([key, label]) => (
              <div key={key} className="space-y-2.5">
                {value[key].map((p, i) => (
                  <div key={p.id}>
                    {sourceCard({
                      color: sourceColor(key === "partiesPubliques" ? i : value.partiesPubliques.length + i),
                      titre: (
                        <input
                          type="text"
                          value={p.nom}
                          onChange={(e) => updatePartie(key, p.id, { nom: e.target.value })}
                          placeholder={key === "partiesPubliques" ? "Nom de l'entité publique" : "Nom de l'entité privée"}
                          className={`w-full ${inputClass} ${showErrors && !p.nom.trim() ? "border-danger" : ""}`}
                        />
                      ),
                      sousTitre: label,
                      pct: pctOf(p.id),
                      onRemove: () => askRemove("Retirer la partie", `Retirer « ${p.nom || "sans nom"} » du financement ? Le budget sera recalculé.`, () => update({ [key]: value[key].filter((x) => x.id !== p.id) })),
                      children: (
                        <div className="flex flex-wrap items-center gap-3">
                          <MontantField
                            label={`Montant — ${p.nom || label}`}
                            montant={p.montant}
                            devise={p.devise}
                            onMontant={(montant) => updatePartie(key, p.id, { montant })}
                            onDevise={(devise) => updatePartie(key, p.id, { devise })}
                          />
                          <span className="text-[12px] tabular-nums text-fg-muted">{equivalentFCFA(p.montant, p.devise)}</span>
                        </div>
                      ),
                    })}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addPartie(key)}
                  className="flex w-full items-center justify-center gap-2 h-10 rounded-[var(--radius-md)] border border-dashed border-line-strong text-[12.5px] font-semibold text-fg-muted hover:border-primary hover:text-primary-fg transition-colors"
                >
                  <Plus size={15} /> Ajouter une {label.toLowerCase()}
                </button>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ── Répartition ── */}
      <section className="rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 space-y-2">
        <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <span className="font-semibold text-fg">Répartition</span>
          <span className="font-semibold tabular-nums text-fg">{formatMoney(preview.total, 0)} FCFA</span>
        </div>
        {preview.total > 0 ? (
          <>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-inset">
              {repartition.filter((s) => s.pct > 0).map((s) => <div key={s.id} className={s.color} style={{ width: `${s.pct}%` }} title={`${s.nom} : ${s.pct.toFixed(1)} %`} />)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg-muted">
              {repartition.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-sm ${s.color}`} /> {s.nom} · <span className="tabular-nums">{s.pct.toFixed(1).replace(".", ",")} %</span>
                  <span className="text-fg-subtle tabular-nums">({formatCurrency(amountOf(s.id), BASE_CURRENCY)})</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-fg-subtle">Aucun montant saisi : le budget du projet restera à définir jusqu&apos;à l&apos;ajout d&apos;une source.</p>
        )}
      </section>

      {showErrors && errors.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-subtle px-3 py-2.5 space-y-1">
          {errors.map((error) => <p key={error} className="text-[12.5px] text-danger">{error}</p>)}
        </div>
      )}

      <ExchangeRateModal
        isOpen={showRates}
        onClose={() => setShowRates(false)}
        onSave={(rates) => update({ tauxChange: { ...rates, [BASE_CURRENCY]: 1 } })}
        currentRates={value.tauxChange}
        usedCurrencies={preview.usedCurrencies}
      />

      <ConfirmDialog
        isOpen={pendingRemoval !== null}
        title={pendingRemoval?.title ?? ""}
        message={pendingRemoval?.message ?? ""}
        confirmLabel="Retirer"
        variant="danger"
        onConfirm={() => { pendingRemoval?.apply(); setPendingRemoval(null); }}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
