"use client";

// ══════════════════════════════════════════════════════════════
// FinancementEditor — saisie du financement d'un projet
// Utilisé à la création (assistant) et à la modification (détail projet).
// Budget et pourcentages sont affichés en direct ; le serveur les recalcule
// à l'enregistrement avec le même algorithme (lib/financement.ts).
// ══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, DollarSign, Plus, Trash2 } from "lucide-react";
import { BailleurMultiCurrency, type CurrencyContribution } from "@/components/financing/BailleurMultiCurrency";
import { ExchangeRateModal } from "@/components/financing/ExchangeRateModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CURRENCIES, formatCurrency } from "@/lib/helpers/currencyHelpers";
import {
  BASE_CURRENCY,
  computeFinancementPreview,
  newContribution,
  newId,
  sourcesDroppedBySwitch,
  validateFinancement,
  type FinancementFormValue,
  type FinancementType,
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

interface FinancementEditorProps {
  value: FinancementFormValue;
  onChange: (value: FinancementFormValue) => void;
  /** Afficher les erreurs de validation (après une tentative d'enregistrement). */
  showErrors?: boolean;
}

type PartieKey = "partiesPubliques" | "partiesPrivees";

const inputSm =
  "bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)] transition-colors";

function PctBadge({ pct }: { pct: number }) {
  return (
    <span
      className="w-16 flex-shrink-0 text-right text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums"
      title="Calculé automatiquement à partir des montants"
    >
      {pct.toFixed(2)} %
    </span>
  );
}

export function FinancementEditor({ value, onChange, showErrors = false }: FinancementEditorProps) {
  const [bailleurSearch, setBailleurSearch] = useState("");
  const [bailleurDropdownOpen, setBailleurDropdownOpen] = useState(false);
  const [customBailleur, setCustomBailleur] = useState("");
  const [showCustomBailleur, setShowCustomBailleur] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ title: string; message: string; apply: () => void } | null>(null);
  const [conversionCurrency, setConversionCurrency] = useState(BASE_CURRENCY);

  const preview = useMemo(() => computeFinancementPreview(value), [value]);
  const errors = useMemo(() => validateFinancement(value), [value]);
  const pctOf = (id: string) => preview.sources[id]?.pct ?? 0;

  const update = (patch: Partial<FinancementFormValue>) => onChange({ ...value, ...patch });

  // ── Type ──
  const switchType = (type: FinancementType) => {
    if (type !== value.type) update({ type });
  };
  const hiddenSources = sourcesDroppedBySwitch(value);

  // ── Bailleurs ──
  const availableBailleurs = BAILLEURS_LIST.filter(
    (nom) =>
      !value.bailleurs.some((b) => b.nom === nom) && nom.toLowerCase().includes(bailleurSearch.toLowerCase()),
  );

  const addBailleur = (nom: string) => {
    const trimmed = nom.trim();
    if (!trimmed) return;
    if (value.bailleurs.some((b) => b.nom.toLowerCase() === trimmed.toLowerCase())) return;
    update({
      bailleurs: [...value.bailleurs, { id: newId("b"), nom: trimmed, contributions: [newContribution()] }],
    });
  };

  const updateBailleurContributions = (id: string, contributions: CurrencyContribution[]) =>
    update({ bailleurs: value.bailleurs.map((b) => (b.id === id ? { ...b, contributions } : b)) });

  const askRemoveBailleur = (id: string) => {
    const bailleur = value.bailleurs.find((b) => b.id === id);
    setPendingRemoval({
      title: "Retirer le bailleur",
      message: `Retirer « ${bailleur?.nom} » du financement ? Le budget sera recalculé.`,
      apply: () => update({ bailleurs: value.bailleurs.filter((b) => b.id !== id) }),
    });
  };

  // ── Parties PPP ──
  const addPartie = (key: PartieKey) =>
    update({ [key]: [...value[key], { id: newId(key === "partiesPubliques" ? "pub" : "priv"), nom: "", montant: "", devise: BASE_CURRENCY }] });

  const updatePartie = (key: PartieKey, id: string, patch: Partial<PartieForm>) =>
    update({ [key]: value[key].map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const askRemovePartie = (key: PartieKey, id: string) => {
    const partie = value[key].find((p) => p.id === id);
    setPendingRemoval({
      title: key === "partiesPubliques" ? "Retirer la partie publique" : "Retirer la partie privée",
      message: `Retirer « ${partie?.nom || "sans nom"} » du financement ? Le budget sera recalculé.`,
      apply: () => update({ [key]: value[key].filter((p) => p.id !== id) }),
    });
  };

  const renderParties = (key: PartieKey, label: string, dotClass: string, placeholder: string) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={`text-[12px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${dotClass.replace("bg-", "text-")}`}>
          <span className={`w-2 h-2 rounded-full ${dotClass}`} /> {label}
        </h4>
        <button type="button" onClick={() => addPartie(key)} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--primary-text)] hover:underline">
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {value[key].length === 0 ? (
        <div className="p-5 border-2 border-dashed border-[var(--border-default)] rounded-[var(--radius-md)] text-center">
          <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Aucune entité</p>
          <button type="button" onClick={() => addPartie(key)} className="text-[11px] font-semibold text-[var(--primary-text)] hover:underline">
            Ajouter une entité
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {value[key].map((p) => (
            <div key={p.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.nom}
                  onChange={(e) => updatePartie(key, p.id, { nom: e.target.value })}
                  placeholder={placeholder}
                  className={`flex-1 ${inputSm} ${showErrors && !p.nom.trim() ? "border-danger" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => askRemovePartie(key, p.id)}
                  className="p-1 text-[var(--text-tertiary)] hover:text-danger transition-colors"
                  title="Retirer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={p.montant}
                  onChange={(e) => updatePartie(key, p.id, { montant: e.target.value })}
                  placeholder="Montant"
                  className={`flex-1 min-w-0 ${inputSm}`}
                />
                <select
                  value={p.devise}
                  onChange={(e) => updatePartie(key, p.id, { devise: e.target.value })}
                  className={`w-24 cursor-pointer ${inputSm}`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
                <PctBadge pct={pctOf(p.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Récapitulatif par source, dans les devises saisies ──
  const breakdown: { label: string; amounts: string; pct: number }[] = [];
  if (value.type === "MOP") {
    const n = value.budgetNational;
    if (n.enabled && parseFloat(n.montant) > 0) {
      breakdown.push({ label: "Budget National", amounts: formatCurrency(parseFloat(n.montant), n.devise), pct: pctOf("national") });
    }
    for (const b of value.bailleurs) {
      const parts = b.contributions.filter((c) => parseFloat(c.montant) > 0);
      if (parts.length === 0) continue;
      breakdown.push({
        label: b.nom,
        amounts: parts.map((c) => formatCurrency(parseFloat(c.montant), c.devise)).join(" + "),
        pct: pctOf(b.id),
      });
    }
  } else {
    for (const [key, suffix] of [["partiesPubliques", "Public"], ["partiesPrivees", "Privé"]] as const) {
      for (const p of value[key]) {
        if (!(parseFloat(p.montant) > 0)) continue;
        breakdown.push({
          label: `${p.nom || "Sans nom"} (${suffix})`,
          amounts: formatCurrency(parseFloat(p.montant), p.devise),
          pct: pctOf(p.id),
        });
      }
    }
  }

  const conversionRate = value.tauxChange[conversionCurrency] || 1;
  const foreignCurrencies = preview.usedCurrencies.filter((c) => c !== BASE_CURRENCY);

  return (
    <div className="space-y-6">
      {/* ── Structuration juridique ── */}
      <div>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3 uppercase tracking-wider">
          Structuration juridique <span className="text-danger">*</span>
        </h3>
        <div className="flex gap-4">
          {([
            ["MOP", "Maîtrise d'Ouvrage Publique"],
            ["PPP", "Partenariat Public-Privé"],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => switchType(type)}
              className={`flex-1 p-4 border-2 rounded-[var(--radius-md)] text-left transition-all ${
                value.type === type
                  ? "border-[var(--primary)] bg-[var(--primary-subtle)]"
                  : "border-[var(--border-default)] hover:border-[var(--primary)]/50"
              }`}
            >
              <div className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{type}</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">{label}</div>
            </button>
          ))}
        </div>
        {hiddenSources > 0 && (
          <div className="mt-3 flex gap-2 p-3 rounded-[var(--radius-md)] bg-warning-subtle border border-warning/20">
            <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-warning leading-relaxed">
              {hiddenSources} source{hiddenSources > 1 ? "s" : ""} saisie{hiddenSources > 1 ? "s" : ""} en{" "}
              {value.type === "MOP" ? "PPP" : "MOP"} ne {hiddenSources > 1 ? "seront" : "sera"} pas enregistrée
              {hiddenSources > 1 ? "s" : ""} : un projet {value.type} ne retient que ses propres sources. Revenez en{" "}
              {value.type === "MOP" ? "PPP" : "MOP"} pour les conserver.
            </p>
          </div>
        )}
      </div>

      {/* ── Sources ── */}
      <div>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3 uppercase tracking-wider">Sources de financement</h3>

        {value.type === "MOP" ? (
          <div className="space-y-5">
            {/* Budget national */}
            <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.budgetNational.enabled}
                  onChange={(e) => update({ budgetNational: { ...value.budgetNational, enabled: e.target.checked } })}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
                <div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">Budget National</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">Financement par l&apos;État du Cameroun</div>
                </div>
              </label>
              {value.budgetNational.enabled && (
                <div className="ml-7 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={value.budgetNational.montant}
                    onChange={(e) => update({ budgetNational: { ...value.budgetNational, montant: e.target.value } })}
                    placeholder="Montant"
                    className={`flex-1 min-w-0 ${inputSm}`}
                  />
                  <select
                    value={value.budgetNational.devise}
                    onChange={(e) => update({ budgetNational: { ...value.budgetNational, devise: e.target.value } })}
                    className={`w-24 cursor-pointer ${inputSm}`}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                  <PctBadge pct={pctOf("national")} />
                </div>
              )}
            </div>

            {/* Bailleurs */}
            <div className="space-y-3">
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Bailleurs de fonds
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={bailleurSearch}
                  onChange={(e) => {
                    setBailleurSearch(e.target.value);
                    setBailleurDropdownOpen(true);
                  }}
                  onFocus={() => setBailleurDropdownOpen(true)}
                  placeholder="Rechercher et sélectionner un bailleur…"
                  className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)]"
                />
                {bailleurDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setBailleurDropdownOpen(false);
                        setBailleurSearch("");
                      }}
                    />
                    <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] max-h-52 overflow-y-auto">
                      {availableBailleurs.length > 0 ? (
                        availableBailleurs.map((nom) => (
                          <button
                            key={nom}
                            type="button"
                            onClick={() => {
                              addBailleur(nom);
                              setBailleurSearch("");
                              setBailleurDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                          >
                            {nom}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-[12px] text-[var(--text-tertiary)] italic">Aucun bailleur trouvé</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {!showCustomBailleur ? (
                <button
                  type="button"
                  onClick={() => setShowCustomBailleur(true)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--primary-text)] hover:underline"
                >
                  <Plus size={12} /> Ajouter un bailleur personnalisé
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customBailleur}
                    onChange={(e) => setCustomBailleur(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBailleur(customBailleur);
                        setCustomBailleur("");
                        setShowCustomBailleur(false);
                      }
                    }}
                    placeholder="Nom du bailleur…"
                    autoFocus
                    className={`flex-1 ${inputSm} py-2 text-[13px]`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addBailleur(customBailleur);
                      setCustomBailleur("");
                      setShowCustomBailleur(false);
                    }}
                    className="px-3 py-2 bg-[var(--primary)] text-on-primary rounded-[var(--radius-md)] text-[12px] font-semibold hover:opacity-90"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomBailleur(false);
                      setCustomBailleur("");
                    }}
                    className="px-3 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-[12px] font-semibold"
                  >
                    Annuler
                  </button>
                </div>
              )}

              {value.bailleurs.length > 0 && (
                <div className="space-y-2">
                  {value.bailleurs.map((b) => (
                    <BailleurMultiCurrency
                      key={b.id}
                      bailleurId={b.id}
                      bailleurNom={b.nom}
                      contributions={b.contributions}
                      pourcentageTotal={pctOf(b.id)}
                      onUpdate={updateBailleurContributions}
                      onRemove={askRemoveBailleur}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderParties("partiesPubliques", "Parties publiques", "bg-primary", "Nom de l'entité publique…")}
            {renderParties("partiesPrivees", "Parties privées", "bg-success", "Nom de l'entité privée…")}
          </div>
        )}
      </div>

      {/* ── Taux de change ── */}
      {(foreignCurrencies.length > 0 || preview.missingRates.length > 0) && (
        <button
          type="button"
          onClick={() => setShowRates(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-subtle text-primary-fg border border-primary/20 rounded-[var(--radius-md)] text-[12px] font-semibold hover:bg-primary-subtle transition-colors"
        >
          <DollarSign size={14} />
          Taux de change ({foreignCurrencies.map((c) => `1 ${c} = ${value.tauxChange[c] ?? "?"} FCFA`).join(" · ")})
        </button>
      )}

      {/* ── Budget total ── */}
      {preview.total > 0 && (
        <div className="p-4 rounded-[var(--radius-lg)] border-2 border-[var(--primary)]/30 bg-[var(--primary)]/5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={14} className="text-success" /> Budget total du projet
            </h4>
            <select
              value={conversionCurrency}
              onChange={(e) => setConversionCurrency(e.target.value)}
              className={`cursor-pointer ${inputSm}`}
              title="Devise d'affichage du total"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>

          <div className="text-[22px] font-bold text-[var(--primary-text)] tabular-nums">
            {formatCurrency(Math.round((preview.total / conversionRate) * 100) / 100, conversionCurrency)}
          </div>

          <div className="space-y-1.5">
            {breakdown.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-2 py-1.5 bg-[var(--bg-surface)] rounded-[var(--radius-sm)]">
                <span className="text-[12px] text-[var(--text-secondary)] truncate">{row.label}</span>
                <span className="text-[12px] font-semibold text-[var(--text-primary)] text-right">
                  {row.amounts}
                  <span className="text-[11px] text-[var(--text-tertiary)] ml-2 tabular-nums">{row.pct.toFixed(2)} %</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-[var(--text-tertiary)] italic">
            Budget et pourcentages sont calculés automatiquement à partir des montants et des taux de change.
          </p>
        </div>
      )}

      {preview.total <= 0 && (
        <p className="text-[11px] text-[var(--text-tertiary)] italic">
          Aucun montant saisi : le budget du projet restera à définir jusqu&apos;à l&apos;ajout d&apos;une source.
        </p>
      )}

      {/* ── Erreurs ── */}
      {showErrors && errors.length > 0 && (
        <div className="p-3 rounded-[var(--radius-md)] bg-danger-subtle border border-danger/20 space-y-1">
          {errors.map((error) => (
            <p key={error} className="text-[12px] text-danger">{error}</p>
          ))}
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
        onConfirm={() => {
          pendingRemoval?.apply();
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
