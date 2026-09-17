"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, Coins, Info, Layers, MapPin, Pencil, type LucideIcon } from "lucide-react";
import { addProject, generateProjectCode, type ComponentData } from "@/lib/projectStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FinancementEditor, sourceColor } from "@/components/financing/FinancementEditor";
import { StructureTreeEditor } from "@/components/projects/StructureTreeEditor";
import { computeFinancementPreview, emptyFinancement, financementToPayload, validateFinancement, type FinancementFormValue } from "@/lib/financement";
import { CAMEROON_DATA, CITY_COORDS, REGIONS } from "@/lib/cameroonGeo";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { newUnitId } from "@/lib/structureUnits";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_ORDER, type ActivityType } from "@/lib/activityTypes";
import { allocationStatus, formatShare, round2, shareOf, toFCFA, type AllocationStatus } from "@/lib/componentBudget";
import { formatDate, formatMoney } from "@/lib/utils";

// ══════════════════════════════════════
// COMBOBOX COMPONENT
// ══════════════════════════════════════

function ComboBox({ label, placeholder, options, value, onChange, disabled = false, required = false }: {
    label: string; placeholder: string; options: string[]; value: string;
    onChange: (val: string) => void; disabled?: boolean; required?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="relative">
            <label className="block text-[12.5px] font-semibold text-fg-muted mb-1.5">
                {label} {required && <span className="text-danger">*</span>}
            </label>
            <div className={`relative ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
                <input
                    type="text"
                    value={query || value}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(""); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="w-full h-10 bg-surface border border-line rounded-[var(--radius-md)] px-3 text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors pr-8"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </div>

            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-surface border border-line rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] max-h-48 overflow-y-auto">
                    {filtered.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => { onChange(opt); setQuery(""); setOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 text-[13px] hover:bg-hover transition-colors ${opt === value ? "bg-primary-subtle font-semibold text-primary-fg" : "text-fg"}`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}

            {open && <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQuery(""); }} />}
        </div>
    );
}

// ══════════════════════════════════════
// LOCALISATION STEP
// ══════════════════════════════════════

