"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle2, ChevronUp, ChevronDown, Layers, DollarSign } from "lucide-react";
import Link from "next/link";
import { addProject, generateProjectCode, ACTIVITY_TYPES, getActivityName, getActivityType, isComponentLowestLevel, isSousComposantLowestLevel, type ComponentData, type SousComposantData, type ActivityDef } from "@/lib/projectStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CURRENCIES, calculatePercentages, calculateTotalBudget, formatCurrency, DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";
import { BailleurMultiCurrency, type CurrencyContribution } from "@/components/financing/BailleurMultiCurrency";
import { ExchangeRateModal } from "@/components/financing/ExchangeRateModal";

type ConfirmState = {
  type: "component" | "subcomponent" | "activity" | "bailleur" | "partie_publique" | "partie_privee";
  title: string;
  message: string;
  onConfirm: () => void;
} | null;

// ══════════════════════════════════════
// CAMEROON ADMINISTRATIVE DATA
// ══════════════════════════════════════

const CAMEROON_DATA: Record<string, Record<string, string[]>> = {
    "Région de l'Est": {
        "Lom-et-Djérem": ["Bertoua", "Bélabo", "Garoua-Boulaï", "Diang", "Ngoura"],
        "Kadey": ["Batouri", "Kette", "Ndelele", "Mbang", "Kentzou"],
        "Boumba-et-Ngoko": ["Yokadouma", "Moloundou", "Salapoumbé", "Gari-Gombo"],
        "Haut-Nyong": ["Abong-Mbang", "Doumé", "Lomié", "Messamena", "Mindourou"],
    },
    "Région du Sud": {
        "Mvila": ["Ebolowa", "Ambam", "Biwong-Bane", "Mengong"],
        "Dja-et-Lobo": ["Sangmélima", "Djoum", "Mintom", "Meyomessala", "Bengbis"],
        "Océan": ["Kribi", "Lolodorf", "Akom II", "Campo", "Bipindi"],
        "Vallée-du-Ntem": ["Ambam", "Ma'an", "Olamze", "Kyé-Ossi"],
    },
    "Région du Centre": {
        "Mfoundi": ["Yaoundé"],
        "Lékié": ["Monatélé", "Obala", "Okola", "Sa'a", "Evodoula"],
        "Mefou-et-Afamba": ["Mfou", "Nkolafamba", "Awae", "Edzendouan"],
        "Nyong-et-So'o": ["Mbalmayo", "Ngoumou", "Akoeman"],
        "Mbam-et-Inoubou": ["Bafia", "Kiiki", "Ndikinimeki", "Bokito"],
    },
    "Région du Littoral": {
        "Wouri": ["Douala"],
        "Sanaga-Maritime": ["Édéa", "Dizangué", "Mouanko", "Pouma", "Ndom"],
        "Nkam": ["Yabassi", "Nkondjock", "Yingui", "Nord-Makombé"],
        "Moungo": ["Nkongsamba", "Loum", "Manjo", "Mbanga", "Melong"],
    },
    "Région de l'Ouest": {
        "Mifi": ["Bafoussam"],
        "Menoua": ["Dschang", "Penka-Michel", "Nkong-Ni", "Fongo-Tongo"],
        "Bamboutos": ["Mbouda", "Galim", "Batcham"],
        "Haut-Nkam": ["Bafang", "Bandja", "Bana", "Kekem"],
        "Koung-Khi": ["Bandjoun", "Bayangam", "Poumougne"],
    },
    "Région de l'Adamaoua": {
        "Vina": ["Ngaoundéré", "Belel", "Martap", "Mbé"],
        "Mbere": ["Meiganga", "Dir", "Djohong", "Ngaoui"],
        "Djerem": ["Tibati", "Ngaoundal", "Banyo"],
        "Mayo-Banyo": ["Banyo", "Mayo-Darlé", "Bankim"],
    },
    "Région du Nord": {
        "Bénoué": ["Garoua", "Lagdo", "Pitoa", "Bibémi"],
        "Mayo-Louti": ["Guider", "Figuil", "Mayo-Oulo"],
        "Faro": ["Poli", "Béka"],
        "Mayo-Rey": ["Tcholliré", "Rey-Bouba", "Touboro", "Madingring"],
    },
    "Région de l'Extrême-Nord": {
        "Diamaré": ["Maroua", "Bogo", "Pétté", "Gazawa"],
        "Logone-et-Chari": ["Kousséri", "Goulfey", "Makary", "Blangoua"],
        "Mayo-Danay": ["Yagoua", "Maga", "Vélé", "Kar-Hay"],
        "Mayo-Tsanaga": ["Mokolo", "Koza", "Mora", "Bourha"],
        "Mayo-Sava": ["Mora", "Tokombéré", "Kolofata"],
    },
    "Région du Nord-Ouest": {
        "Mezam": ["Bamenda", "Bali", "Santa", "Tubah"],
        "Bui": ["Kumbo", "Noni", "Jakiri", "Mbiame"],
        "Ngo-Ketunjia": ["Ndop", "Babessi", "Balikumbat"],
        "Donga-Mantung": ["Nkambé", "Ako", "Misaje", "Ndu"],
    },
    "Région du Sud-Ouest": {
        "Fako": ["Buéa", "Limbé", "Tiko", "Muyuka", "Idenau"],
        "Mémé": ["Kumba", "Mbonge", "Konye"],
        "Ndian": ["Mundemba", "Bamusso", "Isanguele", "Ekondo-Titi"],
        "Koupé-Manengouba": ["Bangem", "Tombel", "Nguti"],
    },
};

const REGIONS = Object.keys(CAMEROON_DATA);

// ══════════════════════════════════════
// CITY GPS COORDINATES (approximate)
// ══════════════════════════════════════

