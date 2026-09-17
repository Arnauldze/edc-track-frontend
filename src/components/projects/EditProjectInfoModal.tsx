"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { updateProject, type Project, type UpdateProjectDto } from "@/lib/projectStore";
import { CAMEROON_DATA, CITY_COORDS, REGIONS } from "@/lib/cameroonGeo";
import { getErrorMessage } from "@/services/api/client";
import { toast } from "@/lib/toastStore";
import { formatCurrency } from "@/lib/helpers/currencyHelpers";
import { FinancementEditor } from "@/components/financing/FinancementEditor";
import {
  computeFinancementPreview,
  financementFromProject,
  financementToPayload,
  validateFinancement,
  type FinancementFormValue,
} from "@/lib/financement";

interface EditProjectInfoModalProps {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

type Tab = "general" | "localisation" | "financement";

type FormState = {
  name: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  region: string;
  departement: string;
  ville: string;
  localite: string;
};

// Les dates sont stockées à minuit UTC : les 10 premiers caractères de l'ISO
// donnent directement la valeur attendue par <input type="date">.
const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");

const fromProject = (project: Project): FormState => ({
  name: project.name ?? "",
  description: project.description ?? "",
  dateDebut: toDateInput(project.dateDebut),
  dateFin: toDateInput(project.dateFin),
  region: project.localisation?.region ?? "",
  departement: project.localisation?.departement ?? "",
  ville: project.localisation?.ville ?? "",
  localite: project.localisation?.localite ?? "",
});

// Une valeur enregistrée hors référentiel (saisie ancienne) doit rester
// sélectionnable, sinon l'ouverture de la modale l'effacerait silencieusement.
const withCurrent = (options: string[], current: string) =>
  current && !options.includes(current) ? [current, ...options] : options;

const inputClass =
  "w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 disabled:opacity-50";
const labelClass = "block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "Informations" },
  { id: "localisation", label: "Localisation" },
  { id: "financement", label: "Financement" },
];

