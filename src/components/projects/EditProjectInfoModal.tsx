"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { updateProject, type Project, type UpdateProjectDto } from "@/lib/projectStore";
import { CAMEROON_DATA, CITY_COORDS, REGIONS } from "@/lib/cameroonGeo";
import { getErrorMessage } from "@/services/api/client";
import { toast } from "@/lib/toastStore";
import { formatMoney } from "@/lib/utils";

interface EditProjectInfoModalProps {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

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
const toDateInput = (value?: string) => (value ? value.slice(0, 10) : "");

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
  "w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 disabled:opacity-50";
const labelClass = "block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider";

export function EditProjectInfoModal({ isOpen, project, onClose, onSaved }: EditProjectInfoModalProps) {
  const [form, setForm] = useState<FormState>(() => fromProject(project));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Repartir des valeurs du projet à chaque ouverture : une saisie abandonnée
  // ne doit pas réapparaître à la suivante.
  useEffect(() => {
    if (isOpen) setForm(fromProject(project));
  }, [isOpen, project]);

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
  const canSubmit = !nameError && !dateError && !isSubmitting;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

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
    };

    setIsSubmitting(true);
    try {
      const saved = await updateProject(project.code, updates);
      toast.success("Informations du projet mises à jour");
      onSaved(saved);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const financeurs = project.financement
    ? (project.financement.budgetNational ? 1 : 0) +
      (project.financement.bailleurs?.length ?? 0) +
      (project.financement.partiesPubliques?.length ?? 0) +
      (project.financement.partiesPrivees?.length ?? 0)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between sticky top-0 bg-[var(--bg-surface)] z-10">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Modifier les informations</h2>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ── Général ── */}
          <div>
            <label className={labelClass}>Nom du projet *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />
            {nameError && <p className="text-xs text-red-500 mt-1.5">{nameError}</p>}
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date de début</label>
              <input
                type="date"
                value={form.dateDebut}
                onChange={(e) => set("dateDebut", e.target.value)}
                className={inputClass}
              />
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
          {dateError && <p className="text-xs text-red-500 -mt-3">{dateError}</p>}

          {/* ── Localisation ── */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mt-3 mb-4">Localisation</h3>
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
          </div>

          {/* ── Budget & financement (lecture seule) ── */}
          <div className="flex gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--bg-inset)] border border-[var(--border-subtle)]">
            <Info size={16} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p>
                <span className="font-semibold text-[var(--text-primary)]">
                  Budget : {project.budget ? `${formatMoney(project.budget)} ${project.devise || "FCFA"}` : "—"}
                </span>
                {" · "}
                {project.financement?.type || "MOP"} · {financeurs} financeur{financeurs > 1 ? "s" : ""}
              </p>
              <p className="text-[var(--text-tertiary)]">
                Le budget est calculé à partir des contributions du financement : il n&apos;est pas modifiable ici.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
