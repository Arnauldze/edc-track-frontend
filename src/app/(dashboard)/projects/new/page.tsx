"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle2, ChevronUp, ChevronDown, Layers, DollarSign } from "lucide-react";
import Link from "next/link";
import { addProject, generateProjectCode, ACTIVITY_TYPES, getActivityName, getActivityType, isComponentLowestLevel, isSousComposantLowestLevel, type ComponentData, type SousComposantData, type ActivityDef } from "@/lib/projectStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CURRENCIES, formatCurrency } from "@/lib/helpers/currencyHelpers";
import { FinancementEditor } from "@/components/financing/FinancementEditor";
import { computeFinancementPreview, emptyFinancement, financementToPayload, validateFinancement, type FinancementFormValue } from "@/lib/financement";
import { CAMEROON_DATA, CITY_COORDS, REGIONS } from "@/lib/cameroonGeo";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type ConfirmState = {
  type: "component" | "subcomponent" | "activity";
  title: string;
  message: string;
  onConfirm: () => void;
} | null;

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
            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className={`relative ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
                <input
                    type="text"
                    value={query || value}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(""); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all pr-8"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </div>

            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] max-h-48 overflow-y-auto">
                    {filtered.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => { onChange(opt); setQuery(""); setOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[var(--bg-surface-hover)] transition-colors ${opt === value ? "text-[var(--accent)] font-semibold bg-[var(--accent-subtle)]" : "text-[var(--text-primary)]"
                                }`}
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
            <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0 mt-0.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
                    <strong>Localisation optionnelle :</strong> Vous pouvez localiser votre projet en sélectionnant la région, le département et la ville. Les coordonnées GPS seront <strong>détectées automatiquement</strong>. Vous pouvez aussi laisser vide et compléter plus tard.
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
                <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Localité précise</label>
                <input
                    type="text"
                    value={localite}
                    onChange={(e) => setLocalite(e.target.value)}
                    placeholder="ex: Rive droite du fleuve Sanaga, PK 42..."
                    className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
            </div>

            {/* GPS Coordinates */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <label className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Coordonnées GPS</label>
                    {autoDetected ? (
                        <span className="text-[10px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full font-bold border border-green-500/20 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                            Auto-détecté
                        </span>
                    ) : (
                        <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded-full font-medium border border-[var(--border-default)]">Sélectionnez une ville</span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <input
                            type="text"
                            value={lat}
                            onChange={(e) => { setLat(e.target.value); setAutoDetected(false); }}
                            placeholder="Latitude (ex: 5.5321)"
                            className={`w-full border rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all ${autoDetected
                                ? "bg-green-500/5 border-green-500/30 text-[var(--text-primary)]"
                                : "bg-[var(--bg-inset)] border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                                }`}
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={lng}
                            onChange={(e) => { setLng(e.target.value); setAutoDetected(false); }}
                            placeholder="Longitude (ex: 13.6163)"
                            className={`w-full border rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all ${autoDetected
                                ? "bg-green-500/5 border-green-500/30 text-[var(--text-primary)]"
                                : "bg-[var(--bg-inset)] border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                                }`}
                        />
                    </div>
                </div>
                {autoDetected && (
                    <p className="text-[10px] text-green-600 mt-1.5 flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                        Position approximative de {ville}. Vous pouvez ajuster manuellement si nécessaire.
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
// STEPS
// ══════════════════════════════════════


const steps = [
    { id: 1, name: "Informations" },
    { id: 2, name: "Localisation" },
    { id: 3, name: "Financement" },
    { id: 4, name: "Structure" },
    { id: 5, name: "Arborescence" },
    { id: 6, name: "Résumé" },
];

// ══════════════════════════════════════
// PAGE
// ══════════════════════════════════════

export default function NewProjectPage() {
    const router = useRouter();
    const { data: currentUser } = useCurrentUser();

    // Sans droit de création, inutile de parcourir les six étapes pour se voir
    // refuser l'enregistrement à la fin : le serveur rejetterait la création.
    useEffect(() => {
        if (currentUser && !currentUser.canCreateProjects) {
            toast.error("Vous n'êtes pas autorisé à créer des projets");
            router.replace("/projects");
        }
    }, [currentUser, router]);
    const [currentStep, setCurrentStep] = useState(1);
    const [projectCode] = useState(generateProjectCode());

    // Step 1 state
    const [titre, setTitre] = useState("");
    const [description, setDescription] = useState("");
    const [dateDebut, setDateDebut] = useState("");
    const [dateFin, setDateFin] = useState("");

    // Step 2 state (lifted from LocalisationStep)
    const [region, setRegion] = useState("");
    const [departement, setDepartement] = useState("");
    const [ville, setVille] = useState("");
    const [localite, setLocalite] = useState("");
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [autoDetected, setAutoDetected] = useState(false);

    // Step 3 state (financement) — voir lib/financement.ts
    const [financement, setFinancement] = useState<FinancementFormValue>(emptyFinancement);
    const [showFinancementErrors, setShowFinancementErrors] = useState(false);
    const financementPreview = computeFinancementPreview(financement);

    const [confirmState, setConfirmState] = useState<ConfirmState>(null);

    // Step 4 state (structure)
    const [components, setComponents] = useState<ComponentData[]>([
        { id: "c1", name: "Barrage", budget: 0, devise: "FCFA", ponderation: 0, sousComposants: [{ id: "sc1", name: "Fondations", activities: [{ name: "Fouilles", typeActivite: "travaux" }, { name: "Béton de propreté", typeActivite: "travaux" }] }] },
    ]);
    
    // États pour gérer le pliage/dépliage dans l'arborescence (Step 5)
    const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
    const [expandedSousComposants, setExpandedSousComposants] = useState<Set<string>>(new Set());
    
    // Initialiser tous les éléments comme dépliés par défaut
    useEffect(() => {
        const allCompIds = new Set(components.map(c => c.id));
        const allScIds = new Set(components.flatMap(c => c.sousComposants.map(sc => sc.id)));
        setExpandedComponents(allCompIds);
        setExpandedSousComposants(allScIds);
    }, [components]);
    
    const toggleComponent = (compId: string) => {
        setExpandedComponents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(compId)) {
                newSet.delete(compId);
            } else {
                newSet.add(compId);
            }
            return newSet;
        });
    };
    
    const toggleSousComposant = (scId: string) => {
        setExpandedSousComposants(prev => {
            const newSet = new Set(prev);
            if (newSet.has(scId)) {
                newSet.delete(scId);
            } else {
                newSet.add(scId);
            }
            return newSet;
        });
    };

    const addComponent = () => {
        // Nouvelle composante sans sous-composantes = niveau le plus bas, donc ajouter typeActivite
        setComponents(prev => [...prev, { id: `c${Date.now()}`, name: "", budget: 0, devise: "FCFA", ponderation: 0, sousComposants: [], typeActivite: "travaux" }]);
    };
    const removeComponent = (idx: number) => {
        setConfirmState({
            type: "component",
            title: "Supprimer le composant",
            message: "Êtes-vous sûr de vouloir supprimer ce composant ? Cette action est irréversible.",
            onConfirm: () => {
                setComponents(prev => prev.filter((_, i) => i !== idx));
            }
        });
    };
    const updateComponentName = (idx: number, name: string) => {
        setComponents(prev => prev.map((c, i) => i === idx ? { ...c, name } : c));
    };
    const addSousComposant = (compIdx: number) => {
        setComponents(prev => prev.map((c, i) => {
            if (i !== compIdx) return c;
            // Quand on ajoute une sous-composante, retirer le typeActivite de la composante
            const { typeActivite, ...compWithoutType } = c;
            return { 
                ...compWithoutType, 
                sousComposants: [...c.sousComposants, { id: `sc${Date.now()}`, name: "", activities: [] }] 
            };
        }));
    };
    const removeSousComposant = (compIdx: number, scIdx: number) => {
        setConfirmState({
            type: "subcomponent",
            title: "Supprimer le sous-composant",
            message: "Êtes-vous sûr de vouloir supprimer ce sous-composant ? Cette action est irréversible.",
            onConfirm: () => {
                setComponents(prev => prev.map((c, ci) => {
                    if (ci !== compIdx) return c;
                    const updatedSCs = c.sousComposants.filter((_, si) => si !== scIdx);
                    // Si on supprime la dernière sous-composante, ajouter typeActivite à la composante
                    if (updatedSCs.length === 0) {
                        return { ...c, sousComposants: updatedSCs, typeActivite: "travaux" };
                    }
                    return { ...c, sousComposants: updatedSCs };
                }));
            }
        });
    };
    const updateSCName = (compIdx: number, scIdx: number, name: string) => {
        setComponents(prev => prev.map((c, ci) => ci === compIdx ? { ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? { ...sc, name } : sc) } : c));
    };
    const addActivity = (compIdx: number, scIdx: number, typeActivite: string = "travaux") => {
        const newAct: ActivityDef = { name: "", typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' };
        setComponents(prev => prev.map((c, ci) => {
            if (ci !== compIdx) return c;
            return {
                ...c,
                sousComposants: c.sousComposants.map((sc, si) => {
                    if (si !== scIdx) return sc;
                    // Quand on ajoute une activité, retirer le typeActivite de la sous-composante
                    const { typeActivite: scType, ...scWithoutType } = sc;
                    return { ...scWithoutType, activities: [...sc.activities, newAct] };
                })
            };
        }));
    };
    const updateActivity = (compIdx: number, scIdx: number, actIdx: number, val: string) => {
        setComponents(prev => prev.map((c, ci) => ci === compIdx ? { ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? { ...sc, activities: sc.activities.map((a, ai) => ai === actIdx ? { ...a, name: val } : a) } : sc) } : c));
    };
    const updateActivityType = (compIdx: number, scIdx: number, actIdx: number, typeActivite: string) => {
        setComponents(prev => prev.map((c, ci) => ci === compIdx ? { ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? { ...sc, activities: sc.activities.map((a, ai) => ai === actIdx ? { ...a, typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' } : a) } : sc) } : c));
    };
    const removeActivity = (compIdx: number, scIdx: number, actIdx: number) => {
        setConfirmState({
            type: "activity",
            title: "Supprimer l'activité",
            message: "Êtes-vous sûr de vouloir supprimer cette activité ? Cette action est irréversible.",
            onConfirm: () => {
                setComponents(prev => prev.map((c, ci) => {
                    if (ci !== compIdx) return c;
                    return {
                        ...c,
                        sousComposants: c.sousComposants.map((sc, si) => {
                            if (si !== scIdx) return sc;
                            const updatedActivities = sc.activities.filter((_, ai) => ai !== actIdx);
                            // Si on supprime la dernière activité, ajouter typeActivite à la sous-composante
                            if (updatedActivities.length === 0) {
                                return { ...sc, activities: updatedActivities, typeActivite: "travaux" };
                            }
                            return { ...sc, activities: updatedActivities };
                        })
                    };
                }));
            }
        });
    };

    // Budget par composant
    const updateComponentBudget = (idx: number, budget: string) => {
        setComponents(prev => prev.map((c, i) => i === idx ? { ...c, budget: budget ? parseFloat(budget) : undefined } : c));
    };

    // Devise par composant
    const updateComponentDevise = (idx: number, devise: string) => {
        setComponents(prev => prev.map((c, i) => i === idx ? { ...c, devise } : c));
    };

    // Pondération par composant
    const updateComponentPonderation = (idx: number, ponderation: string) => {
        setComponents(prev => prev.map((c, i) => i === idx ? { ...c, ponderation: ponderation ? parseFloat(ponderation) : undefined } : c));
    };

    // Calculer le total des pondérations
    const totalPonderation = components.reduce((sum, c) => sum + (c.ponderation || 0), 0);

    // Calculer le budget total par devise
    const budgetParDevise = components.reduce((acc, c) => {
        if (c.budget && c.devise) {
            acc[c.devise] = (acc[c.devise] || 0) + c.budget;
        }
        return acc;
    }, {} as Record<string, number>);

    // Calculer le budget total converti en FCFA
    const budgetTotalFCFA = components.reduce((sum, c) => {
        if (c.budget && c.devise) {
            const rate = financement.tauxChange[c.devise] || 1;
            return sum + (c.budget * rate);
        }
        return sum;
    }, 0);

    // TypeActivite pour composantes et sous-composantes
    const updateComponentType = (idx: number, typeActivite: string) => {
        setComponents(prev => prev.map((c, i) => i === idx ? { ...c, typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' } : c));
    };
    const updateSCType = (compIdx: number, scIdx: number, typeActivite: string) => {
        setComponents(prev => prev.map((c, ci) => ci === compIdx ? { ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? { ...sc, typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' } : sc) } : c));
    };

    // ═══ Réordonnancement (même niveau) ═══
    const moveComponentUp = (idx: number) => {
        if (idx <= 0) return;
        setComponents(prev => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; });
    };
    const moveComponentDown = (idx: number) => {
        setComponents(prev => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a; });
    };
    const moveSCUp = (ci: number, si: number) => {
        if (si <= 0) return;
        setComponents(prev => prev.map((c, i) => { if (i !== ci) return c; const a = [...c.sousComposants]; [a[si - 1], a[si]] = [a[si], a[si - 1]]; return { ...c, sousComposants: a }; }));
    };
    const moveSCDown = (ci: number, si: number) => {
        setComponents(prev => prev.map((c, i) => { if (i !== ci) return c; if (si >= c.sousComposants.length - 1) return c; const a = [...c.sousComposants]; [a[si], a[si + 1]] = [a[si + 1], a[si]]; return { ...c, sousComposants: a }; }));
    };
    const moveActivityUp = (ci: number, si: number, ai: number) => {
        if (ai <= 0) return;
        setComponents(prev => prev.map((c, i) => i === ci ? { ...c, sousComposants: c.sousComposants.map((sc, j) => { if (j !== si) return sc; const a = [...sc.activities]; [a[ai - 1], a[ai]] = [a[ai], a[ai - 1]]; return { ...sc, activities: a }; }) } : c));
    };
    const moveActivityDown = (ci: number, si: number, ai: number) => {
        setComponents(prev => prev.map((c, i) => i === ci ? { ...c, sousComposants: c.sousComposants.map((sc, j) => { if (j !== si) return sc; if (ai >= sc.activities.length - 1) return sc; const a = [...sc.activities]; [a[ai], a[ai + 1]] = [a[ai + 1], a[ai]]; return { ...sc, activities: a }; }) } : c));
    };

    // ═══ Promotion hiérarchique (monter d'un cran) ═══

    // Activité → Sous-composant (dans le même composant)
    const promoteActivity = (ci: number, si: number, ai: number) => {
        setComponents(prev => prev.map((c, i) => {
            if (i !== ci) return c;
            const actName = getActivityName(c.sousComposants[si].activities[ai]);
            const newSC: SousComposantData = { id: `sc${Date.now()}`, name: actName, activities: [] };
            const updatedSC = c.sousComposants.map((sc, j) => j === si ? { ...sc, activities: sc.activities.filter((_, k) => k !== ai) } : sc);
            // Insérer la nouvelle SC juste après la SC actuelle
            updatedSC.splice(si + 1, 0, newSC);
            return { ...c, sousComposants: updatedSC };
        }));
    };

    // Sous-composant → Composant
    const promoteSC = (ci: number, si: number) => {
        setComponents(prev => {
            const comp = prev[ci];
            const sc = comp.sousComposants[si];
            const newComp: ComponentData = { id: `c${Date.now()}`, name: sc.name, sousComposants: [] };
            // Si la SC a des activités, on les met comme SCs enfants du nouveau composant
            if (sc.activities.length > 0) {
                newComp.sousComposants = sc.activities.map((a, idx) => ({ id: `sc${Date.now() + idx + 1}`, name: getActivityName(a), activities: [] }));
            }
            // Retirer la SC du composant parent
            const updatedComp = { ...comp, sousComposants: comp.sousComposants.filter((_, j) => j !== si) };
            const result = [...prev];
            result[ci] = updatedComp;
            // Insérer le nouveau composant juste après
            result.splice(ci + 1, 0, newComp);
            return result;
        });
    };

    // ═══ Rétrogradation hiérarchique (descendre d'un cran) ═══

    // Composant → Sous-composant (du composant précédent)
    const demoteComponent = (ci: number) => {
        if (ci <= 0) return; // Pas de composant avant pour l'accueillir
        setComponents(prev => {
            const comp = prev[ci];
            const newSC: SousComposantData = { id: `sc${Date.now()}`, name: comp.name, activities: comp.sousComposants.flatMap(sc => sc.activities.length > 0 ? sc.activities : [{ name: sc.name, typeActivite: "travaux" } as const]) };
            const result = prev.filter((_, i) => i !== ci);
            result[ci - 1] = { ...result[ci - 1], sousComposants: [...result[ci - 1].sousComposants, newSC] };
            return result;
        });
    };

    // Sous-composant → Activité (de la sous-composant précédente)
    const demoteSC = (ci: number, si: number) => {
        if (si <= 0) return; // Pas de SC avant pour l'accueillir
        setComponents(prev => prev.map((c, i) => {
            if (i !== ci) return c;
            const sc = c.sousComposants[si];
            const updatedSCs = c.sousComposants.filter((_, j) => j !== si);
            // Ajouter le nom de la SC comme activité à la SC précédente, + ses activités
            const prevSCIdx = si - 1;
            updatedSCs[prevSCIdx] = {
                ...updatedSCs[prevSCIdx],
                activities: [...updatedSCs[prevSCIdx].activities, { name: sc.name, typeActivite: "travaux" }, ...sc.activities],
            };
            return { ...c, sousComposants: updatedSCs };
        }));
    };

    const totalActivities = components.reduce((sum, c) => sum + c.sousComposants.reduce((s, sc) => s + sc.activities.length, 0), 0);
    const totalSC = components.reduce((sum, c) => sum + c.sousComposants.length, 0);

    const handleCreate = async () => {
        try {
            // Construire l'objet projet au format attendu par le backend
            const projectData = {
                name: titre || "Nouveau Projet",
                description: description || "Projet d'infrastructure",
                progress: 0,
                localisation: {
                    region: region || undefined,
                    departement: departement || undefined,
                    ville: ville || undefined,
                    localite: localite || undefined,
                    coordinates: (lat && lng) ? {
                        lat: parseFloat(lat),
                        lng: parseFloat(lng)
                    } : undefined
                },
                // Budget et pourcentages : calculés par le serveur à partir du financement
                financement: financementToPayload(financement),
                dateDebut: dateDebut || undefined,
                dateFin: dateFin || undefined,
                components: components.map(comp => ({
                    id: comp.id,
                    name: comp.name,
                    budget: comp.budget ? parseFloat(comp.budget.toString()) : undefined,
                    typeActivite: comp.typeActivite,
                    sousComposants: comp.sousComposants.map(sc => ({
                        id: sc.id,
                        name: sc.name,
                        typeActivite: sc.typeActivite,
                        activities: sc.activities.map(act => ({
                            name: act.name,
                            typeActivite: act.typeActivite
                        }))
                    }))
                }))
            };

            const createdProject = await addProject(projectData);
            toast.success("Projet créé avec succès. Redirection...");
            setTimeout(() => router.push(`/projects/${createdProject.code}`), 1500);
        } catch (error: any) {
            console.error('Erreur création projet:', error);
            toast.error(error.message || "Erreur lors de la création du projet");
        }
    };

    const handleNext = () => {
        if (currentStep === 3 && validateFinancement(financement).length > 0) {
            setShowFinancementErrors(true);
            toast.error("Le financement comporte des erreurs à corriger");
            return;
        }
        if (currentStep < 6) setCurrentStep(currentStep + 1);
        else handleCreate();
    };
    const handlePrev = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    return (
        <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full max-w-4xl mx-auto relative">
            {/* ── Header ── */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <Link href="/projects" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
                        Nouveau Projet
                    </h1>
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-medium ml-[30px]">
                    Créez un nouveau projet en suivant les étapes ci-dessous
                </p>
            </div>

            {/* ── Stepper ── */}
            <div className="flex items-center justify-between mb-8 px-4">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center flex-1 last:flex-none">
                        {/* Step circle + label */}
                        <div className="flex flex-col items-center relative z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-all duration-300
                                ${step.id < currentStep
                                    ? "bg-green-500 border-green-500 text-white"
                                    : step.id === currentStep
                                        ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--text-inverted)]"
                                        : "bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-tertiary)]"
                                }`}
                            >
                                {step.id < currentStep ? <Check size={14} /> : step.id}
                            </div>
                            <span className={`mt-2 text-[11px] font-semibold whitespace-nowrap transition-colors
                                ${step.id === currentStep
                                    ? "text-[var(--text-primary)]"
                                    : step.id < currentStep
                                        ? "text-green-500"
                                        : "text-[var(--text-tertiary)]"
                                }`}
                            >
                                {step.name}
                            </span>
                        </div>

                        {/* Connector line */}
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-3 mt-[-20px]">
                                <div className={`h-[2px] rounded-full transition-colors duration-300
                                    ${step.id < currentStep ? "bg-green-500" : "bg-[var(--border-default)]"}`}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Content Card ── */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] mb-6">

                {/* Step 1: Informations */}
                {currentStep === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="col-span-2">
                            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Titre du projet <span className="text-red-500">*</span></label>
                            <input type="text" value={titre} onChange={e => setTitre(e.target.value)} placeholder="ex: Barrage de Lom Pangar" className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Code du projet</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={projectCode} readOnly className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-tertiary)] cursor-not-allowed opacity-60" />
                                <span className="bg-[var(--accent-subtle)] text-[var(--accent)] text-[10px] px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--accent)]/20 font-bold">Auto</span>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Description</label>
                            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez le projet..." className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all resize-none" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Date début <span className="text-red-500">*</span></label>
                            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Date fin prévue <span className="text-red-500">*</span></label>
                            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all" />
                        </div>
                    </div>
                )}

                {/* Step 2: Localisation */}
                {currentStep === 2 && <LocalisationStep region={region} setRegion={setRegion} departement={departement} setDepartement={setDepartement} ville={ville} setVille={setVille} localite={localite} setLocalite={setLocalite} lat={lat} setLat={setLat} lng={lng} setLng={setLng} autoDetected={autoDetected} setAutoDetected={setAutoDetected} />}

                {/* Step 3: Financement */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
                                Définissez le cadre juridique et les sources de financement du projet. Le budget total sera calculé automatiquement à partir des contributions. Les sources pourront être complétées plus tard depuis la fiche du projet.
                            </p>
                        </div>
                        <FinancementEditor value={financement} onChange={setFinancement} showErrors={showFinancementErrors} />
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-5">
                        {/* ── Header : Nom du projet ── */}
                        <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
                            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">Structure du projet</div>
                                <div className="text-[15px] font-bold text-[var(--text-primary)]">{titre || "Nouveau Projet"}</div>
                            </div>
                        </div>

                        {/* ── Budget Total par devise ── */}
                        {Object.keys(budgetParDevise).length > 0 && (
                            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-[var(--radius-md)] p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign size={16} className="text-green-600" />
                                    <div className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Budget Total du Projet</div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {Object.entries(budgetParDevise).map(([devise, montant]) => {
                                        const currency = CURRENCIES.find(c => c.code === devise);
                                        return (
                                            <div key={devise} className="bg-white/50 dark:bg-black/20 rounded-[var(--radius-sm)] p-3">
                                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold mb-1">{currency?.name || devise}</div>
                                                <div className="text-[15px] font-bold text-[var(--text-primary)]">
                                                    {montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency?.symbol || devise}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Budget total converti en FCFA */}
                                {budgetTotalFCFA > 0 && (
                                    <div className="mt-3 pt-3 border-t border-green-500/20">
                                        <div className="flex items-center justify-between bg-white/50 dark:bg-black/20 rounded-[var(--radius-sm)] p-3">
                                            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase">Total alloué aux composants (FCFA) :</span>
                                            <span className="text-[16px] font-bold text-green-600">
                                                {budgetTotalFCFA.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FCFA
                                            </span>
                                        </div>
                                        {financementPreview.total > 0 && budgetTotalFCFA > financementPreview.total && (
                                            <div className="mt-2 p-2 rounded-[var(--radius-sm)] bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
                                                Les composants totalisent {formatCurrency(budgetTotalFCFA, "FCFA")}, soit {formatCurrency(budgetTotalFCFA - financementPreview.total, "FCFA")} de plus que le budget financé ({formatCurrency(financementPreview.total, "FCFA")}).
                                            </div>
                                        )}
                                        <div className="text-[9px] text-[var(--text-tertiary)] mt-1 italic">
                                            Taux de change utilisés : {Object.entries(financement.tauxChange).filter(([dev]) => dev !== 'FCFA' && budgetParDevise[dev]).map(([dev, rate]) => `1 ${dev} = ${rate.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FCFA`).join(', ')}
                                        </div>
                                    </div>
                                )}
                                {/* Total pondération */}
                                <div className="mt-3 pt-3 border-t border-green-500/20 flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Total des pondérations :</span>
                                    <span className={`text-[13px] font-bold ${totalPonderation === 100 ? 'text-green-600' : totalPonderation > 100 ? 'text-red-600' : 'text-orange-600'}`}>
                                        {totalPonderation.toFixed(2)}%
                                        {totalPonderation === 100 && <CheckCircle2 size={14} className="inline ml-1" />}
                                    </span>
                                </div>
                                {totalPonderation !== 100 && (
                                    <div className="mt-2 text-[10px] text-orange-600 dark:text-orange-400">
                                        ⚠️ Les pondérations doivent totaliser 100%
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Info compteurs ── */}
                        <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
                                <p>Définissez l&apos;arborescence. <strong>{components.length}</strong> composant{components.length > 1 ? "s" : ""}, <strong>{totalSC}</strong> sous-composant{totalSC > 1 ? "s" : ""}, <strong>{totalActivities}</strong> activité{totalActivities > 1 ? "s" : ""}. Utilisez <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-green-500/10 rounded text-green-500 text-[10px] font-bold"><ChevronUp size={9} />Monter d&apos;un niveau</span> et <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-orange-500/10 rounded text-orange-500 text-[10px] font-bold"><ChevronDown size={9} />Descendre d&apos;un niveau</span> pour changer le niveau hiérarchique.</p>
                            </div>
                        </div>

                        {/* ── Liste des composants ── */}
                        <div className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-4 space-y-3">
                            {components.map((comp, ci) => (
                                <div key={comp.id} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4">
                                    {/* ── Composant : Nom + Budget + Devise + Pondération + TypeActivite (si niveau le plus bas) + Actions ── */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="w-7 h-7 bg-blue-500/15 text-blue-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[10px] flex-shrink-0">C{ci + 1}</div>
                                        <input type="text" value={comp.name} onChange={e => updateComponentName(ci, e.target.value)} placeholder="Nom du composant..." className="flex-1 min-w-0 bg-transparent border-b-2 border-transparent hover:border-[var(--border-default)] focus:border-[var(--accent)] outline-none text-[14px] font-bold text-[var(--text-primary)] px-1 py-1 transition-colors" style={{ minWidth: '200px' }} />
                                        
                                        {/* Budget + Devise */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <div className="relative w-[120px]">
                                                <input type="number" value={comp.budget || ""} onChange={e => updateComponentBudget(ci, e.target.value)} placeholder="Budget" className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                                            </div>
                                            <select value={comp.devise || "FCFA"} onChange={e => updateComponentDevise(ci, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--text-secondary)] px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[75px] flex-shrink-0">
                                                {CURRENCIES.map(curr => (<option key={curr.code} value={curr.code}>{curr.code}</option>))}
                                            </select>
                                        </div>

                                        {/* Pondération */}
                                        <div className="relative w-[80px] flex-shrink-0">
                                            <input type="number" min="0" max="100" step="0.01" value={comp.ponderation || ""} onChange={e => updateComponentPonderation(ci, e.target.value)} placeholder="0" className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] pr-6 focus:outline-none focus:border-[var(--accent)] transition-colors" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--text-tertiary)] font-bold">%</span>
                                        </div>

                                        {/* Type d'activité (si niveau le plus bas) */}
                                        {isComponentLowestLevel(comp) && (
                                            <select value={comp.typeActivite || "travaux"} onChange={e => updateComponentType(ci, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--text-secondary)] px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[140px] flex-shrink-0">
                                                {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                            </select>
                                        )}
                                        {/* Actions à droite */}
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-1 border-l border-[var(--border-subtle)] pl-2">
                                            <button type="button" onClick={() => demoteComponent(ci)} disabled={ci === 0} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-orange-500/10 text-orange-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Transformer en Sous-composant"><ChevronDown size={16} /></button>
                                            <button type="button" onClick={() => removeComponent(ci)} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all" title="Supprimer"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    {/* ── Sous-composants ── */}
                                    <div className="ml-9 pl-3 border-l-2 border-blue-500/20 space-y-1 mt-3">
                                        {comp.sousComposants.map((sc, si) => (
                                            <div key={sc.id}>
                                                <div className="flex items-center gap-2 py-1.5">
                                                    <div className="w-5 h-5 bg-amber-500/15 text-amber-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[8px] flex-shrink-0">SC</div>
                                                    <input type="text" value={sc.name} onChange={e => updateSCName(ci, si, e.target.value)} placeholder="Sous-composant..." className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-[var(--border-default)] focus:border-[var(--accent)] outline-none text-[12px] font-semibold text-[var(--text-secondary)] px-1 py-0.5 transition-colors" />
                                                    {/* Type d'activité (si niveau le plus bas) */}
                                                    {isSousComposantLowestLevel(sc) && (
                                                        <select value={sc.typeActivite || "travaux"} onChange={e => updateSCType(ci, si, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[9px] font-semibold text-[var(--text-secondary)] px-1.5 py-1 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[120px] flex-shrink-0">
                                                            {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                                        </select>
                                                    )}
                                                    {/* Actions à droite */}
                                                    <div className="flex items-center gap-1 flex-shrink-0 border-l border-[var(--border-subtle)] pl-1.5">
                                                        <button type="button" onClick={() => promoteSC(ci, si)} className="p-1 rounded-[var(--radius-sm)] hover:bg-green-500/10 text-green-500 transition-all" title="Transformer en Composant"><ChevronUp size={15} /></button>
                                                        <button type="button" onClick={() => demoteSC(ci, si)} disabled={si === 0} className="p-1 rounded-[var(--radius-sm)] hover:bg-orange-500/10 text-orange-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Transformer en Activité"><ChevronDown size={15} /></button>
                                                        <button type="button" onClick={() => removeSousComposant(ci, si)} className="p-1 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all" title="Supprimer"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                {/* ── Activités ── */}
                                                <div className="ml-7 pl-3 border-l border-amber-500/15 space-y-0.5 mt-0.5">
                                                    {sc.activities.map((act, ai) => {
                                                        const actName = getActivityName(act);
                                                        const actType = getActivityType(act);
                                                        const TYPE_COLORS: Record<string, string> = { travaux: "bg-blue-500", fourniture: "bg-amber-500", services: "bg-green-500", etudes: "bg-purple-500", pi: "bg-rose-500" };
                                                        return (
                                                            <div key={ai} className="flex items-center gap-1.5 py-0.5 group">
                                                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TYPE_COLORS[actType] || "bg-purple-500/20"}`} />
                                                                <input type="text" value={actName} onChange={e => updateActivity(ci, si, ai, e.target.value)} placeholder="Activité..." className="flex-1 min-w-0 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] outline-none text-[11px] text-[var(--text-secondary)] px-2 py-1 focus:border-[var(--accent)] transition-colors" />
                                                                {/* Type selector */}
                                                                <select value={actType} onChange={e => updateActivityType(ci, si, ai, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[9px] font-semibold text-[var(--text-secondary)] px-1 py-1 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[120px] flex-shrink-0">
                                                                    {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                                                </select>
                                                                {/* Actions (visibles au hover) */}
                                                                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity border-l border-[var(--border-subtle)] pl-1">
                                                                    <button type="button" onClick={() => promoteActivity(ci, si, ai)} className="p-0.5 rounded-[var(--radius-sm)] hover:bg-green-500/10 text-green-500 transition-all" title="Transformer en Sous-composant"><ChevronUp size={14} /></button>
                                                                    <button type="button" onClick={() => removeActivity(ci, si, ai)} className="p-0.5 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all" title="Supprimer"><Trash2 size={11} /></button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <button type="button" onClick={() => addActivity(ci, si)} className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:underline mt-1 py-1"><Plus size={10} /> Activité</button>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addSousComposant(ci)} className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mt-2 pt-1"><Plus size={12} /> Sous-composant</button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={addComponent} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[var(--border-default)] rounded-[var(--radius-md)] text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-all">
                                <Plus size={14} /> Ajouter un composant
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 5: Arborescence (Prévisualisation) */}
                {currentStep === 5 && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
                            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                                <Layers size={16} className="text-[var(--accent)]" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">Arborescence du projet</div>
                                <div className="text-[13px] font-medium text-[var(--text-primary)]">Aperçu de la structure que vous venez de créer</div>
                            </div>
                        </div>

                        <div className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-5">
                            <ul className="space-y-4">
                                {components.map((comp, ci) => {
                                    const isCompExpanded = expandedComponents.has(comp.id);
                                    return (
                                        <li key={comp.id}>
                                            <div className="flex items-center gap-2">
                                                {/* Bouton plier/déplier composante */}
                                                {comp.sousComposants.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleComponent(comp.id)}
                                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-surface-hover)] transition-colors flex-shrink-0"
                                                        title={isCompExpanded ? "Replier" : "Déplier"}
                                                    >
                                                        {isCompExpanded ? (
                                                            <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
                                                        ) : (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-tertiary)]">
                                                                <path d="M9 18l6-6-6-6" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                )}
                                                {comp.sousComposants.length === 0 && <div className="w-5" />}
                                                
                                                <div className="w-6 h-6 bg-blue-500/15 text-blue-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[10px] flex-shrink-0">C{ci + 1}</div>
                                                <span className="text-[14px] font-bold text-[var(--text-primary)]">
                                                    {comp.name || `Composant ${ci + 1}`}
                                                </span>
                                                {comp.sousComposants.length > 0 && (
                                                    <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                                                        ({comp.sousComposants.length} SC, {comp.sousComposants.reduce((sum, sc) => sum + sc.activities.length, 0)} Act)
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {isCompExpanded && comp.sousComposants.length > 0 && (
                                                <ul className="mt-2 ml-3 pl-4 border-l-2 border-[var(--border-subtle)] space-y-3">
                                                    {comp.sousComposants.map((sc, si) => {
                                                        const isScExpanded = expandedSousComposants.has(sc.id);
                                                        return (
                                                            <li key={sc.id}>
                                                                <div className="flex items-center gap-2">
                                                                    {/* Bouton plier/déplier sous-composante */}
                                                                    {sc.activities.length > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleSousComposant(sc.id)}
                                                                            className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--bg-surface-hover)] transition-colors flex-shrink-0"
                                                                            title={isScExpanded ? "Replier" : "Déplier"}
                                                                        >
                                                                            {isScExpanded ? (
                                                                                <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
                                                                            ) : (
                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-tertiary)]">
                                                                                    <path d="M9 18l6-6-6-6" />
                                                                                </svg>
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                    {sc.activities.length === 0 && <div className="w-4" />}
                                                                    
                                                                    <div className="w-5 h-5 bg-amber-500/15 text-amber-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[8px] flex-shrink-0">SC</div>
                                                                    <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
                                                                        {sc.name || `Sous-composant ${si + 1}`}
                                                                    </span>
                                                                    {sc.activities.length > 0 && (
                                                                        <span className="text-[9px] text-[var(--text-tertiary)] font-medium">
                                                                            ({sc.activities.length} Act)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                
                                                                {isScExpanded && sc.activities.length > 0 && (
                                                                    <ul className="mt-2 ml-2 pl-4 border-l border-[var(--border-subtle)] space-y-1.5">
                                                                        {sc.activities.map((act, ai) => {
                                                                            const actType = getActivityType(act);
                                                                            const TYPE_COLORS: Record<string, string> = { travaux: "bg-blue-500", fourniture: "bg-amber-500", services: "bg-green-500", etudes: "bg-purple-500", pi: "bg-rose-500" };
                                                                            return (
                                                                                <li key={ai} className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                                                                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TYPE_COLORS[actType] || "bg-gray-400"}`} />
                                                                                    {getActivityName(act) || `Activité ${ai + 1}`}
                                                                                    <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] uppercase">
                                                                                        {ACTIVITY_TYPES.find(t => t.id === actType)?.label || "Activité"}
                                                                                    </span>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                )}

                {currentStep === 6 && (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                            <Check size={24} className="text-green-500" />
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Projet prêt à être créé</h3>
                        <p className="text-[11px] text-[var(--text-tertiary)] max-w-xs mx-auto">Vérifiez les informations puis cliquez sur &quot;Créer le projet&quot;.</p>
                        <div className="grid grid-cols-2 gap-3 mt-8 text-left max-w-lg mx-auto">
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Nom</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{titre || "—"}</div>
                            </div>
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Code</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{projectCode}</div>
                            </div>
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Localisation</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{ville || region || "—"}</div>
                            </div>
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Budget Total</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    {financementPreview.total > 0 ? formatCurrency(financementPreview.total, "FCFA") : "À définir"}
                                </div>
                            </div>
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Financement</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    {financement.type === "MOP" 
                                        ? `MOP — ${financement.bailleurs.length > 0 ? financement.bailleurs.map(b => b.nom).join(", ") : "—"}${financement.budgetNational.enabled ? " + Budget National" : ""}`
                                        : `PPP — ${financement.partiesPubliques.length} public, ${financement.partiesPrivees.length} privé`
                                    }
                                </div>
                            </div>
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Structure</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{components.length} Comp. <span className="text-[11px] text-[var(--text-tertiary)] font-normal">({totalSC} SC, {totalActivities} Act)</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Footer Actions ── */}
            <div className="flex justify-between items-center">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 1}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <ArrowLeft size={14} />
                    Précédent
                </button>

                <div className="flex items-center gap-3">
                    <Link href="/projects" className="px-5 py-2.5 rounded-[var(--radius-md)] text-[13px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                        Annuler
                    </Link>
                    <button
                        onClick={handleNext}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-[13px] font-semibold shadow-[var(--shadow-sm)] transition-all ${currentStep === 6 ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[var(--text-primary)] text-[var(--text-inverted)] hover:opacity-90"}`}
                    >
                        {currentStep === 6 ? "✓ Créer le projet" : "Suivant"}
                        {currentStep < 6 && <ArrowRight size={14} />}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmState !== null}
                title={confirmState?.title || ""}
                message={confirmState?.message || ""}
                confirmLabel="Supprimer"
                cancelLabel="Annuler"
                variant="danger"
                onConfirm={() => {
                    confirmState?.onConfirm();
                    setConfirmState(null);
                }}
                onCancel={() => setConfirmState(null)}
            />

        </div>
    );
}
