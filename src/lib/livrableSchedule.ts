// ══════════════════════════════════════════════════════════════
// CALENDRIER DES LIVRABLES D'ÉTUDE ET DES TÂCHES D'EXÉCUTION
//
// Fichier identique dans le frontend (lib/livrableSchedule.ts) et le backend
// (modules/planning/livrable-schedule.ts) : le navigateur calcule pendant la
// saisie, le serveur recalcule à l'enregistrement et fait foi.
//
// Les deux phases suivent les mêmes règles ; seul le vocabulaire change
// (livrable R1… / tâche T1…).
//
// Règles de l'équipe :
//   Délai        temps depuis T0 jusqu'à l'échéance (T0 + 3 mois = échéance)
//   Durée        temps d'exécution du livrable (début + 1 mois = fin)
//   Prédécesseur la date de début = date de fin du prédécesseur (série)
//   Parallèle    sans prédécesseur, commence à la date de début fixée, sinon à T0
//   Successeur   déduit des prédécesseurs
//   Mois         mois de calendrier (15 janv. + 1 mois = 15 févr. ; 31 janv. + 1 mois = 28 févr.)
//
// L'échéance d'un livrable est sa date de fin. Elle est fixée par UNE des
// trois saisies, désignée par `modeFin` ; les deux autres en sont déduites :
//   duree  fin = début + durée      délai déduit
//   delai  fin = T0 + délai         durée déduite
//   fin    fin = date saisie        durée et délai déduits
// ══════════════════════════════════════════════════════════════

export type Unite = 'jours' | 'semaines' | 'mois';
export type ModeFin = 'duree' | 'delai' | 'fin';

export interface LivrableSaisi {
  numero: string;
  intitule?: string;
  ponderation?: number;
  predecesseur?: string;
  /** Début ; pris en compte seulement s'il a été fixé (`debutFixe`) et sans prédécesseur. */
  dateDebut?: string | Date;
  /**
   * Le début a été saisi par l'utilisateur. Sinon il suit T0 ou le prédécesseur.
   * Absent sur les livrables anciens : un début enregistré est alors considéré comme saisi.
   */
  debutFixe?: boolean;
  dateFin?: string | Date;
  duree?: number;
  dureeUnite?: Unite | string;
  delai?: number;
  delaiUnite?: Unite | string;
  modeFin?: ModeFin | string;
}

export interface LivrableCalcule {
  dateDebut?: string;
  debutFixe: boolean;
  dateFin?: string;
  dateEcheance?: string;
  duree?: number;
  dureeUnite: Unite;
  delai?: number;
  delaiUnite: Unite;
  modeFin: ModeFin;
  predecesseur?: string;
  /** Numéros des livrables qui suivent celui-ci, séparés par des virgules. */
  successeur?: string;
  /**
   * Report, en jours, que cette ligne peut absorber sans décaler la fin de la
   * phase. Absent si la ligne n'a pas d'échéance calculable.
   */
  margeTotale?: number;
  /** Marge nulle ou négative : tout retard ici décale la fin de la phase. */
  critique?: boolean;
}

export type ChampLivrable = 'numero' | 'predecesseur' | 'dateDebut' | 'dateFin' | 'duree' | 'delai' | 'ponderation';

export interface ProblemeLivrable {
  /** Numéro du livrable concerné ; absent pour un problème d'ensemble. */
  numero?: string;
  index?: number;
  champ?: ChampLivrable;
  message: string;
}

export interface CalendrierEtude<T> {
  livrables: Array<T & LivrableCalcule>;
  problemes: ProblemeLivrable[];
  debut?: string;
  fin?: string;
  totalPonderation: number;
}

// ── Dates : jours calendaires en UTC, au format AAAA-MM-JJ ──

const DAY_MS = 86_400_000;