export function EditProjectInfoModal({ isOpen, project, onClose, onSaved }: EditProjectInfoModalProps) {
  const [tab, setTab] = useState<Tab>("general");
  const [form, setForm] = useState<FormState>(() => fromProject(project));
  const [financement, setFinancement] = useState<FinancementFormValue>(() => financementFromProject(project.financement));
  const [showFinancementErrors, setShowFinancementErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Repartir des valeurs du projet à chaque ouverture : une saisie abandonnée
  // ne doit pas réapparaître à la suivante.
  useEffect(() => {
    if (!isOpen) return;
    setTab("general");
    setForm(fromProject(project));
    setFinancement(financementFromProject(project.financement));
    setShowFinancementErrors(false);
  }, [isOpen, project]);

  // Le financement n'est envoyé que s'il a changé : le serveur recalcule alors
  // budget et pourcentages. Modifier le seul nom ne doit pas recalculer un
  // budget à l'insu de l'utilisateur.
  const initialFinancementPayload = useMemo(
    () => JSON.stringify(financementToPayload(financementFromProject(project.financement))),
    [project.financement],
  );
  const financementChanged = JSON.stringify(financementToPayload(financement)) !== initialFinancementPayload;
  const preview = useMemo(() => computeFinancementPreview(financement), [financement]);

  // Budget enregistré incohérent avec son financement (saisie antérieure au calcul serveur).
  const storedBudget = project.budget ?? 0;
  // Règle métier : quand le budget change, les composants gardent leur part et
  // le serveur réajuste leurs montants. On l'annonce avant d'enregistrer.
  const budgetedComponents = (project.components ?? []).filter((c) => (c.budget ?? 0) > 0).length;
  const componentsWillFollow =
    financementChanged && storedBudget > 0 && preview.total > 0 && Math.abs(preview.total - storedBudget) >= 1 && budgetedComponents > 0;
  const budgetMismatch = Math.abs(storedBudget - preview.total) >= 1;

  const departements = useMemo(
    () => withCurrent(form.region ? Object.keys(CAMEROON_DATA[form.region] ?? {}) : [], form.departement),
    [form.region, form.departement],
  );
  const villes = useMemo(
    () => withCurrent(form.region && form.departement ? CAMEROON_DATA[form.region]?.[form.departement] ?? [] : [], form.ville),
    [form.region, form.departement, form.ville],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const nameError = form.name.trim().length < 3 ? "Le nom doit contenir au moins 3 caractères" : null;
  const dateError =
    form.dateDebut && form.dateFin && form.dateFin < form.dateDebut
      ? "La date de fin doit être postérieure à la date de début"
      : null;
  const financementErrors = validateFinancement(financement);

  if (!isOpen) return null;

  const tabHasError: Record<Tab, boolean> = {
    general: !!nameError || !!dateError,
    localisation: false,
    financement: showFinancementErrors && financementErrors.length > 0,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (nameError || dateError) {
      setTab("general");
      return;
    }
    if (financementChanged && financementErrors.length > 0) {
      setShowFinancementErrors(true);
      setTab("financement");
      return;
    }

    const previous = project.localisation;
    const villeChanged = form.ville !== (previous?.ville ?? "");
    const coords = CITY_COORDS[form.ville];

    // Seuls les champs modifiables sont envoyés : l'API rejette tout champ
    // inconnu (forbidNonWhitelisted), comme code, createdBy ou _id.
    const updates: UpdateProjectDto = {
      name: form.name.trim(),
      description: form.description.trim(),
      // null et non undefined : une clé absente du JSON laisserait l'ancienne
      // date en place, et vider le champ n'aurait aucun effet.
      dateDebut: form.dateDebut || null,
      dateFin: form.dateFin || null,
      localisation: {
        region: form.region || undefined,
        departement: form.departement || undefined,
        ville: form.ville || undefined,
        localite: form.localite.trim() || undefined,
        // Les coordonnées suivent la ville : conservées si elle ne change pas,
        // recalculées si elle est connue du référentiel, abandonnées sinon.
        coordinates: !villeChanged
          ? previous?.coordinates
          : coords
            ? { lat: coords[0], lng: coords[1] }
            : undefined,
      },
      ...(financementChanged ? { financement: financementToPayload(financement) } : {}),
    };

    setIsSubmitting(true);
    try {
      const saved = await updateProject(project.code, updates);
      toast.success(
        componentsWillFollow
          ? `Budget recalculé : ${formatCurrency(saved.budget ?? 0, "FCFA")} — montants des composants réajustés`
          : financementChanged
            ? `Projet mis à jour — budget recalculé : ${formatCurrency(saved.budget ?? 0, "FCFA")}`
            : "Informations du projet mises à jour",
      );
      onSaved(saved);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Modifier le projet</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{project.code}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
            >
              <X size={20} className="text-[var(--text-tertiary)]" />
            </button>
          </div>
          <div className="flex gap-1 mt-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  tab === t.id
                    ? "border-[var(--primary)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.label}
                {tabHasError[t.id] && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}
                {t.id === "financement" && financementChanged && !tabHasError.financement && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" title="Modifié" />
                )}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-6 space-y-5 overflow-y-auto">
            {tab === "general" && (
              <>
                <div>
                  <label className={labelClass}>Nom du projet *</label>
                  <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
                  {nameError && <p className="text-xs text-danger mt-1.5">{nameError}</p>}
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={6}
                    className={`${inputClass} resize-y`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date de début</label>
                    <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Date de fin</label>
                    <input
                      type="date"
                      value={form.dateFin}
                      min={form.dateDebut || undefined}
                      onChange={(e) => set("dateFin", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                {dateError && <p className="text-xs text-danger -mt-3">{dateError}</p>}
              </>
            )}

            {tab === "localisation" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Région</label>
                  <select
                    value={form.region}
                    // Changer de région invalide département et ville
                    onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value, departement: "", ville: "" }))}
                    className={inputClass}
                  >
                    <option value="">— Sélectionner —</option>
                    {withCurrent(REGIONS, form.region).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Département</label>
                  <select
                    value={form.departement}
                    onChange={(e) => setForm((prev) => ({ ...prev, departement: e.target.value, ville: "" }))}
                    disabled={!form.region}
                    className={inputClass}
                  >
                    <option value="">{form.region ? "— Sélectionner —" : "Choisissez d'abord une région"}</option>
                    {departements.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Ville</label>
                  <select
                    value={form.ville}
                    onChange={(e) => set("ville", e.target.value)}
                    disabled={!form.departement}
                    className={inputClass}
                  >
                    <option value="">{form.departement ? "— Sélectionner —" : "Choisissez d'abord un département"}</option>
                    {villes.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Localité</label>
                  <input
                    type="text"
                    value={form.localite}
                    onChange={(e) => set("localite", e.target.value)}
                    placeholder="Village, quartier, site…"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {tab === "financement" && (
              <>
                {budgetMismatch && !financementChanged && (
                  <div className="flex gap-2 p-3 rounded-[var(--radius-md)] bg-warning-subtle border border-warning/20">
                    <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-warning leading-relaxed">
                      Le budget enregistré ({storedBudget > 0 ? formatCurrency(storedBudget, "FCFA") : "non défini"}) ne
                      correspond pas à son financement ({formatCurrency(preview.total, "FCFA")}). Vérifiez les montants
                      ci-dessous : à l&apos;enregistrement du financement, le budget sera recalculé à partir de ces sources.
                    </p>
                  </div>
                )}
                <FinancementEditor value={financement} onChange={setFinancement} showErrors={showFinancementErrors} />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border-default)]">
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {financementChanged
                ? `Budget après enregistrement : ${preview.total > 0 ? formatCurrency(preview.total, "FCFA") : "à définir"}`
                : ""}
              {componentsWillFollow && (
                <span className="block text-warning">
                  Les montants de {budgetedComponents > 1 ? `ses ${budgetedComponents} composants` : "son composant"} seront réajustés : chaque composant garde sa part.
                </span>
              )}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
