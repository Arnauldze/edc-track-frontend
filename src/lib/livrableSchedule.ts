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
//   Prédécesseur la date de début se déduit du prédécesseur (voir Liaisons)
//   Parallèle    sans prédécesseur, commence à la date de début fixée, sinon à T0
//   Successeur   déduit des prédécesseurs
//   Mois         mois de calendrier (15 janv. + 1 mois = 15 févr. ; 31 janv. + 1 mois = 28 févr.)
//
// L'échéance d'un livrable est sa date de fin. Elle est fixée par UNE des
// trois saisies, désignée par `modeFin` ; les deux autres en sont déduites :
//   duree  fin = début + durée      délai déduit
//   delai  fin = T0 + délai         durée déduite
//   fin    fin = date saisie        durée et délai déduits
//
// Liaisons, notées comme dans MS Project (colonne Préd.) :
//   T3            fin à début, sans décalage : commence à la fin de T3
//   T3FD+3sem     fin à début : 3 semaines après la fin de T3
//   T3DD+2j       début à début : 2 jours après le début de T3
//   Le décalage peut être négatif (T3FD-1sem = une semaine avant la fin de T3)
//   et son unité vaut le jour par défaut (T3FD+5 = cinq jours).
//   Les liaisons fin à fin et début à fin ne sont pas gérées.
// ══════════════════════════════════════════════════════════════

export type Unite = 'jours' | 'semaines' | 'mois';
export type ModeFin = 'duree' | 'delai' | 'fin';

/** Fin à début (la plus courante) ou début à début. */
export type TypeLiaison = 'FD' | 'DD';

export interface Liaison {
  /** Numéro de la ligne dont celle-ci dépend. */
  numero: string;
  type: TypeLiaison;
  /** Décalage appliqué après la date du prédécesseur ; négatif = avance. */
  decalage: number;
  unite: Unite;
}