const CITY_COORDS: Record<string, [number, number]> = {
    // Est
    "Bertoua": [4.5772, 13.6846], "Bélabo": [4.9333, 13.3000], "Garoua-Boulaï": [5.8917, 14.5500],
    "Diang": [5.1500, 13.2000], "Ngoura": [4.8833, 14.1667], "Batouri": [4.4333, 14.3500],
    "Kette": [4.1667, 14.2000], "Ndelele": [4.0500, 14.9167], "Mbang": [4.5833, 13.7333],
    "Kentzou": [4.1500, 14.5500], "Yokadouma": [3.5167, 15.0500], "Moloundou": [2.0500, 15.2167],
    "Salapoumbé": [2.8667, 14.9000], "Gari-Gombo": [3.4667, 15.0667], "Abong-Mbang": [3.9833, 13.1833],
    "Doumé": [4.2333, 13.4500], "Lomié": [3.1583, 13.6167], "Messamena": [3.6333, 12.8500],
    "Mindourou": [3.5833, 14.0833],
    // Sud
    "Ebolowa": [2.9000, 11.1500], "Ambam": [2.3833, 11.2833], "Biwong-Bane": [2.8667, 11.0333],
    "Mengong": [2.7167, 11.0333], "Sangmélima": [2.9333, 11.9833], "Djoum": [2.6667, 12.6667],
    "Mintom": [2.4167, 13.2667], "Meyomessala": [3.1000, 11.7500], "Bengbis": [3.1667, 12.1833],
    "Kribi": [2.9500, 9.9167], "Lolodorf": [3.2333, 10.7333], "Akom II": [2.7833, 10.5667],
    "Campo": [2.3667, 9.8333], "Bipindi": [3.0833, 10.4000],
    "Ma'an": [2.3833, 10.6167], "Olamze": [2.1000, 11.4000], "Kyé-Ossi": [2.1833, 11.3333],
    // Centre
    "Yaoundé": [3.8480, 11.5021], "Monatélé": [4.2500, 11.2000], "Obala": [4.1667, 11.5333],
    "Okola": [4.0167, 11.3833], "Sa'a": [4.3667, 11.4500], "Evodoula": [4.0833, 11.2000],
    "Mfou": [3.7167, 11.6333], "Nkolafamba": [3.7000, 11.6667], "Awae": [3.6500, 11.6833],
    "Edzendouan": [3.6500, 11.5500], "Mbalmayo": [3.5167, 11.5000], "Ngoumou": [3.6500, 11.3667],
    "Akoeman": [3.4667, 11.3667], "Bafia": [4.7500, 11.2333], "Kiiki": [4.7000, 11.0000],
    "Ndikinimeki": [4.7667, 10.8333], "Bokito": [4.5667, 11.1167],
    // Littoral
    "Douala": [4.0511, 9.7679], "Édéa": [3.8000, 10.1333], "Dizangué": [3.7667, 9.9833],
    "Mouanko": [3.6167, 9.7833], "Pouma": [3.9167, 10.5667], "Ndom": [4.0000, 10.5500],
    "Yabassi": [4.4500, 9.9667], "Nkondjock": [4.7500, 9.9500], "Yingui": [4.6333, 9.8833],
    "Nord-Makombé": [4.6833, 9.9333], "Nkongsamba": [4.9500, 9.9333], "Loum": [4.7167, 9.7333],
    "Manjo": [4.8333, 9.8167], "Mbanga": [4.5000, 9.5667], "Melong": [5.1167, 9.9667],
    // Ouest
    "Bafoussam": [5.4737, 10.4176], "Dschang": [5.4500, 10.0667], "Penka-Michel": [5.5333, 10.0500],
    "Nkong-Ni": [5.5667, 10.1167], "Fongo-Tongo": [5.5000, 10.0000], "Mbouda": [5.6333, 10.2500],
    "Galim": [5.6667, 10.4000], "Batcham": [5.6167, 10.2833], "Bafang": [5.1500, 10.1833],
    "Bandja": [5.1500, 10.3667], "Bana": [5.1500, 10.0667], "Kekem": [5.2000, 9.8667],
    "Bandjoun": [5.3833, 10.4167], "Bayangam": [5.3333, 10.3500], "Poumougne": [5.3500, 10.3000],
    // Adamaoua
    "Ngaoundéré": [7.3167, 13.5833], "Belel": [7.0667, 14.4667], "Martap": [7.3333, 13.7333],
    "Mbé": [7.8500, 13.6000], "Meiganga": [6.5167, 14.2833], "Dir": [6.4000, 14.0667],
    "Djohong": [6.8333, 14.7000], "Ngaoui": [6.4833, 15.3167], "Tibati": [6.4667, 12.6333],
    "Ngaoundal": [6.4833, 13.2667], "Banyo": [6.7500, 11.8167], "Mayo-Darlé": [6.5833, 11.5333],
    "Bankim": [6.0833, 11.4667],
    // Nord
    "Garoua": [9.3000, 13.4000], "Lagdo": [9.0500, 13.6667], "Pitoa": [9.3833, 13.5000],
    "Bibémi": [9.3167, 13.8667], "Guider": [9.9333, 13.9500], "Figuil": [9.7667, 13.9667],
    "Mayo-Oulo": [9.7667, 13.7333], "Poli": [8.4833, 13.2333], "Béka": [8.0167, 12.9167],
    "Tcholliré": [8.4000, 14.1667], "Rey-Bouba": [8.6667, 14.1833], "Touboro": [7.7833, 15.3500],
    "Madingring": [7.5833, 14.8167],
    // Extrême-Nord
    "Maroua": [10.5958, 14.3159], "Bogo": [10.7333, 14.6000], "Pétté": [10.4833, 14.4333],
    "Gazawa": [10.5167, 14.2167], "Kousséri": [12.0833, 15.0333], "Goulfey": [12.3833, 14.9167],
    "Makary": [12.5667, 14.4667], "Blangoua": [12.6333, 14.5500], "Yagoua": [10.3500, 15.2333],
    "Maga": [10.8333, 14.9500], "Vélé": [10.2500, 15.1500], "Kar-Hay": [10.5000, 14.9833],
    "Mokolo": [10.7333, 13.8000], "Koza": [10.8833, 13.8833], "Mora": [11.0500, 14.1500],
    "Bourha": [10.3833, 13.6833], "Tokombéré": [10.8667, 14.1833], "Kolofata": [11.1667, 14.0833],
    // Nord-Ouest
    "Bamenda": [5.9631, 10.1591], "Bali": [5.8833, 10.0167], "Santa": [5.7833, 10.1500],
    "Tubah": [5.9500, 10.2000], "Kumbo": [6.2000, 10.6833], "Noni": [6.1667, 10.8000],
    "Jakiri": [6.1000, 10.6500], "Mbiame": [6.2667, 10.8500], "Ndop": [5.9667, 10.4167],
    "Babessi": [6.0333, 10.4833], "Balikumbat": [5.9500, 10.3667], "Nkambé": [6.6167, 10.6667],
    "Ako": [6.8000, 10.9167], "Misaje": [6.4833, 10.9667], "Ndu": [6.3833, 10.7500],
    // Sud-Ouest
    "Buéa": [4.1560, 9.2632], "Limbé": [4.0204, 9.2072], "Tiko": [4.0750, 9.3500],
    "Muyuka": [4.2833, 9.4167], "Idenau": [4.2167, 8.9833], "Kumba": [4.6333, 9.4333],
    "Mbonge": [4.5333, 9.1667], "Konye": [4.9500, 9.4833], "Mundemba": [4.9500, 8.8833],
    "Bamusso": [4.4167, 8.9000], "Isanguele": [4.7667, 8.5667], "Ekondo-Titi": [4.9667, 9.1833],
    "Bangem": [5.1500, 9.6833], "Tombel": [4.7500, 9.6667], "Nguti": [5.3333, 9.4167],
};

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

    // Step 3 state (financement)
    const [structureJuridique, setStructureJuridique] = useState<"MOP" | "PPP">("MOP");
    
    // MOP - Nouveau format avec devises multiples
    const [budgetNational, setBudgetNational] = useState(false);
    const [budgetNationalMontant, setBudgetNationalMontant] = useState("");
    const [budgetNationalDevise, setBudgetNationalDevise] = useState("FCFA");
    const [budgetNationalPct, setBudgetNationalPct] = useState("0");
    
    // Nouveau format : chaque bailleur peut avoir plusieurs devises
    const [bailleurs, setBailleurs] = useState<Array<{ 
      id: string; 
      nom: string; 
      contributions: CurrencyContribution[]; 
      pourcentage?: number 
    }>>([]);
    
    // PPP
    const [partiesPubliques, setPartiesPubliques] = useState<Array<{ id: string; nom: string; montant: string; devise: string; pourcentage?: number }>>([]);
    const [partiesPrivees, setPartiesPrivees] = useState<Array<{ id: string; nom: string; montant: string; devise: string; pourcentage?: number }>>([]);

    // Affichage du budget total
    const [budgetDisplayMode, setBudgetDisplayMode] = useState<"detailed" | "converted">("detailed");
    const [conversionCurrency, setConversionCurrency] = useState("FCFA");
    const [exchangeRates, setExchangeRates] = useState(DEFAULT_EXCHANGE_RATES);
    const [showExchangeRateModal, setShowExchangeRateModal] = useState(false);

    const [confirmState, setConfirmState] = useState<ConfirmState>(null);

    // Step 4 state (structure)
    const [components, setComponents] = useState<ComponentData[]>([
        { id: "c1", name: "Barrage", sousComposants: [{ id: "sc1", name: "Fondations", activities: [{ name: "Fouilles", typeActivite: "travaux" }, { name: "Béton de propreté", typeActivite: "travaux" }] }] },
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
        setComponents(prev => [...prev, { id: `c${Date.now()}`, name: "", sousComposants: [], typeActivite: "travaux" }]);
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

    // Searchable bailleur dropdown
    const [bailleurDropdownOpen, setBailleurDropdownOpen] = useState(false);
    const [bailleurSearch, setBailleurSearch] = useState("");
    const [customBailleurInput, setCustomBailleurInput] = useState("");
    const [showCustomBailleurInput, setShowCustomBailleurInput] = useState(false);

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

    const availableBailleurs = BAILLEURS_LIST.filter(
        (b) => !bailleurs.some((existing) => existing.nom === b) && b.toLowerCase().includes(bailleurSearch.toLowerCase())
    );

    const handleSelectBailleur = (nom: string) => {
        const id = `b${Date.now()}`;
        const initialContribution: CurrencyContribution = {
          id: `curr-${Date.now()}`,
          devise: "FCFA",
          montant: "0",
        };
        setBailleurs((prev) => [...prev, { id, nom, contributions: [initialContribution], pourcentage: 0 }]);
        setBailleurSearch("");
        setBailleurDropdownOpen(false);
    };

    const handleAddCustomBailleur = () => {
        if (!customBailleurInput.trim()) return;
        const id = `b${Date.now()}`;
        const initialContribution: CurrencyContribution = {
          id: `curr-${Date.now()}`,
          devise: "FCFA",
          montant: "0",
        };
        setBailleurs((prev) => [...prev, { id, nom: customBailleurInput.trim(), contributions: [initialContribution], pourcentage: 0 }]);
        setCustomBailleurInput("");
        setShowCustomBailleurInput(false);
    };

    // Helpers pour MOP - Nouveau format multi-devises
    const updateBailleurContributions = (bailleurId: string, contributions: CurrencyContribution[]) => {
        setBailleurs(prev => prev.map(b => b.id === bailleurId ? { ...b, contributions } : b));
    };

    const removeBailleur = (id: string) => {
        setConfirmState({
            type: "bailleur",
            title: "Supprimer le bailleur",
            message: "Êtes-vous sûr de vouloir supprimer ce bailleur ? Cette action est irréversible.",
            onConfirm: () => {
                setBailleurs(prev => prev.filter(b => b.id !== id));
            }
        });
    };

    // Obtenir toutes les devises utilisées dans le projet
    const getUsedCurrencies = (): string[] => {
        const currencies = new Set<string>();
        
        if (budgetNational && budgetNationalDevise) {
            currencies.add(budgetNationalDevise);
        }
        
        bailleurs.forEach(b => {
            b.contributions.forEach(c => currencies.add(c.devise));
        });
        
        partiesPubliques.forEach(p => currencies.add(p.devise));
        partiesPrivees.forEach(p => currencies.add(p.devise));
        
        return Array.from(currencies);
    };

    // Calculer automatiquement les pourcentages des bailleurs (MOP) - Nouveau format
    const calculateBailleurPercentages = () => {
        const contributions: Array<{ montant: number; devise: string }> = [];
        
        // Ajouter toutes les contributions de tous les bailleurs
        bailleurs.forEach(b => {
            b.contributions.forEach(c => {
                contributions.push({
                    montant: parseFloat(c.montant) || 0,
                    devise: c.devise
                });
            });
        });
        
        if (budgetNational) {
            contributions.push({
                montant: parseFloat(budgetNationalMontant) || 0,
                devise: budgetNationalDevise
            });
        }
        
        const percentages = calculatePercentages(contributions);
        
        // Répartir les pourcentages par bailleur
        let percentageIndex = 0;
        const updatedBailleurs = bailleurs.map(b => {
            let bailleurTotal = 0;
            for (let i = 0; i < b.contributions.length; i++) {
                bailleurTotal += percentages[percentageIndex] || 0;
                percentageIndex++;
            }
            return { ...b, pourcentage: bailleurTotal };
        });
        
        setBailleurs(updatedBailleurs);
        
        if (budgetNational && percentages.length > percentageIndex) {
            setBudgetNationalPct(percentages[percentageIndex].toString());
        }
    };

    // Calculer automatiquement les pourcentages PPP
    const calculatePPPPercentages = () => {
        const contributions = [
            ...partiesPubliques.map(p => ({
                montant: parseFloat(p.montant) || 0,
                devise: p.devise
            })),
            ...partiesPrivees.map(p => ({
                montant: parseFloat(p.montant) || 0,
                devise: p.devise
            }))
        ];
        
        const percentages = calculatePercentages(contributions);
        
        setPartiesPubliques(prev => prev.map((p, idx) => ({
            ...p,
            pourcentage: percentages[idx]
        })));
        
        setPartiesPrivees(prev => prev.map((p, idx) => ({
            ...p,
            pourcentage: percentages[partiesPubliques.length + idx]
        })));
    };

    // Recalculer les pourcentages quand les montants changent (MOP)
    useEffect(() => {
        if (structureJuridique === "MOP" && (bailleurs.length > 0 || budgetNational)) {
            calculateBailleurPercentages();
        }
    }, [
        // Dépendre des contributions de chaque bailleur (nouveau format multi-devises)
        bailleurs.map(b => b.contributions.map(c => `${c.montant}-${c.devise}`).join('|')).join(','), 
        budgetNational, 
        budgetNationalMontant, 
        budgetNationalDevise, 
        structureJuridique
    ]);

    // Recalculer les pourcentages quand les montants changent (PPP)
    useEffect(() => {
        if (structureJuridique === "PPP" && (partiesPubliques.length > 0 || partiesPrivees.length > 0)) {
            calculatePPPPercentages();
        }
    }, [
        partiesPubliques.map(p => `${p.montant}-${p.devise}`).join(','), 
        partiesPrivees.map(p => `${p.montant}-${p.devise}`).join(','),
        structureJuridique
    ]);

    // Helpers pour PPP
    const addPartiePublique = () => {
        const id = `pub${Date.now()}`;
        setPartiesPubliques(prev => [...prev, { id, nom: "", montant: "0", devise: "FCFA", pourcentage: 0 }]);
    };

    const updatePartiePubliqueMontant = (id: string, montant: string) => {
        setPartiesPubliques(prev => prev.map(p => p.id === id ? { ...p, montant } : p));
    };
    
    const updatePartiePubliqueDevise = (id: string, devise: string) => {
        setPartiesPubliques(prev => prev.map(p => p.id === id ? { ...p, devise } : p));
    };

    const updatePartiePubliqueNom = (id: string, nom: string) => {
        setPartiesPubliques(prev => prev.map(p => p.id === id ? { ...p, nom } : p));
    };

    const removePartiePublique = (id: string) => {
        setConfirmState({
            type: "partie_publique",
            title: "Supprimer la partie publique",
            message: "Êtes-vous sûr de vouloir supprimer cette partie publique ? Cette action est irréversible.",
            onConfirm: () => {
                setPartiesPubliques(prev => prev.filter(p => p.id !== id));
            }
        });
    };

    const addPartiePrivee = () => {
        const id = `priv${Date.now()}`;
        setPartiesPrivees(prev => [...prev, { id, nom: "", montant: "0", devise: "FCFA", pourcentage: 0 }]);
    };

    const updatePartiePriveeMontant = (id: string, montant: string) => {
        setPartiesPrivees(prev => prev.map(p => p.id === id ? { ...p, montant } : p));
    };
    
    const updatePartiePriveeDevise = (id: string, devise: string) => {
        setPartiesPrivees(prev => prev.map(p => p.id === id ? { ...p, devise } : p));
    };

    const updatePartiePriveeNom = (id: string, nom: string) => {
        setPartiesPrivees(prev => prev.map(p => p.id === id ? { ...p, nom } : p));
    };

    const removePartiePrivee = (id: string) => {
        setConfirmState({
            type: "partie_privee",
            title: "Supprimer la partie privée",
            message: "Êtes-vous sûr de vouloir supprimer cette partie privée ? Cette action est irréversible.",
            onConfirm: () => {
                setPartiesPrivees(prev => prev.filter(p => p.id !== id));
            }
        });
    };

    // Calcul des totaux
    const getTotalMOP = () => {
        const bn = budgetNational ? (parseFloat(budgetNationalPct) || 0) : 0;
        const bailleursTotal = bailleurs.reduce((sum, b) => sum + (b.pourcentage || 0), 0);
        return bn + bailleursTotal;
    };

    const getTotalPPP = () => {
        const pubTotal = partiesPubliques.reduce((sum, p) => sum + (p.pourcentage || 0), 0);
        const privTotal = partiesPrivees.reduce((sum, p) => sum + (p.pourcentage || 0), 0);
        return { public: pubTotal, prive: privTotal, total: pubTotal + privTotal };
    };

    const totalActivities = components.reduce((sum, c) => sum + c.sousComposants.reduce((s, sc) => s + sc.activities.length, 0), 0);
    const totalSC = components.reduce((sum, c) => sum + c.sousComposants.length, 0);

    const handleCreate = async () => {
        try {
            // Calculer le budget total en FCFA (devise de référence)
            let totalBudgetFCFA = 0;
            let budgetDevise = "FCFA";

            if (structureJuridique === "MOP") {
                // Contributions MOP - Nouveau format multi-devises
                const contributions: Array<{ montant: number; devise: string }> = [];
                if (budgetNational && parseFloat(budgetNationalMontant) > 0) {
                    contributions.push({ montant: parseFloat(budgetNationalMontant), devise: budgetNationalDevise });
                }
                bailleurs.forEach(b => {
                    b.contributions.forEach(c => {
                        const montant = parseFloat(c.montant) || 0;
                        if (montant > 0) {
                            contributions.push({ montant, devise: c.devise });
                        }
                    });
                });
                totalBudgetFCFA = calculateTotalBudget(contributions, "FCFA", exchangeRates);
            } else {
                // Contributions PPP
                const contributions: Array<{ montant: number; devise: string }> = [];
                partiesPubliques.forEach(p => {
                    if (parseFloat(p.montant) > 0) {
                        contributions.push({ montant: parseFloat(p.montant), devise: p.devise });
                    }
                });
                partiesPrivees.forEach(p => {
                    if (parseFloat(p.montant) > 0) {
                        contributions.push({ montant: parseFloat(p.montant), devise: p.devise });
                    }
                });
                totalBudgetFCFA = calculateTotalBudget(contributions, "FCFA", exchangeRates);
            }

            // Préparer les bailleurs au bon format - Nouveau format multi-devises
            const bailleursFormatted = bailleurs.map(b => {
                // Calculer le montant total du bailleur en additionnant toutes ses contributions
                const montantTotal = b.contributions.reduce((sum, c) => sum + (parseFloat(c.montant) || 0), 0);
                // Utiliser la première devise ou FCFA par défaut
                const deviseprincipale = b.contributions[0]?.devise || "FCFA";
                
                return {
                    nom: b.nom,
                    montant: montantTotal,
                    devise: deviseprincipale,
                    pourcentage: b.pourcentage || 0,
                };
            });

            // Préparer les parties publiques
            const partiesPubliquesFormatted = partiesPubliques.map(p => ({
                nom: p.nom,
                montant: parseFloat(p.montant) || 0,
                devise: p.devise,
                pourcentage: p.pourcentage || 0
            }));

            // Préparer les parties privées
            const partiesPriveesFormatted = partiesPrivees.map(p => ({
                nom: p.nom,
                montant: parseFloat(p.montant) || 0,
                devise: p.devise,
                pourcentage: p.pourcentage || 0
            }));

            // Construire l'objet projet au format attendu par le backend
            const projectData = {
                name: titre || "Nouveau Projet",
                description: description || "Projet d'infrastructure",
                budget: totalBudgetFCFA > 0 ? totalBudgetFCFA : undefined,
                devise: budgetDevise,
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
                financement: {
                    type: structureJuridique as 'MOP' | 'PPP',
                    budgetNational: budgetNational,
                    budgetNationalMontant: budgetNational ? parseFloat(budgetNationalMontant) : undefined,
                    budgetNationalDevise: budgetNational ? budgetNationalDevise : undefined,
                    budgetNationalPct: budgetNational ? parseFloat(budgetNationalPct) : undefined,
                    bailleurs: bailleursFormatted.length > 0 ? bailleursFormatted : undefined,
                    partiesPubliques: partiesPubliquesFormatted.length > 0 ? partiesPubliquesFormatted : undefined,
                    partiesPrivees: partiesPriveesFormatted.length > 0 ? partiesPriveesFormatted : undefined,
                    tauxChange: exchangeRates
                },
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
                        {/* Info */}
                        <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
                                Définissez le cadre juridique et les sources de financement du projet. Le budget total sera calculé automatiquement à partir des contributions.
                            </p>
                        </div>

                        {/* Structuration Juridique */}
                        <div>
                            <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3 uppercase tracking-wider">Structuration Juridique <span className="text-red-500">*</span></h3>
                            <div className="flex gap-4">
                                <label className="flex-1 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="structure" 
                                        value="MOP" 
                                        checked={structureJuridique === "MOP"} 
                                        onChange={() => setStructureJuridique("MOP")} 
                                        className="peer sr-only" 
                                    />
                                    <div className="p-4 border-2 rounded-[var(--radius-md)] transition-all peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-subtle)] border-[var(--border-default)] hover:border-[var(--accent)]/50">
                                        <div className="text-[14px] font-bold text-[var(--text-primary)] mb-1">MOP</div>
                                        <div className="text-[11px] text-[var(--text-tertiary)]">Maîtrise d&apos;Ouvrage Publique</div>
                                    </div>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="structure" 
                                        value="PPP" 
                                        checked={structureJuridique === "PPP"} 
                                        onChange={() => setStructureJuridique("PPP")} 
                                        className="peer sr-only" 
                                    />
                                    <div className="p-4 border-2 rounded-[var(--radius-md)] transition-all peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-subtle)] border-[var(--border-default)] hover:border-[var(--accent)]/50">
                                        <div className="text-[14px] font-bold text-[var(--text-primary)] mb-1">PPP</div>
                                        <div className="text-[11px] text-[var(--text-tertiary)]">Partenariat Public-Privé</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* ═══ Financement selon le mode ═══ */}
                        <div>
                            <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3 uppercase tracking-wider">Financement</h3>
                            
                            {structureJuridique === "MOP" ? (
                                <div className="space-y-5">
                                    {/* ── Budget National ── */}
                                    <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={budgetNational} 
                                                onChange={e => setBudgetNational(e.target.checked)} 
                                                className="w-4 h-4 rounded-[var(--radius-sm)] border-[var(--border-default)] bg-[var(--bg-inset)] accent-[var(--accent)]" 
                                            />
                                            <div>
                                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">Budget National</div>
                                                <div className="text-[11px] text-[var(--text-tertiary)]">Financement par l&apos;État du Cameroun</div>
                                            </div>
                                        </label>
                                        {budgetNational && (
                                            <div className="ml-7 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    {/* Montant */}
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={budgetNationalMontant}
                                                        onChange={(e) => setBudgetNationalMontant(e.target.value)}
                                                        placeholder="Montant"
                                                        className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                    />
                                                    {/* Devise */}
                                                    <select
                                                        value={budgetNationalDevise}
                                                        onChange={(e) => setBudgetNationalDevise(e.target.value)}
                                                        className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer w-24"
                                                    >
                                                        {CURRENCIES.map(c => (
                                                            <option key={c.code} value={c.code}>{c.code}</option>
                                                        ))}
                                                    </select>
                                                    {/* Pourcentage (calculé automatiquement) */}
                                                    <div className="relative w-20 flex-shrink-0">
                                                        <input
                                                            type="text"
                                                            value={parseFloat(budgetNationalPct).toFixed(2) || "0"}
                                                            readOnly
                                                            className="w-full bg-[var(--bg-inset)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-secondary)] text-right pr-7 cursor-not-allowed"
                                                            title="Calculé automatiquement"
                                                        />
                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-tertiary)] font-semibold">%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Bailleurs de fonds (Searchable dropdown) ── */}
                                    <div className="space-y-3">
                                        <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Bailleurs de fonds</label>
                                        
                                        {/* Dropdown sélecteur */}
                                        <div className="relative">
                                            <div 
                                                className="flex items-center bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden cursor-pointer hover:border-[var(--accent)]/50 transition-colors"
                                            >
                                                <input
                                                    type="text"
                                                    value={bailleurSearch}
                                                    onChange={(e) => { setBailleurSearch(e.target.value); setBailleurDropdownOpen(true); }}
                                                    onFocus={() => setBailleurDropdownOpen(true)}
                                                    placeholder="Rechercher et sélectionner un bailleur..."
                                                    className="flex-1 bg-transparent px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                                                />
                                                <svg className="mr-3 text-[var(--text-tertiary)] pointer-events-none flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                            </div>

                                            {bailleurDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => { setBailleurDropdownOpen(false); setBailleurSearch(""); }} />
                                                    <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] max-h-52 overflow-y-auto">
                                                        {availableBailleurs.length > 0 ? (
                                                            availableBailleurs.map((b) => (
                                                                <button
                                                                    key={b}
                                                                    type="button"
                                                                    onClick={() => handleSelectBailleur(b)}
                                                                    className="w-full text-left px-4 py-2.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                                                                >
                                                                    {b}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-4 py-3 text-[12px] text-[var(--text-tertiary)] italic">Aucun bailleur trouvé</div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Bouton ajouter un bailleur personnalisé */}
                                        {!showCustomBailleurInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowCustomBailleurInput(true)}
                                                className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)] hover:underline"
                                            >
                                                <Plus size={12} /> Ajouter un bailleur personnalisé
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={customBailleurInput}
                                                    onChange={(e) => setCustomBailleurInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomBailleur())}
                                                    placeholder="Nom du bailleur..."
                                                    autoFocus
                                                    className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                                                />
                                                <button type="button" onClick={handleAddCustomBailleur} className="px-3 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-[12px] font-semibold hover:opacity-90 transition-opacity">Ajouter</button>
                                                <button type="button" onClick={() => { setShowCustomBailleurInput(false); setCustomBailleurInput(""); }} className="px-3 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-[12px] font-semibold transition-colors">Annuler</button>
                                            </div>
                                        )}

                                        {/* Liste des bailleurs sélectionnés avec devises multiples */}
                                        {bailleurs.length > 0 && (
                                            <div className="space-y-2 mt-2">
                                                {bailleurs.map((b) => (
                                                    <BailleurMultiCurrency
                                                        key={b.id}
                                                        bailleurId={b.id}
                                                        bailleurNom={b.nom}
                                                        contributions={b.contributions}
                                                        pourcentageTotal={b.pourcentage}
                                                        onUpdate={updateBailleurContributions}
                                                        onRemove={removeBailleur}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bouton pour gérer les taux de change */}
                                    {bailleurs.length > 0 && getUsedCurrencies().length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowExchangeRateModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-[var(--radius-md)] text-[12px] font-semibold hover:bg-blue-500/20 transition-colors"
                                        >
                                            <DollarSign size={14} />
                                            Configurer les taux de change
                                        </button>
                                    )}

                                    {/* ── Total MOP ── */}
                                    {(budgetNational || bailleurs.length > 0) && (() => {
                                        const total = getTotalMOP();
                                        const isValid = total === 100;
                                        const isOver = total > 100;
                                        return (
                                            <>
                                                <div className={`flex items-center justify-between p-3 rounded-[var(--radius-md)] border ${
                                                    isValid ? "bg-green-500/5 border-green-500/20" : isOver ? "bg-red-500/5 border-red-500/20" : "bg-[var(--bg-inset)] border-[var(--border-default)]"
                                                }`}>
                                                    <span className="text-[12px] font-semibold text-[var(--text-secondary)]">Total financement</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[14px] font-bold ${isValid ? "text-green-600" : isOver ? "text-red-600" : "text-[var(--text-primary)]"}`}>
                                                            {total.toFixed(2)}%
                                                        </span>
                                                        {isValid && <CheckCircle2 size={14} className="text-green-500" />}
                                                        {isOver && <span className="text-[10px] text-red-500 font-medium">Dépasse 100%</span>}
                                                        {!isValid && !isOver && total > 0 && <span className="text-[10px] text-amber-500 font-medium">Doit atteindre 100%</span>}
                                                    </div>
                                                </div>

                                                {/* ── Budget Total ── */}
                                                {isValid && (
                                                    <div className="p-4 rounded-[var(--radius-lg)] border-2 border-[var(--accent)]/30 bg-[var(--accent)]/5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">💰 Budget Total du Projet</h4>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setBudgetDisplayMode("detailed")}
                                                                    className={`px-3 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] transition-all ${
                                                                        budgetDisplayMode === "detailed"
                                                                            ? "bg-[var(--accent)] text-white"
                                                                            : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                                                                    }`}
                                                                >
                                                                    Détaillé
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setBudgetDisplayMode("converted")}
                                                                    className={`px-3 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] transition-all ${
                                                                        budgetDisplayMode === "converted"
                                                                            ? "bg-[var(--accent)] text-white"
                                                                            : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                                                                    }`}
                                                                >
                                                                    Converti
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {budgetDisplayMode === "detailed" ? (
                                                            /* Vue détaillée */
                                                            <div className="space-y-2">
                                                                {budgetNational && parseFloat(budgetNationalMontant) > 0 && (
                                                                    <div className="flex items-center justify-between p-2 bg-[var(--bg-surface)] rounded-[var(--radius-sm)]">
                                                                        <span className="text-[12px] text-[var(--text-secondary)]">Budget National</span>
                                                                        <span className="text-[13px] font-bold text-[var(--text-primary)]">
                                                                            {formatCurrency(parseFloat(budgetNationalMontant), budgetNationalDevise)}
                                                                            <span className="text-[11px] text-[var(--text-tertiary)] ml-2">({parseFloat(budgetNationalPct).toFixed(2)}%)</span>
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {bailleurs.map((b) => {
                                                                    // Calculer le montant total du bailleur
                                                                    const montantTotal = b.contributions.reduce((sum, c) => sum + (parseFloat(c.montant) || 0), 0);
                                                                    if (montantTotal <= 0) return null;
                                                                    
                                                                    return (
                                                                        <div key={b.id} className="flex items-center justify-between p-2 bg-[var(--bg-surface)] rounded-[var(--radius-sm)]">
                                                                            <span className="text-[12px] text-[var(--text-secondary)]">{b.nom}</span>
                                                                            <span className="text-[13px] font-bold text-[var(--text-primary)]">
                                                                                {b.contributions.map(c => formatCurrency(parseFloat(c.montant) || 0, c.devise)).join(" + ")}
                                                                                <span className="text-[11px] text-[var(--text-tertiary)] ml-2">({(b.pourcentage || 0).toFixed(2)}%)</span>
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div className="pt-2 mt-2 border-t-2 border-[var(--border-default)]">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[13px] font-bold text-[var(--text-primary)]">TOTAL</span>
                                                                        <span className="text-[11px] text-[var(--text-tertiary)] italic">Multi-devises</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Vue convertie */
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Convertir en :</label>
                                                                    <select
                                                                        value={conversionCurrency}
                                                                        onChange={(e) => setConversionCurrency(e.target.value)}
                                                                        className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                                                                    >
                                                                        {CURRENCIES.map(c => (
                                                                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="p-3 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 rounded-[var(--radius-md)] border border-[var(--accent)]/20">
                                                                    <div className="text-[11px] text-[var(--text-secondary)] mb-1">Budget Total Converti</div>
                                                                    <div className="text-[20px] font-bold text-[var(--accent)]">
                                                                        {(() => {
                                                                            const contributions = [];
                                                                            if (budgetNational && parseFloat(budgetNationalMontant) > 0) {
                                                                                contributions.push({ montant: parseFloat(budgetNationalMontant), devise: budgetNationalDevise });
                                                                            }
                                                                            bailleurs.forEach(b => {
                                                                                b.contributions.forEach(c => {
                                                                                    const montant = parseFloat(c.montant) || 0;
                                                                                    if (montant > 0) {
                                                                                        contributions.push({ montant, devise: c.devise });
                                                                                    }
                                                                                });
                                                                            });
                                                                            const totalConverted = calculateTotalBudget(contributions, conversionCurrency, exchangeRates);
                                                                            return formatCurrency(totalConverted, conversionCurrency);
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] text-[var(--text-tertiary)] italic">
                                                                    * Taux de change utilisés : {Object.entries(exchangeRates).map(([curr, rate]) => `1 ${curr} = ${rate} FCFA`).join(", ")}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                /* ═══ PPP — Deux colonnes : Public / Privé ═══ */
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* ── Colonne gauche : Parties Publiques ── */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[12px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" /> Parties Publiques
                                                </h4>
                                                <button type="button" onClick={addPartiePublique} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline">
                                                    <Plus size={12} /> Ajouter
                                                </button>
                                            </div>

                                            {partiesPubliques.length === 0 ? (
                                                <div className="p-6 border-2 border-dashed border-[var(--border-default)] rounded-[var(--radius-md)] text-center">
                                                    <div className="text-[var(--text-tertiary)] mb-2"><Plus size={20} className="mx-auto opacity-40" /></div>
                                                    <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Aucune partie publique</p>
                                                    <button type="button" onClick={addPartiePublique} className="text-[11px] font-semibold text-[var(--accent)] hover:underline">Ajouter une entité publique</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {partiesPubliques.map((p) => (
                                                        <div key={p.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] space-y-2 group">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={p.nom}
                                                                    onChange={(e) => updatePartiePubliqueNom(p.id, e.target.value)}
                                                                    placeholder="Nom de l'entité publique..."
                                                                    className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                                />
                                                                <button type="button" onClick={() => removePartiePublique(p.id)} className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {/* Montant */}
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={p.montant}
                                                                    onChange={(e) => updatePartiePubliqueMontant(p.id, e.target.value)}
                                                                    placeholder="Montant"
                                                                    className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                                />
                                                                {/* Devise */}
                                                                <select
                                                                    value={p.devise}
                                                                    onChange={(e) => updatePartiePubliqueDevise(p.id, e.target.value)}
                                                                    className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer w-24"
                                                                >
                                                                    {CURRENCIES.map(c => (
                                                                        <option key={c.code} value={c.code}>{c.code}</option>
                                                                    ))}
                                                                </select>
                                                                {/* Pourcentage (calculé automatiquement) */}
                                                                <div className="relative w-20 flex-shrink-0">
                                                                    <input
                                                                        type="text"
                                                                        value={p.pourcentage?.toFixed(2) || "0"}
                                                                        readOnly
                                                                        className="w-full bg-[var(--bg-inset)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-secondary)] text-right pr-7 cursor-not-allowed"
                                                                        title="Calculé automatiquement"
                                                                    />
                                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-tertiary)] font-semibold">%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Sous-total public */}
                                            {partiesPubliques.length > 0 && (
                                                <div className="flex justify-between items-center px-3 py-2 bg-blue-500/5 rounded-[var(--radius-sm)] border border-blue-500/10">
                                                    <span className="text-[11px] font-semibold text-blue-600">Sous-total Public</span>
                                                    <span className="text-[13px] font-bold text-blue-600">{getTotalPPP().public}%</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Colonne droite : Parties Privées ── */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[12px] font-bold text-purple-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-purple-500" /> Parties Privées
                                                </h4>
                                                <button type="button" onClick={addPartiePrivee} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline">
                                                    <Plus size={12} /> Ajouter
                                                </button>
                                            </div>

                                            {partiesPrivees.length === 0 ? (
                                                <div className="p-6 border-2 border-dashed border-[var(--border-default)] rounded-[var(--radius-md)] text-center">
                                                    <div className="text-[var(--text-tertiary)] mb-2"><Plus size={20} className="mx-auto opacity-40" /></div>
                                                    <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Aucune partie privée</p>
                                                    <button type="button" onClick={addPartiePrivee} className="text-[11px] font-semibold text-[var(--accent)] hover:underline">Ajouter une entité privée</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {partiesPrivees.map((p) => (
                                                        <div key={p.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] space-y-2 group">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={p.nom}
                                                                    onChange={(e) => updatePartiePriveeNom(p.id, e.target.value)}
                                                                    placeholder="Nom de l'entité privée..."
                                                                    className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                                />
                                                                <button type="button" onClick={() => removePartiePrivee(p.id)} className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {/* Montant */}
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={p.montant}
                                                                    onChange={(e) => updatePartiePriveeMontant(p.id, e.target.value)}
                                                                    placeholder="Montant"
                                                                    className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                                />
                                                                {/* Devise */}
                                                                <select
                                                                    value={p.devise}
                                                                    onChange={(e) => updatePartiePriveeDevise(p.id, e.target.value)}
                                                                    className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer w-24"
                                                                >
                                                                    {CURRENCIES.map(c => (
                                                                        <option key={c.code} value={c.code}>{c.code}</option>
                                                                    ))}
                                                                </select>
                                                                {/* Pourcentage (calculé automatiquement) */}
                                                                <div className="relative w-20 flex-shrink-0">
                                                                    <input
                                                                        type="text"
                                                                        value={p.pourcentage?.toFixed(2) || "0"}
                                                                        readOnly
                                                                        className="w-full bg-[var(--bg-inset)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-secondary)] text-right pr-7 cursor-not-allowed"
                                                                        title="Calculé automatiquement"
                                                                    />
                                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-tertiary)] font-semibold">%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Sous-total privé */}
                                            {partiesPrivees.length > 0 && (
                                                <div className="flex justify-between items-center px-3 py-2 bg-purple-500/5 rounded-[var(--radius-sm)] border border-purple-500/10">
                                                    <span className="text-[11px] font-semibold text-purple-600">Sous-total Privé</span>
                                                    <span className="text-[13px] font-bold text-purple-600">{getTotalPPP().prive}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Total Général PPP ── */}
                                    {(partiesPubliques.length > 0 || partiesPrivees.length > 0) && (() => {
                                        const { total } = getTotalPPP();
                                        const isValid = total === 100;
                                        const isOver = total > 100;
                                        return (
                                            <>
                                                <div className={`flex items-center justify-between p-3 rounded-[var(--radius-md)] border ${
                                                    isValid ? "bg-green-500/5 border-green-500/20" : isOver ? "bg-red-500/5 border-red-500/20" : "bg-[var(--bg-inset)] border-[var(--border-default)]"
                                                }`}>
                                                    <span className="text-[12px] font-semibold text-[var(--text-secondary)]">Total Répartition (Public + Privé)</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[14px] font-bold ${isValid ? "text-green-600" : isOver ? "text-red-600" : "text-[var(--text-primary)]"}`}>
                                                            {total}%
                                                        </span>
                                                        {isValid && <CheckCircle2 size={14} className="text-green-500" />}
                                                        {isOver && <span className="text-[10px] text-red-500 font-medium">Dépasse 100%</span>}
                                                        {!isValid && !isOver && total > 0 && <span className="text-[10px] text-amber-500 font-medium">Doit atteindre 100%</span>}
                                                    </div>
                                                </div>

                                                {/* ── Budget Total PPP ── */}
                                                {isValid && (
                                                    <div className="p-4 rounded-[var(--radius-lg)] border-2 border-[var(--accent)]/30 bg-[var(--accent)]/5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">💰 Budget Total du Projet</h4>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setBudgetDisplayMode("detailed")}
                                                                    className={`px-3 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] transition-all ${
                                                                        budgetDisplayMode === "detailed"
                                                                            ? "bg-[var(--accent)] text-white"
                                                                            : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                                                                    }`}
                                                                >
                                                                    Détaillé
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setBudgetDisplayMode("converted")}
                                                                    className={`px-3 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] transition-all ${
                                                                        budgetDisplayMode === "converted"
                                                                            ? "bg-[var(--accent)] text-white"
                                                                            : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                                                                    }`}
                                                                >
                                                                    Converti
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {budgetDisplayMode === "detailed" ? (
                                                            /* Vue détaillée */
                                                            <div className="space-y-2">
                                                                {/* Parties publiques */}
                                                                {partiesPubliques.map((p) => (
                                                                    parseFloat(p.montant) > 0 && (
                                                                        <div key={p.id} className="flex items-center justify-between p-2 bg-[var(--bg-surface)] rounded-[var(--radius-sm)]">
                                                                            <span className="text-[12px] text-[var(--text-secondary)]">
                                                                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                                                                {p.nom}
                                                                            </span>
                                                                            <span className="text-[13px] font-bold text-[var(--text-primary)]">
                                                                                {formatCurrency(parseFloat(p.montant), p.devise)}
                                                                                <span className="text-[11px] text-[var(--text-tertiary)] ml-2">({(p.pourcentage || 0).toFixed(2)}%)</span>
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                ))}
                                                                {/* Parties privées */}
                                                                {partiesPrivees.map((p) => (
                                                                    parseFloat(p.montant) > 0 && (
                                                                        <div key={p.id} className="flex items-center justify-between p-2 bg-[var(--bg-surface)] rounded-[var(--radius-sm)]">
                                                                            <span className="text-[12px] text-[var(--text-secondary)]">
                                                                                <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                                                                                {p.nom}
                                                                            </span>
                                                                            <span className="text-[13px] font-bold text-[var(--text-primary)]">
                                                                                {formatCurrency(parseFloat(p.montant), p.devise)}
                                                                                <span className="text-[11px] text-[var(--text-tertiary)] ml-2">({(p.pourcentage || 0).toFixed(2)}%)</span>
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                ))}
                                                                <div className="pt-2 mt-2 border-t-2 border-[var(--border-default)]">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[13px] font-bold text-[var(--text-primary)]">TOTAL</span>
                                                                        <span className="text-[11px] text-[var(--text-tertiary)] italic">Multi-devises</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Vue convertie */
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Convertir en :</label>
                                                                    <select
                                                                        value={conversionCurrency}
                                                                        onChange={(e) => setConversionCurrency(e.target.value)}
                                                                        className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                                                                    >
                                                                        {CURRENCIES.map(c => (
                                                                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="p-3 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 rounded-[var(--radius-md)] border border-[var(--accent)]/20">
                                                                    <div className="text-[11px] text-[var(--text-secondary)] mb-1">Budget Total Converti</div>
                                                                    <div className="text-[20px] font-bold text-[var(--accent)]">
                                                                        {(() => {
                                                                            const contributions: Array<{ montant: number; devise: string }> = [];
                                                                            partiesPubliques.forEach(p => {
                                                                                if (parseFloat(p.montant) > 0) {
                                                                                    contributions.push({ montant: parseFloat(p.montant), devise: p.devise });
                                                                                }
                                                                            });
                                                                            partiesPrivees.forEach(p => {
                                                                                if (parseFloat(p.montant) > 0) {
                                                                                    contributions.push({ montant: parseFloat(p.montant), devise: p.devise });
                                                                                }
                                                                            });
                                                                            const totalConverted = calculateTotalBudget(contributions, conversionCurrency, exchangeRates);
                                                                            return formatCurrency(totalConverted, conversionCurrency);
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] text-[var(--text-tertiary)] italic">
                                                                    * Taux de change utilisés : {Object.entries(exchangeRates).map(([curr, rate]) => `1 ${curr} = ${rate} FCFA`).join(", ")}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Structure */}
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
                                    {/* ── Composant : Nom + Budget + TypeActivite (si niveau le plus bas) + Actions ── */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-blue-500/15 text-blue-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[10px] flex-shrink-0">C{ci + 1}</div>
                                        <input type="text" value={comp.name} onChange={e => updateComponentName(ci, e.target.value)} placeholder="Nom du composant..." className="flex-1 min-w-0 bg-transparent border-b-2 border-transparent hover:border-[var(--border-default)] focus:border-[var(--accent)] outline-none text-[14px] font-bold text-[var(--text-primary)] px-1 py-1 transition-colors" />
                                        {/* Budget inline */}
                                        <div className="relative w-[150px] flex-shrink-0">
                                            <input type="number" value={comp.budget || ""} onChange={e => updateComponentBudget(ci, e.target.value)} placeholder="Budget" className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] pr-12 focus:outline-none focus:border-[var(--accent)] transition-colors" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--text-tertiary)] font-bold">FCFA</span>
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
                                    {(() => {
                                        const contributions: Array<{ montant: number; devise: string }> = [];
                                        if (structureJuridique === "MOP") {
                                            if (budgetNational && parseFloat(budgetNationalMontant) > 0) {
                                                contributions.push({ montant: parseFloat(budgetNationalMontant), devise: budgetNationalDevise });
                                            }
                                            bailleurs.forEach(b => {
                                                b.contributions.forEach(c => {
                                                    const montant = parseFloat(c.montant) || 0;
                                                    if (montant > 0) {
                                                        contributions.push({ montant, devise: c.devise });
                                                    }
                                                });
                                            });
                                        } else {
                                            partiesPubliques.forEach(p => {
                                                if (parseFloat(p.montant) > 0) {
                                                    contributions.push({ montant: parseFloat(p.montant), devise: p.devise });
                                                }
                                            });
                                            partiesPrivees.forEach(p => {
                                                if (parseFloat(p.montant) > 0) {
                                                    contributions.push({ montant: parseFloat(p.montant), devise: p.devise });
                                                }
                                            });
                                        }
                                        if (contributions.length === 0) return "—";
                                        const total = calculateTotalBudget(contributions, "FCFA", exchangeRates);
                                        return formatCurrency(total, "FCFA");
                                    })()}
                                </div>
                            </div>
                            <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-3 border border-[var(--border-default)]">
                                <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Financement</div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                                    {structureJuridique === "MOP" 
                                        ? `MOP — ${bailleurs.length > 0 ? bailleurs.map(b => b.nom).join(", ") : "—"}${budgetNational ? " + Budget National" : ""}`
                                        : `PPP — ${partiesPubliques.length} public, ${partiesPrivees.length} privé`
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

            <ExchangeRateModal
                isOpen={showExchangeRateModal}
                onClose={() => setShowExchangeRateModal(false)}
                onSave={(rates) => {
                    setExchangeRates(rates);
                    calculateBailleurPercentages();
                    toast.success("Taux de change enregistrés");
                }}
                currentRates={exchangeRates}
                usedCurrencies={getUsedCurrencies()}
            />
        </div>
    );
}
