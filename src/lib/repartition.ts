// ══════════════════════════════════════════════════════════════
// RÉPARTITION DU DEVIS SUR LES PÉRIODES
//
// Fichier identique dans le frontend (lib/repartition.ts) et le backend
// (modules/planning/repartition.ts).
//
// C'est le maillon qui relie le devis au planning. Le devis dit COMBIEN, le
// planning dit QUAND ; la répartition en tire, période par période, ce qui
// sera réalisé et ce qu'il faudra décaisser. De là viennent la courbe des
// dépenses et la courbe d'avancement.
//
// Le calcul se fait en deux temps, comme dans le fichier Excel d'EDC :
//
//   1. VENTILATION DES JOURS — pour chaque tâche, combien de jours TRAVAILLÉS
//      tombent dans chaque période. Une tâche de 14 jours démarrée le lundi
//      23 février, en semaines de six jours ouvrés, se ventile 6 + 6 + 2.
//
//   2. PRORATA — la quantité suit les jours :
//
//        quantité de la période = quantité totale × jours de la période
//                                                   ────────────────────
//                                                    total des jours
//
//      puis montant = quantité × prix unitaire, et les cumuls par-dessus.
//
// La somme des périodes retombe exactement sur le devis : la dernière période
// travaillée absorbe le reste de l'arrondi. C'est la vérification qu'EDC fait
// à la main dans son classeur.
//
// Une ligne réalisée par PLUSIEURS tâches — la même prestation menée par zone
// ou par bâtiment — additionne les jours de ses tâches : la formule ci-dessus
// s'applique alors telle quelle.
// ══════════════════════════════════════════════════════════════

import {
  CALENDRIER_PAR_DEFAUT,
  estOuvre,
  joursOuvresEntre,
  toDay,
  type Calendrier,
} from './livrableSchedule';
import { montantLigne, type LigneDqe } from './dqe';

export type PasTemps = 'jour' | 'semaine' | 'mois' | 'personnalise';

export interface Echelle {
  pas: PasTemps;
  /** Longueur d'un pas personnalisé, en jours de calendrier (ex. 15). */
  joursPersonnalises?: number;
}

export const ECHELLE_PAR_DEFAUT: Echelle = { pas: 'mois' };

export const LIBELLE_PAS: Record<PasTemps, string> = {
  jour: 'Jour par jour',
  semaine: 'Semaine par semaine',
  mois: 'Mois par mois',
  personnalise: 'Pas personnalisé',
};

/** Ce que la répartition a besoin de savoir d'une tâche du planning. */
export interface TacheRepartie {
  id?: string;
  numero: string;
  designation?: string;
  dateDebut?: string | Date;
  dateFin?: string | Date;
}

export interface Periode {
  /** Rang, à partir de 1 — la « période 1 » du classeur d'EDC. */
  rang: number;
  debut: string;
  /** Dernier jour de la période, compris. */
  fin: string;
  libelle: string;
  /** Jours travaillés que compte la période, tous travaux confondus. */
  joursOuvres: number;
}

export interface CelluleRepartition {
  quantite: number;
  quantiteCumulee: number;
  montant: number;
  montantCumule: number;
  /** Part de la ligne réalisée pendant la période, en pourcentage. */
  pourcentage: number;
  pourcentageCumule: number;
}

export interface LigneRepartition {
  ligneId?: string;
  numero: string;
  designation: string;
  unite?: string;
  quantite: number;
  prixUnitaire: number;
  montantTotal: number;
  /** Numéros des tâches qui réalisent la ligne. */
  taches: string[];
  debut?: string;
  fin?: string;
  /** Jours travaillés de la ligne dans chaque période — la ventilation. */
  jours: number[];
  totalJours: number;
  periodes: CelluleRepartition[];
}

export interface SynthesePeriode {
  rang: number;
  montant: number;
  montantCumule: number;
  /** Avancement cumulé en pourcentage du montant total réparti. */
  avancement: number;
}

export interface Repartition {
  periodes: Periode[];
  lignes: LigneRepartition[];
  synthese: SynthesePeriode[];
  /** Montant hors taxe effectivement réparti. */
  totalHT: number;
  debut?: string;
  fin?: string;
  /** Ce qui empêche une partie du devis d'être répartie. */
  problemes: string[];
}

const DAY_MS = 86_400_000;
const round2 = (value: number) => Math.round(value * 100) / 100;
const nombre = (value: number | undefined): number =>
  typeof value === 'number' && isFinite(value) ? value : 0;

const utc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const jourSuivant = (day: string) => fromUtc(utc(day) + DAY_MS);