export interface LivrableSaisi {
  /**
   * Identifiant interne, stable et jamais affiché. Le numéro, lui, est une
   * étiquette : il se renomme et se renumérote à l'insertion comme dans
   * Excel. Ce qui doit survivre à une renumérotation — la référence de base,
   * et demain le suivi — s'accroche à cet identifiant, pas au numéro.
   */
  id?: string;
  numero: string;
  intitule?: string;
  ponderation?: number;
  /** Liaison vers le prédécesseur : « T3 », « T3FD+2sem », « T3DD-1j »… */
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
  /** Liaison sous sa forme canonique, vide si la ligne n'a pas de prédécesseur. */
  predecesseur?: string;
  /** Liaison analysée : sert à l'écran pour expliquer d'où vient le début. */
  liaison?: Liaison;
  /**
   * Identifiant interne du prédécesseur résolu. Suivre les liaisons par là
   * plutôt que par le numéro, qui change à la renumérotation.
   */
  predecesseurId?: string;
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

// ── Liaisons ──

const UNITES_LIAISON: Record<string, Unite> = {
  j: 'jours',
  jr: 'jours',
  jour: 'jours',
  jours: 'jours',
  s: 'semaines',
  sem: 'semaines',
  semaine: 'semaines',
  semaines: 'semaines',
  m: 'mois',
  mois: 'mois',
};

/** Exemple affiché dans les messages d'erreur de la colonne Préd. */
export const EXEMPLES_LIAISON = 'T3, T3FD+2sem, T3DD-1j';

const MOTIF_LIAISON = /^(.+?)(FD|DD|FF|DF)?(?:([+-])(\d+(?:[.,]\d+)?)([a-zé]*))?$/i;

/**
 * Analyse une saisie de la colonne Préd. Renvoie la liaison, un motif de
 * refus, ou `undefined` si la case est vide. Le numéro n'est pas vérifié ici :
 * c'est le calendrier qui sait quelles lignes existent.
 */
export function analyserLiaison(texte: string | undefined): Liaison | { erreur: string } | undefined {
  const compact = (texte ?? '').replace(/\s+/g, '');
  if (!compact) return undefined;

  const trouve = MOTIF_LIAISON.exec(compact);
  if (!trouve) return { erreur: `« ${texte!.trim()} » n'est pas une liaison valide (${EXEMPLES_LIAISON}).` };

  const [, numero, typeBrut, signe, nombre, uniteBrute] = trouve;
  const type = (typeBrut ?? 'FD').toUpperCase();

  if (type === 'FF' || type === 'DF') {
    return { erreur: `les liaisons ${type === 'FF' ? 'fin à fin (FF)' : 'début à fin (DF)'} ne sont pas gérées.` };
  }

  let decalage = 0;
  let unite: Unite = 'jours';

  if (nombre) {
    decalage = Number(nombre.replace(',', '.')) * (signe === '-' ? -1 : 1);
    if (!isFinite(decalage)) return { erreur: `décalage illisible dans « ${texte!.trim()} » (${EXEMPLES_LIAISON}).` };
    if (uniteBrute) {
      const reconnue = UNITES_LIAISON[uniteBrute.toLowerCase()];
      if (!reconnue) return { erreur: `unité « ${uniteBrute} » inconnue : j, sem ou mois (${EXEMPLES_LIAISON}).` };
      unite = reconnue;
    }
  }

  return { numero, type: type as TypeLiaison, decalage, unite };
}

const ABREGE_UNITE: Record<Unite, string> = { jours: 'j', semaines: 'sem', mois: 'mois' };

/** Notation canonique d'une liaison, telle qu'elle est réaffichée. */
export function formaterLiaison(liaison: Liaison): string {
  if (liaison.type === 'FD' && liaison.decalage === 0) return liaison.numero;
  if (liaison.decalage === 0) return `${liaison.numero}${liaison.type}`;
  const signe = liaison.decalage < 0 ? '-' : '+';
  return `${liaison.numero}${liaison.type}${signe}${Math.abs(liaison.decalage)}${ABREGE_UNITE[liaison.unite]}`;
}

/**
 * Identifiant interne d'une ligne. Court et sans signification : il ne sert
 * qu'à reconnaître la ligne quand son numéro change.
 */
export function nouvelIdentifiant(): string {
  const aleatoire = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  const tirage = aleatoire ? aleatoire.call((globalThis as { crypto?: unknown }).crypto).replace(/-/g, '') : Math.random().toString(36).slice(2);
  return `l-${tirage.slice(0, 8)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Réécrit les liaisons après un changement de numéros — renommage d'une ligne,
 * ou renumérotation d'un tableau entier. Le type et le décalage sont conservés :
 * un simple remplacement de texte transformerait « T3FD+2sem » en une liaison
 * vers une ligne inexistante, ou l'effacerait.
 *
 * @param nouveauNumero ancien numéro → nouveau numéro
 */
export function reetiqueterLiaisons<T extends LivrableSaisi>(lignes: T[], nouveauNumero: Map<string, string>): T[] {
  if (!nouveauNumero.size) return lignes;

  return lignes.map((ligne) => {
    const brut = (ligne.predecesseur ?? '').trim();
    if (!brut) return ligne;

    // Un numéro reconnu tel quel prime, comme au calcul.
    if (nouveauNumero.has(brut)) return { ...ligne, predecesseur: nouveauNumero.get(brut)! };

    const liaison = analyserLiaison(brut);
    if (!liaison || 'erreur' in liaison) return ligne;

    const remplacant = nouveauNumero.get(liaison.numero);
    return remplacant ? { ...ligne, predecesseur: formaterLiaison({ ...liaison, numero: remplacant }) } : ligne;
  });
}

// ── Opérations de structure ──
//
// Le numéro est une étiquette positionnelle, comme dans Excel : insérer,
// supprimer ou déplacer renumérote tout le tableau. Les liaisons suivent, et
// l'identifiant interne ne bouge jamais — c'est lui qui rattache la référence
// de base à la bonne ligne.

/** Numéro visé par la liaison d'une ligne, ou rien si elle n'en a pas. */
function cibleLiaison(lignes: LivrableSaisi[], index: number, numeros: Set<string>): string | undefined {
  const brut = (lignes[index]?.predecesseur ?? '').trim();
  if (!brut) return undefined;
  if (numeros.has(brut)) return brut;
  const liaison = analyserLiaison(brut);
  return liaison && !('erreur' in liaison) ? liaison.numero : undefined;
}

const numerosDe = (lignes: LivrableSaisi[]) =>
  new Set(lignes.map((l) => (l.numero ?? '').trim()).filter(Boolean));

/** Renumérote les lignes selon leur position (T1, T2…) et réétiquette les liaisons. */
export function renumeroterLignes<T extends LivrableSaisi>(lignes: T[], prefixe: string): T[] {
  const nouveaux = new Map<string, string>();
  const renumerotees = lignes.map((ligne, i) => {
    const numero = `${prefixe}${i + 1}`;
    if (ligne.numero && ligne.numero !== numero) nouveaux.set(ligne.numero, numero);
    return { ...ligne, numero };
  });
  return reetiqueterLiaisons(renumerotees, nouveaux);
}

/** La ligne suit-elle simplement celle du dessus ? */
function enchainee(lignes: LivrableSaisi[], index: number, numeros: Set<string>): boolean {
  return index > 0 && cibleLiaison(lignes, index, numeros) === (lignes[index - 1].numero ?? '').trim();
}

/** Repointe une liaison vers une autre ligne, type et décalage conservés. */
const repointer = <T extends LivrableSaisi>(ligne: T, ancienne: string, nouvelle: string): T =>
  reetiqueterLiaisons([ligne], new Map([[ancienne, nouvelle]]))[0];

/**
 * Insère une ligne sous une autre et referme la chaîne, comme MS Project :
 * T1 → T2 devient T1 → nouvelle → T2. Seule la ligne immédiatement suivante
 * est raccrochée, et seulement si elle suivait déjà celle du dessus : une
 * liaison choisie à la main n'est jamais détournée.
 */
export function insererApresLigne<T extends LivrableSaisi>(
  lignes: T[],
  index: number,
  nouvelle: T,
  prefixe: string,
): T[] {
  const numeros = numerosDe(lignes);
  const aRaccrocher = enchainee(lignes, index + 1, numeros);

  const avec = [
    ...lignes.slice(0, index + 1),
    { ...nouvelle, predecesseur: lignes[index]?.numero },
    ...lignes.slice(index + 1),
  ];
  const renumerotees = renumeroterLignes(avec, prefixe);

  if (!aRaccrocher || !renumerotees[index + 2]) return renumerotees;

  const parent = renumerotees[index].numero;
  const inseree = renumerotees[index + 1].numero;
  return renumerotees.map((l, i) => (i === index + 2 ? repointer(l, parent, inseree) : l));
}

/**
 * Supprime une ligne : ses successeurs reprennent sa propre liaison
 * (T1 → T2 → T3 devient T1 → T3). Un décalage propre au successeur n'est pas
 * combiné avec celui de la ligne retirée ; c'est la liaison de cette dernière
 * qui est reprise telle quelle.
 */
export function supprimerLigne<T extends LivrableSaisi>(lignes: T[], index: number, prefixe: string): T[] {
  const numeros = numerosDe(lignes);
  const retire = (lignes[index]?.numero ?? '').trim();
  const relais = lignes[index]?.predecesseur ?? '';

  const restantes = lignes
    .map((ligne, i) => (cibleLiaison(lignes, i, numeros) === retire ? { ...ligne, predecesseur: relais } : ligne))
    .filter((_, i) => i !== index);

  return renumeroterLignes(restantes, prefixe);
}

/**
 * Monte ou descend une ligne. Celles qui suivaient simplement leur voisine du
 * dessus se raccrochent à la nouvelle : le trou se referme et la chaîne se
 * reforme à la nouvelle place. Une liaison pointant ailleurs est conservée.
 */
export function deplacerLigne<T extends LivrableSaisi>(
  lignes: T[],
  index: number,
  direction: -1 | 1,
  prefixe: string,
): T[] {
  const cible = index + direction;
  if (cible < 0 || cible >= lignes.length) return lignes;

  const numeros = numerosDe(lignes);
  const enchainees = new Set(lignes.filter((_, i) => enchainee(lignes, i, numeros)).map((l) => l.id ?? l.numero));
  const cibleAvant = new Map(lignes.map((l, i) => [l.id ?? l.numero, cibleLiaison(lignes, i, numeros)]));

  const copie = [...lignes];
  [copie[index], copie[cible]] = [copie[cible], copie[index]];

  const raccordees = copie.map((ligne, i) => {
    const clef = ligne.id ?? ligne.numero;
    if (!enchainees.has(clef)) return ligne;
    const voisine = copie[i - 1];
    if (!voisine) return { ...ligne, predecesseur: undefined };
    const ancienne = cibleAvant.get(clef);
    return ancienne && ancienne !== voisine.numero ? repointer(ligne, ancienne, voisine.numero) : ligne;
  });

  return renumeroterLignes(raccordees, prefixe);
}

/** Date d'ancrage d'une liaison : fin du prédécesseur, ou son début en début à début. */
const ancreDe = (liaison: Liaison, predecesseur: LivrableCalcule | undefined) =>
  liaison.type === 'DD' ? predecesseur?.dateDebut : predecesseur?.dateFin;

/** Applique un décalage, en laissant la date intacte quand il est nul. */
const decaler = (jour: string | undefined, quantite: number, unite: Unite) =>
  jour && quantite !== 0 ? ajouter(jour, quantite, unite) : jour;

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

  const liens = livrables.map((l, index): (Liaison & { index: number }) | undefined => {
    const brut = (l.predecesseur ?? '').trim();
    if (!brut) return undefined;

    const signaler = (message: string) => {
      problemes.push({ numero: numeros[index], index, champ: 'predecesseur', message });
      return undefined;
    };

    // Un numéro existant est reconnu tel quel : sans cela, une ligne nommée
    // « T3DD » serait lue comme une liaison début à début vers « T3 ».
    const liaison = indexParNumero.has(brut)
      ? ({ numero: brut, type: 'FD', decalage: 0, unite: 'jours' } as Liaison)
      : analyserLiaison(brut);

    if (!liaison) return undefined;
    if ('erreur' in liaison) return signaler(`${numeros[index]} : ${liaison.erreur}`);
    if (liaison.numero === numeros[index]) return signaler(`${numeros[index]} ne peut pas se précéder lui-même.`);

    const pred = indexParNumero.get(liaison.numero);
    if (pred === undefined) return signaler(`${numeros[index]} : le prédécesseur ${liaison.numero} n'existe pas.`);

    return { ...liaison, index: pred };
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
    const pred = liens[index]?.index;
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
    const lien = enBoucle.has(index) ? undefined : liens[index];

    const debutFixe = lien === undefined && (saisi.debutFixe ?? !!toDay(saisi.dateDebut)) && !!toDay(saisi.dateDebut);
    const debut = lien
      ? decaler(ancreDe(lien, resultats[lien.index]), lien.decalage, lien.unite)
      : debutFixe
        ? toDay(saisi.dateDebut)
        : t0;

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
      predecesseur: lien ? formaterLiaison(lien) : (saisi.predecesseur ?? '').trim() || undefined,
      liaison: lien ? { numero: lien.numero, type: lien.type, decalage: lien.decalage, unite: lien.unite } : undefined,
      predecesseurId: lien ? livrables[lien.index].id : undefined,
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
    const suivants = liens
      .map((lien, i) => (lien?.index === index && !enBoucle.has(i) ? numeros[i] : undefined))
      .filter((n): n is string => !!n);
    livrable.successeur = suivants.length ? suivants.join(', ') : undefined;
  });

  // ── Passe arrière : marge totale et chemin critique ──
  // La phase se termine à la plus tardive des échéances. Une ligne sans
  // successeur doit donc finir là ; une ligne qui en a doit finir assez tôt
  // pour qu'aucun d'eux ne démarre en retard. La marge totale est le report
  // qu'une ligne peut absorber sans décaler la fin de la phase : une marge
  // nulle la met sur le chemin critique.
  const finPhase = resultats
    .map((l) => l.dateFin)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  if (finPhase) {
    const successeursDe: number[][] = livrables.map(() => []);
    liens.forEach((lien, i) => {
      if (lien && !enBoucle.has(i)) successeursDe[lien.index].push(i);
    });

    // Calculée pour les successeurs avant leurs prédécesseurs : l'ordre
    // topologique parcouru à l'envers.
    const debutAuPlusTard: Array<string | undefined> = new Array(livrables.length);
    for (const index of [...ordre].reverse()) {
      const ligne = resultats[index];
      if (!ligne?.dateFin) continue;

      // Durée ramenée à zéro si l'échéance précède le début : la contrainte est
      // intenable et déjà signalée, elle ne doit pas inventer de la marge pour
      // le prédécesseur en remontant.
      const dureeJours = ligne.dateDebut ? Math.max(0, ecart(ligne.dateDebut, ligne.dateFin, 'jours')) : 0;

      // Ce que chaque successeur impose à la fin de cette ligne :
      //   fin à début   elle doit finir au plus tard au début au plus tard du
      //                 successeur, décalage retranché ;
      //   début à début c'est son DÉBUT qui est contraint, sa fin peut donc
      //                 aller jusqu'à cette borne augmentée de sa propre durée.
      const contraintes = successeursDe[index]
        .map((i) => {
          const tard = debutAuPlusTard[i];
          const lien = liens[i];
          if (!tard || !lien) return undefined;
          const borne = decaler(tard, -lien.decalage, lien.unite)!;
          return lien.type === 'DD' ? ajouter(borne, dureeJours, 'jours') : borne;
        })
        .filter((d): d is string => !!d)
        .sort();
      // La fin de la phase borne aussi les lignes qui ont des successeurs :
      // sans décalage, la contrainte d'un successeur lui est toujours
      // antérieure, mais un décalage (ou une liaison début à début) peut la
      // repousser au-delà et inventerait de la marge à une ligne qui, elle,
      // termine la phase.
      const finAuPlusTard = [finPhase, ...contraintes].sort()[0];

      ligne.margeTotale = ecart(ligne.dateFin, finAuPlusTard, 'jours');
      ligne.critique = ligne.margeTotale <= 0;
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