/** Jour d'une date saisie ou reçue, sans fuseau horaire. */
export function toDay(value: string | Date | undefined | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const utc = (day: string) => {
  const [y, m, d] = parts(day);
  return Date.UTC(y, m - 1, d);
};
const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

function addMonths(day: string, months: number): string {
  const [y, m, d] = parts(day);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const clamped = Math.min(d, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return fromUtc(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), clamped));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export const normaliserUnite = (unite: string | undefined, parDefaut: Unite = 'mois'): Unite =>
  unite === 'jours' || unite === 'semaines' || unite === 'mois' ? unite : parDefaut;

/** Ajoute une quantité (éventuellement décimale) exprimée dans une unité. */
export function ajouter(day: string, quantite: number, unite: Unite): string {
  if (unite === 'jours') return fromUtc(utc(day) + Math.round(quantite) * DAY_MS);
  if (unite === 'semaines') return fromUtc(utc(day) + Math.round(quantite * 7) * DAY_MS);
  const entiers = Math.trunc(quantite);
  const base = addMonths(day, entiers);
  const reste = quantite - entiers;
  if (reste === 0) return base;
  const [y, m] = parts(base);
  return fromUtc(utc(base) + Math.round(reste * daysInMonth(y, m - 1)) * DAY_MS);
}

/** Écart entre deux jours dans une unité ; en mois, mois entiers plus fraction du mois suivant. */
export function ecart(from: string, to: string, unite: Unite): number {
  const jours = Math.round((utc(to) - utc(from)) / DAY_MS);
  if (unite === 'jours') return jours;
  if (unite === 'semaines') return round2(jours / 7);
  const signe = jours < 0 ? -1 : 1;
  const [a, b] = signe < 0 ? [to, from] : [from, to];
  let mois = 0;
  while (addMonths(a, mois + 1) <= b) mois++;
  const palier = addMonths(a, mois);
  const suivant = addMonths(a, mois + 1);
  const fraction = (utc(b) - utc(palier)) / (utc(suivant) - utc(palier));
  return signe * round2(mois + fraction);
}

// ── Calcul ──

const positif = (value: number | undefined): value is number => typeof value === 'number' && isFinite(value) && value > 0;

/** Mode d'un livrable enregistré avant l'introduction de `modeFin`. */
function modeParDefaut(l: LivrableSaisi): ModeFin {
  if (l.modeFin === 'duree' || l.modeFin === 'delai' || l.modeFin === 'fin') return l.modeFin;
  if (positif(l.duree)) return 'duree';
  if (positif(l.delai)) return 'delai';
  if (toDay(l.dateFin)) return 'fin';
  return 'duree';
}

/**
 * Calcule début, fin, durée, délai et successeurs de chaque livrable.
 * Les livrables sont rendus dans l'ordre reçu, avec les problèmes relevés.
 */
export function calculerCalendrierEtude<T extends LivrableSaisi>(
  livrables: T[],
  dateT0?: string | Date | null,
): CalendrierEtude<T> {
  const t0 = toDay(dateT0);
  const problemes: ProblemeLivrable[] = [];
  const numeros = livrables.map((l) => (l.numero ?? '').trim());
  const indexParNumero = new Map<string, number>();

  numeros.forEach((numero, index) => {
    if (!numero) {
      problemes.push({ index, champ: 'numero', message: `Ligne ${index + 1} : numéro manquant.` });
    } else if (indexParNumero.has(numero)) {
      problemes.push({ numero, index, champ: 'numero', message: `Le numéro ${numero} est utilisé deux fois.` });
    } else {
      indexParNumero.set(numero, index);
    }
  });

  const predecesseurs = livrables.map((l, index) => {
    const pred = (l.predecesseur ?? '').trim();
    if (!pred) return undefined;
    if (pred === numeros[index]) {
      problemes.push({ numero: numeros[index], index, champ: 'predecesseur', message: `${numeros[index]} ne peut pas se précéder lui-même.` });
      return undefined;
    }
    if (!indexParNumero.has(pred)) {
      problemes.push({ numero: numeros[index], index, champ: 'predecesseur', message: `${numeros[index]} : le prédécesseur ${pred} n'existe pas.` });
      return undefined;
    }
    return indexParNumero.get(pred)!;
  });

  // Ordre de calcul : chaque prédécesseur avant ses successeurs ; boucles relevées.
  const etat: Array<'a-faire' | 'en-cours' | 'fait'> = livrables.map(() => 'a-faire');
  const enBoucle = new Set<number>();
  const ordre: number[] = [];
  const visiter = (index: number, chemin: number[]) => {
    if (etat[index] === 'fait') return;
    if (etat[index] === 'en-cours') {
      chemin.slice(chemin.indexOf(index)).forEach((i) => enBoucle.add(i));
      return;
    }
    etat[index] = 'en-cours';
    const pred = predecesseurs[index];
    if (pred !== undefined) visiter(pred, [...chemin, index]);
    etat[index] = 'fait';
    ordre.push(index);
  };
  livrables.forEach((_, index) => visiter(index, []));
  if (enBoucle.size) {
    const boucle = [...enBoucle].map((i) => numeros[i]).join(' → ');
    enBoucle.forEach((index) =>
      problemes.push({ numero: numeros[index], index, champ: 'predecesseur', message: `Boucle de prédécesseurs : ${boucle}.` }),
    );
  }

  const resultats: Array<T & LivrableCalcule> = new Array(livrables.length);
  for (const index of ordre) {
    const saisi = livrables[index];
    const numero = numeros[index];
    const modeFin = modeParDefaut(saisi);
    const dureeUnite = normaliserUnite(saisi.dureeUnite);
    const delaiUnite = normaliserUnite(saisi.delaiUnite);
    const pred = enBoucle.has(index) ? undefined : predecesseurs[index];

    const debutFixe = pred === undefined && (saisi.debutFixe ?? !!toDay(saisi.dateDebut)) && !!toDay(saisi.dateDebut);
    const debut = pred !== undefined ? resultats[pred]?.dateFin : debutFixe ? toDay(saisi.dateDebut) : t0;

    let fin: string | undefined;
    if (modeFin === 'duree') {
      if (debut && positif(saisi.duree)) fin = ajouter(debut, saisi.duree, dureeUnite);
      else if (!debut && positif(saisi.duree)) {
        problemes.push({ numero, index, champ: 'dateDebut', message: `${numero} : indiquez une date de début, un prédécesseur ou la date T0.` });
      }
    } else if (modeFin === 'delai') {
      if (t0 && typeof saisi.delai === 'number' && saisi.delai >= 0) fin = ajouter(t0, saisi.delai, delaiUnite);
      else if (!t0) problemes.push({ numero, index, champ: 'delai', message: `${numero} : le délai se compte depuis T0, qui n'est pas définie.` });
    } else {
      fin = toDay(saisi.dateFin);
    }

    if (debut && fin && fin < debut) {
      problemes.push({ numero, index, champ: 'dateFin', message: `${numero} : l'échéance précède la date de début.` });
    }

    resultats[index] = {
      ...saisi,
      numero,
      predecesseur: pred !== undefined ? numeros[pred] : (saisi.predecesseur ?? '').trim() || undefined,
      modeFin,
      dureeUnite,
      delaiUnite,
      dateDebut: debut,
      debutFixe,
      dateFin: fin,
      dateEcheance: fin,
      duree: modeFin === 'duree' ? saisi.duree : debut && fin ? ecart(debut, fin, dureeUnite) : undefined,
      delai: modeFin === 'delai' ? saisi.delai : t0 && fin ? ecart(t0, fin, delaiUnite) : undefined,
    };
  }

  resultats.forEach((livrable, index) => {
    const suivants = predecesseurs
      .map((pred, i) => (pred === index && !enBoucle.has(i) ? numeros[i] : undefined))
      .filter((n): n is string => !!n);
    livrable.successeur = suivants.length ? suivants.join(', ') : undefined;
  });

  // ── Passe arrière : marge totale et chemin critique ──
  // La phase se termine à la plus tardive des échéances. Une ligne sans
  // successeur doit donc finir là ; une ligne qui en a doit finir avant que le
  // premier de ses successeurs ne commence, puisque l'enchaînement est
  // fin → début. La marge totale est le report qu'une ligne peut absorber sans
  // décaler la fin de la phase : une marge nulle la met sur le chemin critique.
  const finPhase = resultats
    .map((l) => l.dateFin)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  if (finPhase) {
    const successeursDe: number[][] = livrables.map(() => []);
    predecesseurs.forEach((pred, i) => {
      if (pred !== undefined && !enBoucle.has(i)) successeursDe[pred].push(i);
    });

    // Calculée pour les successeurs avant leurs prédécesseurs : l'ordre
    // topologique parcouru à l'envers.
    const debutAuPlusTard: Array<string | undefined> = new Array(livrables.length);
    for (const index of [...ordre].reverse()) {
      const ligne = resultats[index];
      if (!ligne?.dateFin) continue;

      const contraintes = successeursDe[index]
        .map((i) => debutAuPlusTard[i])
        .filter((d): d is string => !!d)
        .sort();
      const finAuPlusTard = contraintes.length ? contraintes[0] : finPhase;

      ligne.margeTotale = ecart(ligne.dateFin, finAuPlusTard, 'jours');
      ligne.critique = ligne.margeTotale <= 0;
      // Durée ramenée à zéro si l'échéance précède le début : la contrainte est
      // intenable et déjà signalée, elle ne doit pas inventer de la marge pour
      // le prédécesseur en remontant.
      const dureeJours = ligne.dateDebut
        ? Math.max(0, ecart(ligne.dateDebut, ligne.dateFin, 'jours'))
        : 0;
      debutAuPlusTard[index] = ajouter(finAuPlusTard, -dureeJours, 'jours');
    }
  }

  const totalPonderation = round2(livrables.reduce((sum, l) => sum + (Number(l.ponderation) || 0), 0));
  if (livrables.length > 0 && Math.abs(totalPonderation - 100) > 0.01) {
    problemes.push({ champ: 'ponderation', message: `La somme des pondérations doit être égale à 100 % (actuellement ${totalPonderation} %).` });
  }

  const debuts = resultats.map((l) => l.dateDebut).filter((d): d is string => !!d).sort();
  const fins = resultats.map((l) => l.dateFin).filter((d): d is string => !!d).sort();
  return { livrables: resultats, problemes, debut: debuts[0], fin: fins[fins.length - 1], totalPonderation };
}