/** Jours travaillés de `debut` à `fin`, tous deux COMPRIS. */
export function joursOuvresInclus(debut: string, fin: string, calendrier: Calendrier): number {
  if (fin < debut) return 0;
  return joursOuvresEntre(debut, fin, calendrier) + (estOuvre(fin, calendrier) ? 1 : 0);
}

// ── Découpage du temps ──

const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const enClair = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MOIS_COURT[m - 1]}`;
};

/** Lundi de la semaine d'un jour donné : les semaines d'EDC courent du lundi au dimanche. */
function lundiDe(day: string): string {
  const jour = new Date(utc(day)).getUTCDay(); // 0 = dimanche
  const recul = jour === 0 ? 6 : jour - 1;
  return fromUtc(utc(day) - recul * DAY_MS);
}

const premierDuMois = (day: string) => `${day.slice(0, 7)}-01`;

function dernierDuMois(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return fromUtc(Date.UTC(y, m, 0));
}

const moisSuivant = (day: string) => {
  const [y, m] = day.split('-').map(Number);
  return fromUtc(Date.UTC(y, m, 1));
};

/**
 * Découpe l'horizon en périodes. Au pas du jour, seuls les jours travaillés
 * font une période : un chantier de 62 jours ouvrés donne 62 colonnes, et non
 * les 74 jours de calendrier qu'il occupe.
 */
export function decouperPeriodes(
  debut: string,
  fin: string,
  echelle: Echelle,
  calendrier: Calendrier = CALENDRIER_PAR_DEFAUT,
): Periode[] {
  if (fin < debut) return [];

  const periodes: Periode[] = [];
  const ajouter = (d: string, f: string, libelle: string) => {
    const borneFin = f > fin ? fin : f;
    const borneDebut = d < debut ? debut : d;
    periodes.push({
      rang: periodes.length + 1,
      debut: borneDebut,
      fin: borneFin,
      libelle,
      joursOuvres: joursOuvresInclus(borneDebut, borneFin, calendrier),
    });
  };

  if (echelle.pas === 'jour') {
    for (let jour = debut; jour <= fin; jour = jourSuivant(jour)) {
      if (estOuvre(jour, calendrier)) ajouter(jour, jour, enClair(jour));
    }
    return periodes;
  }

  if (echelle.pas === 'semaine') {
    for (let lundi = lundiDe(debut); lundi <= fin; lundi = fromUtc(utc(lundi) + 7 * DAY_MS)) {
      const dimanche = fromUtc(utc(lundi) + 6 * DAY_MS);
      ajouter(lundi, dimanche, `S${periodes.length + 1} · ${enClair(lundi)}`);
    }
    return periodes;
  }

  if (echelle.pas === 'mois') {
    for (let premier = premierDuMois(debut); premier <= fin; premier = moisSuivant(premier)) {
      const [y, m] = premier.split('-').map(Number);
      ajouter(premier, dernierDuMois(premier), `${MOIS_COURT[m - 1]} ${y}`);
    }
    return periodes;
  }

  // Pas personnalisé : des blocs de N jours de CALENDRIER à partir du début —
  // « tous les 15 jours » se compte sur le calendrier, pas sur les jours ouvrés.
  const longueur = Math.max(1, Math.trunc(nombre(echelle.joursPersonnalises) || 15));
  for (let d = debut; d <= fin; d = fromUtc(utc(d) + longueur * DAY_MS)) {
    const f = fromUtc(utc(d) + (longueur - 1) * DAY_MS);
    ajouter(d, f, `P${periodes.length + 1} · ${enClair(d)}`);
  }
  return periodes;
}

// ── Répartition ──

/**
 * Étale le devis sur les périodes, en suivant le planning.
 *
 * Seules les lignes de prestation reliées à au moins une tâche datée sont
 * réparties : le reste est signalé plutôt que deviné.
 */
export function repartir(
  dqe: LigneDqe[],
  taches: TacheRepartie[],
  echelle: Echelle = ECHELLE_PAR_DEFAUT,
  calendrier: Calendrier = CALENDRIER_PAR_DEFAUT,
): Repartition {
  const problemes: string[] = [];

  const parId = new Map<string, TacheRepartie>();
  for (const tache of taches) if (tache.id) parId.set(tache.id, tache);

  type Retenue = {
    ligne: LigneDqe;
    taches: TacheRepartie[];
    debut: string;
    fin: string;
  };

  const retenues: Retenue[] = [];
  for (const ligne of dqe) {
    if (ligne.titre) continue;
    const numero = (ligne.numero ?? '').trim();
    if (!numero && !(ligne.designation ?? '').trim()) continue;

    const liees = (ligne.tacheIds ?? []).map((id) => parId.get(id)).filter((t): t is TacheRepartie => !!t);
    if (!liees.length) {
      problemes.push(`${numero} : aucune tâche du planning ne réalise cette ligne.`);
      continue;
    }

    const datees = liees.filter((t) => toDay(t.dateDebut) && toDay(t.dateFin));
    if (!datees.length) {
      problemes.push(`${numero} : les tâches qui la réalisent n'ont pas de dates.`);
      continue;
    }

    const debuts = datees.map((t) => toDay(t.dateDebut)!).sort();
    const fins = datees.map((t) => toDay(t.dateFin)!).sort();
    retenues.push({ ligne, taches: datees, debut: debuts[0], fin: fins[fins.length - 1] });
  }

  if (!retenues.length) {
    return { periodes: [], lignes: [], synthese: [], totalHT: 0, problemes };
  }

  const debut = retenues.map((r) => r.debut).sort()[0];
  const fin = retenues.map((r) => r.fin).sort().pop()!;
  const periodes = decouperPeriodes(debut, fin, echelle, calendrier);

  const lignes: LigneRepartition[] = retenues.map(({ ligne, taches: liees, debut: d, fin: f }) => {
    // 1. Ventilation : jours travaillés de la ligne dans chaque période.
    //    Les tâches s'additionnent — une prestation menée sur deux zones
    //    avance deux fois plus vite le jour où les deux chantiers tournent.
    const jours = periodes.map((periode) =>
      liees.reduce((somme, tache) => {
        const td = toDay(tache.dateDebut)!;
        const tf = toDay(tache.dateFin)!;
        const de = td > periode.debut ? td : periode.debut;
        const a = tf < periode.fin ? tf : periode.fin;
        return somme + joursOuvresInclus(de, a, calendrier);
      }, 0),
    );

    const totalJours = jours.reduce((s, j) => s + j, 0);
    const quantite = nombre(ligne.quantite);
    const prixUnitaire = nombre(ligne.prixUnitaire);
    const montantTotal = montantLigne(ligne);

    // 2. Prorata. La dernière période travaillée absorbe le reste de
    //    l'arrondi : la somme des colonnes doit retomber sur le devis.
    const dernierePleine = jours.reduce((dernier, j, i) => (j > 0 ? i : dernier), -1);

    let quantiteCumulee = 0;
    let montantCumule = 0;
    const cellules: CelluleRepartition[] = periodes.map((_, i) => {
      let part = 0;
      let montant = 0;
      if (totalJours > 0 && jours[i] > 0) {
        if (i === dernierePleine) {
          part = round2(quantite - quantiteCumulee);
          montant = round2(montantTotal - montantCumule);
        } else {
          part = round2((quantite * jours[i]) / totalJours);
          montant = round2((montantTotal * jours[i]) / totalJours);
        }
      }
      quantiteCumulee = round2(quantiteCumulee + part);
      montantCumule = round2(montantCumule + montant);
      return {
        quantite: part,
        quantiteCumulee,
        montant,
        montantCumule,
        pourcentage: montantTotal ? round2((montant / montantTotal) * 100) : 0,
        pourcentageCumule: montantTotal ? round2((montantCumule / montantTotal) * 100) : 0,
      };
    });

    if (totalJours === 0) {
      problemes.push(`${ligne.numero} : ses tâches ne comptent aucun jour travaillé.`);
    }

    return {
      ligneId: ligne.id,
      numero: ligne.numero,
      designation: ligne.designation,
      unite: ligne.unite,
      quantite,
      prixUnitaire,
      montantTotal,
      taches: liees.map((t) => t.numero),
      debut: d,
      fin: f,
      jours,
      totalJours,
      periodes: cellules,
    };
  });

  // ── Synthèse : ce qui alimente les courbes ──
  const totalHT = round2(lignes.reduce((somme, l) => somme + l.montantTotal, 0));
  let cumul = 0;
  const synthese: SynthesePeriode[] = periodes.map((periode, i) => {
    const montant = round2(lignes.reduce((somme, l) => somme + l.periodes[i].montant, 0));
    cumul = round2(cumul + montant);
    return {
      rang: periode.rang,
      montant,
      montantCumule: cumul,
      avancement: totalHT ? round2((cumul / totalHT) * 100) : 0,
    };
  });

  return { periodes, lignes, synthese, totalHT, debut, fin, problemes: [...new Set(problemes)] };
}

/** Échelle lue d'un enregistrement, où elle peut manquer ou être incomplète. */
export function normaliserEchelle(valeur: Partial<Echelle> | undefined | null): Echelle {
  const pas = valeur?.pas;
  if (pas !== 'jour' && pas !== 'semaine' && pas !== 'mois' && pas !== 'personnalise') return ECHELLE_PAR_DEFAUT;
  if (pas !== 'personnalise') return { pas };
  const jours = Math.trunc(nombre(valeur?.joursPersonnalises));
  return { pas, joursPersonnalises: jours > 0 ? jours : 15 };
}