function LocalisationStep({ region, setRegion, departement, setDepartement, ville, setVille, localite, setLocalite, lat, setLat, lng, setLng, autoDetected, setAutoDetected }: {
    region: string; setRegion: (v: string) => void; departement: string; setDepartement: (v: string) => void;
    ville: string; setVille: (v: string) => void; localite: string; setLocalite: (v: string) => void;
    lat: string; setLat: (v: string) => void; lng: string; setLng: (v: string) => void;
    autoDetected: boolean; setAutoDetected: (v: boolean) => void;
}) {
    // GPS and cascading handled via props

    const departements = region ? Object.keys(CAMEROON_DATA[region] || {}) : [];
    const villes = region && departement ? (CAMEROON_DATA[region]?.[departement] || []) : [];

    const handleVilleChange = (val: string) => {
        setVille(val);
        // Auto-fill GPS from lookup
        const coords = CITY_COORDS[val];
        if (coords) {
            setLat(coords[0].toFixed(4));
            setLng(coords[1].toFixed(4));
            setAutoDetected(true);
        } else {
            setLat("");
            setLng("");
            setAutoDetected(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Info */}
            <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px flex-shrink-0 text-fg-subtle"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                    Choisissez la région, le département puis la ville : les coordonnées GPS sont alors renseignées toutes seules. Vous pouvez aussi passer cette étape.
                </p>
            </div>

            {/* Cascading selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ComboBox
                    label="Région"
                    placeholder="Sélectionner une région..."
                    options={REGIONS}
                    value={region}
                    onChange={(val) => { setRegion(val); setDepartement(""); setVille(""); setLat(""); setLng(""); setAutoDetected(false); }}
                />
                <ComboBox
                    label="Département"
                    placeholder={region ? "Choisir le département..." : "Sélectionnez d'abord une région"}
                    options={departements}
                    value={departement}
                    onChange={(val) => { setDepartement(val); setVille(""); setLat(""); setLng(""); setAutoDetected(false); }}
                    disabled={!region}
                />
                <ComboBox
                    label="Ville / Arrondissement"
                    placeholder={departement ? "Choisir la ville..." : "Sélectionnez d'abord un département"}
                    options={villes}
                    value={ville}
                    onChange={handleVilleChange}
                    disabled={!departement}
                />
            </div>

            {/* Localité précise */}
            <div>
                <label className="block text-[12.5px] font-semibold text-fg-muted mb-1.5">Localité précise</label>
                <input
                    type="text"
                    value={localite}
                    onChange={(e) => setLocalite(e.target.value)}
                    placeholder="ex. rive droite du fleuve Sanaga, PK 42"
                    className="w-full h-10 bg-surface border border-line rounded-[var(--radius-md)] px-3 text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
                />
            </div>

            {/* GPS Coordinates */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <label className="text-[12.5px] font-semibold text-fg-muted">Coordonnées GPS</label>
                    {autoDetected ? (
                        <span className="flex items-center gap-1 rounded-full border border-success/20 bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                            Renseignées automatiquement
                        </span>
                    ) : (
                        <span className="rounded-full border border-line bg-inset px-2 py-0.5 text-[11px] font-medium text-fg-subtle">Choisissez une ville</span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <input
                            type="text"
                            value={lat}
                            onChange={(e) => { setLat(e.target.value); setAutoDetected(false); }}
                            placeholder="Latitude (ex: 5.5321)"
                            className={`w-full h-10 bg-surface border border-line rounded-[var(--radius-md)] px-3 text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors font-mono ${autoDetected ? "border-success/40 bg-success-subtle" : ""}`}
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={lng}
                            onChange={(e) => { setLng(e.target.value); setAutoDetected(false); }}
                            placeholder="Longitude (ex: 13.6163)"
                            className={`w-full h-10 bg-surface border border-line rounded-[var(--radius-md)] px-3 text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors font-mono ${autoDetected ? "border-success/40 bg-success-subtle" : ""}`}
                        />
                    </div>
                </div>
                {autoDetected && (
                    <p className="mt-1.5 text-[12px] text-fg-muted">
                        Position approximative de {ville} : ajustez-la si besoin.
                    </p>
                )}
            </div>

            {/* Preview with mini-map */}
            {lat && lng && (
                <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden shadow-[var(--shadow-sm)]">
                    {/* Static map tile */}
                    <div className="relative h-40 bg-[var(--bg-inset)]">
                        <img
                            src={`https://static-maps.yandex.ru/v1?lang=fr_FR&ll=${lng},${lat}&z=10&size=650,200&l=map&pt=${lng},${lat},pm2rdl`}
                            alt="Carte"
                            className="w-full h-full object-cover opacity-90"
                            onError={(e) => {
                                // Fallback: show OpenStreetMap embed
                                const target = e.currentTarget;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                    const iframe = document.createElement("iframe");
                                    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.5},${parseFloat(lat) - 0.3},${parseFloat(lng) + 0.5},${parseFloat(lat) + 0.3}&layer=mapnik&marker=${lat},${lng}`;
                                    iframe.className = "w-full h-full border-0";
                                    parent.appendChild(iframe);
                                }
                            }}
                        />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-[var(--radius-sm)]">
                            📍 Aperçu
                        </div>
                    </div>
                    {/* Info bar */}
                    <div className="flex items-center justify-between p-3 bg-[var(--bg-surface)]">
                        <span className="text-[12px] text-[var(--text-secondary)]">
                            📍 <strong className="text-[var(--text-primary)]">{[ville, departement, region].filter(Boolean).join(", ")}</strong>
                            {localite && <span className="text-[var(--text-tertiary)]"> — {localite}</span>}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded-[var(--radius-sm)]">
                            {lat}°N, {lng}°E
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════
// ÉTAPES
// ══════════════════════════════════════

const STEPS = [
    { id: 1, name: "Informations", detail: "Nom, code, dates", intro: "Le code est attribué automatiquement. Le projet n'est créé qu'à la dernière étape." },
    { id: 2, name: "Localisation", detail: "Région, département, ville", intro: "Où se déroule le projet. Facultatif : vous pourrez le renseigner plus tard depuis la fiche du projet." },
    { id: 3, name: "Financement", detail: "Mode et sources", intro: "Le budget du projet est la somme des sources. Les sources pourront être complétées plus tard depuis la fiche du projet." },
    { id: 4, name: "Structure", detail: "Composantes et activités", intro: "Découpez le projet en composantes, sous-composantes et activités. Une unité sans enfant est une activité : c'est elle qui sera planifiée." },
    { id: 5, name: "Vérification", detail: "Relire puis créer", intro: "Relisez le projet avant de le créer. Tout reste modifiable ensuite depuis sa fiche." },
] as const;

const LAST_STEP = STEPS.length;

const fieldClass =
    "w-full h-10 bg-surface border border-line rounded-[var(--radius-md)] px-3 text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors";

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[12.5px] font-semibold text-fg-muted mb-1.5">
                {label} {required && <span className="text-danger">*</span>}
            </label>
            {children}
            {error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : hint ? <p className="mt-1.5 text-[12px] text-fg-subtle">{hint}</p> : null}
        </div>
    );
}

const monthsBetween = (debut: string, fin: string) => {
    const a = new Date(debut), b = new Date(fin);
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return null;
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
};

/** « 3 ans 4 mois », « 8 mois ». */
const dureeLabel = (mois: number) => {
    const ans = Math.floor(mois / 12), reste = mois % 12;
    if (ans === 0) return `${mois} mois`;
    return `${ans} an${ans > 1 ? "s" : ""}${reste ? ` ${reste} mois` : ""}`;
};

const fcfa = (amount: number) => `${formatMoney(amount, 0)} FCFA`;

/** Montant court pour l'aperçu : 41,52 Md FCFA. */
const fcfaCourt = (amount: number) => {
    if (amount >= 1e9) return `${formatMoney(amount / 1e9, 2)} Md FCFA`;
    if (amount >= 1e6) return `${formatMoney(amount / 1e6, 2)} M FCFA`;
    return fcfa(amount);
};

const yearOf = (iso: string) => Number(iso.slice(0, 4));

function infoErrors(titre: string, dateDebut: string, dateFin: string) {
    const errors: { titre?: string; dateDebut?: string; dateFin?: string } = {};
    if (!titre.trim()) errors.titre = "Donnez un nom au projet.";
    if (!dateDebut) errors.dateDebut = "Indiquez la date de début.";
    else if (yearOf(dateDebut) < 1900 || yearOf(dateDebut) > 2200) errors.dateDebut = "Cette date n'est pas plausible : vérifiez l'année.";
    if (!dateFin) errors.dateFin = "Indiquez la date de fin prévue.";
    else if (yearOf(dateFin) < 1900 || yearOf(dateFin) > 2200) errors.dateFin = "Cette date n'est pas plausible : vérifiez l'année.";
    else if (dateDebut && dateFin <= dateDebut) errors.dateFin = "La fin doit être postérieure au début.";
    return errors;
}

/** Nombre d'unités (tous niveaux) encore sans nom. */
function unnamedUnits(components: ComponentData[]) {
    return components.reduce((n, c) => n + (c.name.trim() ? 0 : 1) + c.sousComposants.reduce((m, sc) => m + (sc.name.trim() ? 0 : 1) + sc.activities.filter((a) => !a.name.trim()).length, 0), 0);
}

/** Nombre d'activités par type, pour l'aperçu. */
function typeCounts(components: ComponentData[]) {
    const counts = new Map<ActivityType, number>();
    const add = (t: ActivityType = "travaux") => counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const c of components) {
        if (c.sousComposants.length === 0) { add(c.typeActivite); continue; }
        for (const sc of c.sousComposants) {
            if (sc.activities.length === 0) { add(sc.typeActivite); continue; }
            for (const a of sc.activities) add(a.typeActivite);
        }
    }
    return ACTIVITY_TYPE_ORDER.filter((t) => counts.has(t)).map((t) => [t, counts.get(t)!] as const);
}

const emptyComponent = (): ComponentData => ({ id: newUnitId("component"), name: "", devise: "FCFA", typeActivite: "travaux", sousComposants: [] });

// ══════════════════════════════════════
// PAGE
// ══════════════════════════════════════

export default function NewProjectPage() {
    const router = useRouter();
    const { data: currentUser } = useCurrentUser();

    // Sans droit de création, inutile de parcourir les étapes pour se voir
    // refuser l'enregistrement à la fin : le serveur rejetterait la création.
    useEffect(() => {
        if (currentUser && !currentUser.canCreateProjects) {
            toast.error("Vous n'êtes pas autorisé à créer des projets");
            router.replace("/projects");
        }
    }, [currentUser, router]);

    const [currentStep, setCurrentStep] = useState(1);
    const [maxStep, setMaxStep] = useState(1);
    const [projectCode] = useState(generateProjectCode());
    const [creating, setCreating] = useState(false);

    // 1. Informations
    const [titre, setTitre] = useState("");
    const [description, setDescription] = useState("");
    const [dateDebut, setDateDebut] = useState("");
    const [dateFin, setDateFin] = useState("");
    const [showInfoErrors, setShowInfoErrors] = useState(false);

    // 2. Localisation
    const [region, setRegion] = useState("");
    const [departement, setDepartement] = useState("");
    const [ville, setVille] = useState("");
    const [localite, setLocalite] = useState("");
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [autoDetected, setAutoDetected] = useState(false);

    // 3. Financement — voir lib/financement.ts
    const [financement, setFinancement] = useState<FinancementFormValue>(emptyFinancement);
    const [showFinancementErrors, setShowFinancementErrors] = useState(false);
    const financementPreview = useMemo(() => computeFinancementPreview(financement), [financement]);

    // 4. Structure
    const [components, setComponents] = useState<ComponentData[]>(() => [emptyComponent()]);
    const [pendingRemoval, setPendingRemoval] = useState<{ name: string; apply: () => void } | null>(null);

    // ── Dérivés ──
    const errors = infoErrors(titre, dateDebut, dateFin);
    const infoValid = Object.keys(errors).length === 0;
    const financementErrors = validateFinancement(financement);
    const unnamed = unnamedUnits(components);
    const duree = monthsBetween(dateDebut, dateFin);
    const lieu = [region, departement, ville].filter(Boolean).join(" › ");
    const periode = dateDebut && dateFin && infoValid ? `${formatDate(dateDebut)} → ${formatDate(dateFin)}${duree ? ` · ${dureeLabel(duree)}` : ""}` : "";

    const totalSC = components.reduce((sum, c) => sum + c.sousComposants.length, 0);
    const totalActivities = components.reduce((sum, c) => sum + c.sousComposants.reduce((s, sc) => s + sc.activities.length, 0), 0);
    const structureLabel = `${components.length} composante${components.length > 1 ? "s" : ""} · ${totalSC} sous-composante${totalSC > 1 ? "s" : ""} · ${totalActivities} activité${totalActivities > 1 ? "s" : ""}`;

    const budgetAlloue = components.reduce((sum, c) => sum + toFCFA(c.budget, c.devise, financement.tauxChange), 0);
    const allocation = allocationStatus(budgetAlloue, financementPreview.total);
    const partAllouee = shareOf(budgetAlloue, financementPreview.total);

    const sources = (financement.type === "MOP"
        ? [
            ...(financement.budgetNational.enabled ? [{ id: "national", nom: "Budget national" }] : []),
            ...financement.bailleurs.map((b) => ({ id: b.id, nom: b.nom || "Bailleur sans nom" })),
        ]
        : [...financement.partiesPubliques, ...financement.partiesPrivees].map((p) => ({ id: p.id, nom: p.nom || "Partie sans nom" }))
    ).map((s, i) => ({ ...s, color: sourceColor(i), amount: financementPreview.sources[s.id]?.amount ?? 0, pct: financementPreview.sources[s.id]?.pct ?? 0 }));

    const financementLabel = sources.length === 0
        ? ""
        : financement.type === "MOP"
            ? `MOP · ${[financement.budgetNational.enabled ? "budget national" : "", financement.bailleurs.length ? `${financement.bailleurs.length} bailleur${financement.bailleurs.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" + ")}`
            : `PPP · ${financement.partiesPubliques.length} publique${financement.partiesPubliques.length > 1 ? "s" : ""} + ${financement.partiesPrivees.length} privée${financement.partiesPrivees.length > 1 ? "s" : ""}`;

    const summaries: Record<number, string> = {
        1: [titre.trim(), periode].filter(Boolean).join(" · "),
        2: lieu || (maxStep > 2 ? "Non renseignée" : ""),
        3: financementPreview.total > 0 ? `${financementLabel} · ${fcfaCourt(financementPreview.total)}` : financementLabel,
        4: maxStep > 4 ? structureLabel : "",
        5: "",
    };

    // ── Navigation ──
    const stepBlocker = (step: number): string | null => {
        if (step === 1 && !infoValid) { setShowInfoErrors(true); return "Complétez les informations du projet"; }
        if (step === 3 && financementErrors.length > 0) { setShowFinancementErrors(true); return "Le financement comporte des erreurs à corriger"; }
        if (step === 4 && components.length === 0) return "Ajoutez au moins une composante";
        if (step === 4 && unnamed > 0) return `${unnamed} élément${unnamed > 1 ? "s" : ""} de la structure sans nom`;
        return null;
    };

    const goTo = (step: number) => {
        if (step <= maxStep) setCurrentStep(step);
    };

    const handleNext = () => {
        const blocker = stepBlocker(currentStep);
        if (blocker) { toast.error(blocker); return; }
        if (currentStep < LAST_STEP) {
            setCurrentStep(currentStep + 1);
            setMaxStep((m) => Math.max(m, currentStep + 1));
        } else {
            handleCreate();
        }
    };

    const handleCreate = async () => {
        for (const step of [1, 3, 4]) {
            const blocker = stepBlocker(step);
            if (blocker) { toast.error(blocker); setCurrentStep(step); return; }
        }
        setCreating(true);
        try {
            const createdProject = await addProject({
                name: titre.trim(),
                description: description.trim() || undefined,
                progress: 0,
                localisation: {
                    region: region || undefined,
                    departement: departement || undefined,
                    ville: ville || undefined,
                    localite: localite || undefined,
                    coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
                },
                // Budget et pourcentages : calculés par le serveur à partir du financement
                financement: financementToPayload(financement),
                dateDebut,
                dateFin,
                components: components.map((comp) => ({
                    id: comp.id,
                    name: comp.name.trim(),
                    budget: comp.budget || undefined,
                    devise: comp.devise || "FCFA",
                    ponderation: financementPreview.total > 0 && comp.budget
                        ? Math.min(100, round2(shareOf(toFCFA(comp.budget, comp.devise, financement.tauxChange), financementPreview.total)))
                        : undefined,
                    typeActivite: comp.sousComposants.length === 0 ? comp.typeActivite : undefined,
                    sousComposants: comp.sousComposants.map((sc) => ({
                        id: sc.id,
                        name: sc.name.trim(),
                        typeActivite: sc.activities.length === 0 ? sc.typeActivite : undefined,
                        activities: sc.activities.map((act) => ({ id: act.id, name: act.name.trim(), typeActivite: act.typeActivite })),
                    })),
                })),
            } as Parameters<typeof addProject>[0]);
            toast.success("Projet créé");
            router.push(`/projects/${createdProject.code}`);
        } catch (error) {
            console.error("Erreur création projet:", error);
            toast.error(error instanceof Error ? error.message : "Erreur lors de la création du projet");
            setCreating(false);
        }
    };

    const step = STEPS[currentStep - 1];

    // ── Rendu ──
    return (
        <div className="flex h-full min-h-0 bg-canvas">
            {/* ── Étapes ── */}
            <aside className="hidden lg:flex w-[250px] flex-shrink-0 flex-col gap-5 border-r border-line bg-surface px-5 py-6 overflow-y-auto">
                <div>
                    <h1 className="text-[17px] font-semibold tracking-tight text-fg">Nouveau projet</h1>
                    <p className="mt-1 text-[12.5px] leading-snug text-fg-muted">Le projet n&apos;est créé qu&apos;à la dernière étape.</p>
                </div>

                <ol>
                    {STEPS.map((s, i) => {
                        const active = s.id === currentStep;
                        const faite = s.id < maxStep && !active;
                        const reachable = s.id <= maxStep;
                        return (
                            <li key={s.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={() => goTo(s.id)}
                                        disabled={!reachable}
                                        aria-current={active ? "step" : undefined}
                                        aria-label={`Étape ${s.id} : ${s.name}`}
                                        className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors
                                            ${faite ? "bg-success text-on-success" : active ? "bg-primary text-on-primary ring-4 ring-primary/15" : "bg-surface border-[1.5px] border-line-strong text-fg-subtle"}`}
                                    >
                                        {faite ? <Check size={14} strokeWidth={3} /> : s.id}
                                    </button>
                                    {i < STEPS.length - 1 && <div className={`w-0.5 flex-1 min-h-[26px] my-1 rounded ${s.id < maxStep ? "bg-success" : "bg-line"}`} />}
                                </div>
                                <div className="min-w-0 pt-1 pb-4">
                                    <button
                                        type="button"
                                        onClick={() => goTo(s.id)}
                                        disabled={!reachable}
                                        className={`block max-w-full text-left text-[13.5px] ${active ? "font-bold text-primary-fg" : faite ? "font-semibold text-fg" : "font-semibold text-fg-muted"}`}
                                    >
                                        {s.name}
                                    </button>
                                    <p className={`mt-0.5 text-[12px] leading-snug ${faite ? "text-fg-muted" : "text-fg-subtle"} ${summaries[s.id] ? "line-clamp-2" : "truncate"}`}>
                                        {summaries[s.id] || s.detail}
                                    </p>
                                    {faite && (
                                        <button type="button" onClick={() => goTo(s.id)} className="mt-1 text-[11.5px] font-semibold text-primary-fg hover:underline">
                                            Modifier
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>

                <div className="mt-auto flex items-start gap-2 text-[12px] leading-snug text-fg-subtle">
                    <Info size={15} className="mt-px flex-shrink-0" />
                    Chaque étape reste modifiable jusqu&apos;à la création.
                </div>
            </aside>

            {/* ── Formulaire ── */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Étapes en barre, quand la colonne de gauche ne tient pas */}
                <div className="lg:hidden flex-shrink-0 border-b border-line bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-fg">Nouveau projet</span>
                        <span className="text-[12px] text-fg-muted">Étape {currentStep} sur {LAST_STEP} · {step.name}</span>
                    </div>
                    <div className="mt-2.5 h-1 rounded-full bg-inset overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${(currentStep / LAST_STEP) * 100}%` }} />
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="max-w-[900px] px-5 sm:px-8 pt-6 pb-5">
                        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-fg-subtle">Étape {currentStep} sur {LAST_STEP}</p>
                        <h2 className="mt-1 text-[21px] font-bold tracking-tight text-fg">{step.name}</h2>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{step.intro}</p>

                        <div className="mt-5">
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    <Field label="Nom du projet" required error={showInfoErrors ? errors.titre : undefined}>
                                        <input id="projet-titre" type="text" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Ligne 225 kV Mbakaou – Tibati" className={fieldClass} autoFocus />
                                    </Field>
                                    <Field label="Description">
                                        <textarea id="projet-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objet du projet, ouvrages principaux, bénéficiaires…" className={`${fieldClass} h-auto py-2.5 resize-none`} />
                                    </Field>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Date de début" required error={showInfoErrors ? errors.dateDebut : undefined}>
                                            <input id="projet-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={fieldClass} />
                                        </Field>
                                        <Field label="Date de fin prévue" required error={showInfoErrors ? errors.dateFin : undefined} hint={duree && !errors.dateFin ? `Durée : ${dureeLabel(duree)}` : undefined}>
                                            <input id="projet-fin" type="date" value={dateFin} min={dateDebut || undefined} onChange={(e) => setDateFin(e.target.value)} className={fieldClass} />
                                        </Field>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-[12.5px] text-fg-muted">
                                        <span className="font-mono font-semibold text-fg">{projectCode}</span> code attribué automatiquement, il identifie le projet dans toute l&apos;application.
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <LocalisationStep region={region} setRegion={setRegion} departement={departement} setDepartement={setDepartement} ville={ville} setVille={setVille} localite={localite} setLocalite={setLocalite} lat={lat} setLat={setLat} lng={lng} setLng={setLng} autoDetected={autoDetected} setAutoDetected={setAutoDetected} />
                            )}

                            {currentStep === 3 && (
                                <FinancementEditor value={financement} onChange={setFinancement} showErrors={showFinancementErrors} />
                            )}

                            {currentStep === 4 && (
                                <div className="space-y-4">
                                    <AllocationGauge
                                        allocated={budgetAlloue}
                                        total={financementPreview.total}
                                        status={allocation}
                                        share={partAllouee}
                                        parts={components.filter((c) => c.budget).map((c) => shareOf(toFCFA(c.budget, c.devise, financement.tauxChange), financementPreview.total))}
                                    />
                                    <StructureTreeEditor
                                        value={components}
                                        onChange={setComponents}
                                        referenceFCFA={financementPreview.total}
                                        rates={financement.tauxChange}
                                        onConfirmRemove={(name, apply) => setPendingRemoval({ name, apply })}
                                    />
                                </div>
                            )}

                            {currentStep === 5 && (
                                <div className="space-y-3">
                                    {(allocation === "under" || allocation === "over" || !lieu || sources.length === 0) && (
                                        <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-4 py-3">
                                            <p className="flex items-center gap-2 text-[13px] font-semibold text-warning"><AlertTriangle size={15} /> À compléter plus tard</p>
                                            <ul className="mt-1.5 ml-6 list-disc space-y-0.5 text-[12.5px] text-fg-muted">
                                                {!lieu && <li>Localisation non renseignée.</li>}
                                                {sources.length === 0 && <li>Aucune source de financement : le budget du projet est à 0.</li>}
                                                {allocation === "under" && <li>Il reste {formatShare(100 - partAllouee)} du budget à répartir sur les composantes.</li>}
                                                {allocation === "over" && <li>Les composantes dépassent le budget financé de {formatShare(partAllouee - 100)}.</li>}
                                            </ul>
                                            <p className="mt-1.5 text-[12px] text-fg-subtle">Rien de bloquant : le projet peut être créé.</p>
                                        </div>
                                    )}

                                    <ReviewSection title="Informations" onEdit={() => goTo(1)}>
                                        <ReviewRow label="Nom" value={titre} />
                                        <ReviewRow label="Code" value={<span className="font-mono">{projectCode}</span>} />
                                        <ReviewRow label="Période" value={periode || "—"} />
                                        {description.trim() && <ReviewRow label="Description" value={description} />}
                                    </ReviewSection>

                                    <ReviewSection title="Localisation" onEdit={() => goTo(2)}>
                                        <ReviewRow label="Lieu" value={[lieu, localite].filter(Boolean).join(" · ") || "—"} />
                                        {lat && lng && <ReviewRow label="Coordonnées" value={<span className="font-mono">{lat}, {lng}</span>} />}
                                    </ReviewSection>

                                    <ReviewSection title="Financement" onEdit={() => goTo(3)}>
                                        <ReviewRow label="Mode" value={financement.type === "MOP" ? "Maîtrise d'ouvrage publique (MOP)" : "Partenariat public-privé (PPP)"} />
                                        <ReviewRow label="Budget total" value={<span className="font-semibold tabular-nums">{fcfa(financementPreview.total)}</span>} />
                                        {sources.map((s) => (
                                            <ReviewRow key={s.id} label={<span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-sm ${s.color}`} />{s.nom}</span>} value={<span className="tabular-nums">{fcfa(s.amount)} · {formatShare(s.pct)}</span>} />
                                        ))}
                                    </ReviewSection>

                                    <ReviewSection title="Structure" onEdit={() => goTo(4)}>
                                        <p className="pb-2 text-[12.5px] text-fg-muted">{structureLabel}</p>
                                        <ul className="space-y-1 text-[13px]">
                                            {components.map((c, ci) => (
                                                <li key={c.id}>
                                                    <div className="flex items-baseline justify-between gap-3">
                                                        <span className="font-semibold text-fg"><span className="font-mono text-fg-subtle mr-2">{ci + 1}</span>{c.name}</span>
                                                        {c.budget ? <span className="text-[12.5px] tabular-nums text-fg-muted">{formatMoney(c.budget, 0)} {c.devise}</span> : null}
                                                    </div>
                                                    {c.sousComposants.map((sc, si) => (
                                                        <div key={sc.id} className="ml-6">
                                                            <div className="text-fg"><span className="font-mono text-fg-subtle mr-2">{ci + 1}.{si + 1}</span>{sc.name}</div>
                                                            {sc.activities.map((a, ai) => (
                                                                <div key={a.id} className="ml-6 flex items-center gap-2 text-fg-muted">
                                                                    <span className="font-mono text-fg-subtle">{ci + 1}.{si + 1}.{ai + 1}</span>
                                                                    <span className={`w-2 h-2 rounded-sm ${ACTIVITY_TYPES[a.typeActivite ?? "travaux"].pastille}`} />
                                                                    {a.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </li>
                                            ))}
                                        </ul>
                                    </ReviewSection>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <footer className="flex-shrink-0 h-16 border-t border-line bg-surface px-5 sm:px-8 flex items-center gap-2.5">
                    {currentStep > 1 && (
                        <button type="button" onClick={() => setCurrentStep(currentStep - 1)} className="h-9 px-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface text-[13px] font-semibold text-fg hover:bg-hover transition-colors">
                            <ArrowLeft size={14} /> Précédent
                        </button>
                    )}
                    <div className="flex-1" />
                    <Link href="/projects" className="h-9 px-3 inline-flex items-center rounded-[var(--radius-md)] text-[13px] font-medium text-fg-muted hover:text-fg hover:bg-hover transition-colors">
                        Annuler
                    </Link>
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={creating}
                        className="h-9 px-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-hover disabled:opacity-60 transition-colors"
                    >
                        {currentStep === LAST_STEP && <Check size={15} strokeWidth={2.5} />}
                        {currentStep < LAST_STEP ? `Continuer · ${STEPS[currentStep].name}` : creating ? "Création…" : "Créer le projet"}
                        {currentStep < LAST_STEP && <ArrowRight size={14} />}
                    </button>
                </footer>
            </div>

            {/* ── Aperçu ── */}
            <aside className="hidden xl:flex w-[300px] flex-shrink-0 flex-col gap-3.5 border-l border-line bg-surface px-5 py-6 overflow-y-auto">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-fg-subtle">Aperçu du projet</span>

                <div className="space-y-2">
                    <h3 className={`text-[16px] font-bold leading-snug break-words ${titre.trim() ? "text-fg" : "text-fg-subtle italic font-semibold"}`}>{titre.trim() || "Nom à saisir"}</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] px-1.5 py-px rounded-[var(--radius-sm)] border border-line bg-inset text-fg-muted">{projectCode}</span>
                        <span className="text-[11.5px] text-fg-subtle">code attribué automatiquement</span>
                    </div>
                </div>

                <div className="rounded-[var(--radius-md)] bg-primary-subtle px-3.5 py-3">
                    <p className="text-[11.5px] font-semibold text-primary-fg">Budget total</p>
                    <p className="mt-0.5 text-[23px] font-bold tracking-tight tabular-nums text-primary-fg">{financementPreview.total > 0 ? fcfaCourt(financementPreview.total) : "—"}</p>
                    <p className="mt-0.5 text-[11.5px] text-primary-fg/80">Calculé depuis les sources de financement</p>
                </div>

                <div>
                    <ApercuRow icon={CalendarDays} label="Période" value={periode} vide="À définir" />
                    <ApercuRow icon={MapPin} label="Localisation" value={lieu} vide="Non renseignée" />
                    <ApercuRow icon={Coins} label="Financement" value={financementLabel} vide="Aucune source">
                        {sources.length > 0 && financementPreview.total > 0 && (
                            <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-inset">
                                {sources.filter((s) => s.pct > 0).map((s) => <div key={s.id} className={s.color} style={{ width: `${s.pct}%` }} title={`${s.nom} : ${formatShare(s.pct)}`} />)}
                            </div>
                        )}
                    </ApercuRow>
                    <ApercuRow icon={Layers} label="Structure" value={totalActivities > 0 || totalSC > 0 || components.length > 1 ? structureLabel : ""} vide="À définir à l'étape suivante">
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {typeCounts(components).map(([type, n]) => (
                                <span key={type} className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[var(--radius-sm)] border border-line text-[11.5px] text-fg-muted">
                                    <span className={`w-[7px] h-[7px] rounded-sm ${ACTIVITY_TYPES[type].pastille}`} />
                                    {ACTIVITY_TYPES[type].court} · {n}
                                </span>
                            ))}
                        </div>
                        {financementPreview.total > 0 && budgetAlloue > 0 && (
                            <p className="mt-2 text-[11.5px] text-fg-subtle">{formatShare(partAllouee)} du budget réparti</p>
                        )}
                    </ApercuRow>
                </div>
            </aside>

            <ConfirmDialog
                isOpen={pendingRemoval !== null}
                title="Supprimer cet élément ?"
                message={`« ${pendingRemoval?.name ?? ""} » et tout ce qu'il contient seront retirés de la structure.`}
                confirmLabel="Supprimer"
                cancelLabel="Annuler"
                variant="danger"
                onConfirm={() => { pendingRemoval?.apply(); setPendingRemoval(null); }}
                onCancel={() => setPendingRemoval(null)}
            />
        </div>
    );
}

function ApercuRow({ icon: Icon, label, value, vide, children }: { icon: LucideIcon; label: string; value: string; vide: string; children?: React.ReactNode }) {
    return (
        <div className="flex gap-2.5 py-2.5 border-t border-line">
            <Icon size={16} className="mt-0.5 flex-shrink-0 text-fg-subtle" />
            <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-fg-subtle">{label}</p>
                <p className={`text-[13px] leading-snug ${value ? "font-semibold text-fg" : "italic text-fg-subtle"}`}>{value || vide}</p>
                {value && children}
            </div>
        </div>
    );
}

function AllocationGauge({ allocated, total, status, share, parts }: { allocated: number; total: number; status: AllocationStatus; share: number; parts: number[] }) {
    if (status === "undefined") {
        return (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-[12.5px] text-fg-muted">
                <Coins size={18} className="flex-shrink-0 text-fg-subtle" />
                Aucun financement saisi : les budgets des composantes seront enregistrés sans pondération.
            </div>
        );
    }
    const tone = status === "balanced" ? "text-success" : status === "over" ? "text-danger" : "text-warning";
    const bar = status === "balanced" ? "bg-success" : status === "over" ? "bg-danger" : "bg-primary";
    return (
        <div className="flex items-center gap-3.5 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3">
            <Coins size={18} className={`flex-shrink-0 ${status === "balanced" ? "text-success" : "text-fg-subtle"}`} />
            <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="text-fg-muted">
                        <span className="font-bold tabular-nums text-fg">{fcfa(allocated)}</span> répartis sur {fcfa(total)}
                    </span>
                    <span className={`font-semibold ${tone}`}>
                        {status === "balanced" && "100 % · pondérations complètes"}
                        {status === "under" && `Reste ${fcfa(total - allocated)} (${formatShare(100 - share)})`}
                        {status === "over" && `Dépassement de ${fcfa(allocated - total)}`}
                    </span>
                </div>
                {/* Une part par composante, dans l'ordre du tableau. */}
                <div className="flex h-2 gap-0.5 rounded-full bg-inset overflow-hidden">
                    {parts.map((part, i) => (
                        <div key={i} className={`${bar} transition-all`} style={{ width: `${Math.min(100, part)}%`, opacity: 1 - Math.min(0.55, i * 0.28) }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
    return (
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface">
            <div className="flex items-center justify-between px-4 h-11 border-b border-line">
                <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
                <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-fg hover:underline">
                    <Pencil size={13} /> Modifier
                </button>
            </div>
            <div className="px-4 py-3 space-y-1.5">{children}</div>
        </section>
    );
}

function ReviewRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 text-[13px]">
            <span className="text-fg-muted">{label}</span>
            <span className="text-fg break-words">{value}</span>
        </div>
    );
}
