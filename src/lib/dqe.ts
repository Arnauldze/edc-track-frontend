// ══════════════════════════════════════════════════════════════
// DEVIS QUANTITATIF ET ESTIMATIF (DQE)
//
// Fichier identique dans le frontend (lib/dqe.ts) et le backend
// (modules/planning/dqe.ts) : le navigateur calcule pendant la saisie, le
// serveur recalcule à l'enregistrement et fait foi. Même règle que pour le
// calendrier des livrables — voir livrableSchedule.ts.
//
// Le DQE appartient au MARCHÉ, donc à l'activité : c'est le bordereau de
// l'entreprise attributaire, et le taux d'impôt sur le revenu dépend d'elle.
//
// Un devis de travaux se présente toujours avec les six mêmes colonnes :
//   numéro de prix  le matricule de la ligne — 101, 102.A, 601-1…
//   désignation     l'intitulé, qui doit correspondre à celui du planning
//   unité           Forfait, Provision, m², m3, ml, u, m3xkm…
//   quantité        issue des études préalables
//   prix unitaire   issu de l'expérience des projets similaires
//   prix total      quantité × prix unitaire
//
// Les lignes sont regroupées en SÉRIES DE PRIX — un groupe de tâches d'un même
// domaine d'expertise (série 300 : charpente, ouverture, plafond) — parfois en
// sous-séries, parfois pas du tout pour un chantier simple. La hiérarchie est
// donc portée par un niveau explicite plutôt que devinée du numéro : une ligne
// de titre ne porte ni quantité ni prix, son montant est la somme de ce
// qu'elle couvre.
//
// Au pied du devis vient la cascade fiscale, dont les taux sont paramétrables
// parce qu'ils changent — la TVA par décision de l'État, l'impôt sur le revenu
// selon le type d'entreprise.
// ══════════════════════════════════════════════════════════════

export interface LigneDqe {
  /**
   * Identifiant interne, stable et jamais affiché. Le numéro de prix est déjà
   * un matricule stable, mais il se corrige ; ce qui doit survivre à une
   * correction — le lien vers les tâches, et demain le suivi — s'accroche à
   * cet identifiant.
   */
  id?: string;
  /** Numéro de prix : 101, 102.A, 601-1… */
  numero: string;
  designation: string;
  /** Profondeur : 0 pour une série, puis sous-séries et prestations. */
  niveau?: number;
  /** Ligne de regroupement : ni quantité ni prix, son montant est une somme. */
  titre?: boolean;
  unite?: string;
  quantite?: number;
  prixUnitaire?: number;
  /**
   * Tâches d'exécution qui réalisent cette ligne, par identifiant interne.
   * Plusieurs, parce qu'une même prestation se réalise souvent par zone ou
   * par bâtiment : 96 000 m³ de remblais ne sont pas une seule tâche.
   */
  tacheIds?: string[];
}

export interface Fiscalite {
  /** Taxe sur la valeur ajoutée, en pourcentage. */
  tva: number;
  /** Impôt sur le revenu retenu à la source, en pourcentage. */
  ir: number;
}

/** Taux en vigueur au Cameroun ; l'impôt sur le revenu vaut 5,5 % pour certaines entreprises. */
export const FISCALITE_PAR_DEFAUT: Fiscalite = { tva: 19.25, ir: 2.2 };

/** Unités rencontrées dans les devis d'EDC, proposées à la saisie. */
export const UNITES_DQE = ['Forfait', 'Provision', 'u', 'ml', 'm²', 'm3', 'm3xkm', 'kg', 't', 'j', 'mois', 'ens'];

export interface TotauxDqe {
  /** Somme des prestations ; les lignes de titre ne comptent pas deux fois. */
  totalHT: number;
  montantTva: number;
  totalTTC: number;
  montantIr: number;
  /** Ce que l'entreprise perçoit une fois l'impôt sur le revenu retenu. */
  netAMandater: number;
}

export type ChampDqe = 'numero' | 'designation' | 'unite' | 'quantite' | 'prixUnitaire' | 'fiscalite';

export interface ProblemeDqe {
  numero?: string;
  index?: number;
  champ?: ChampDqe;
  message: string;
}

// ── Identifiants ──
// Repris de livrableSchedule.ts plutôt qu'importé : les deux fichiers partagés
// doivent rester lisibles et recopiables tels quels d'un dépôt à l'autre, et
// leurs chemins d'import diffèrent entre le frontend et le backend.

const HEXA = () => Math.floor(Math.random() * 16).toString(16);

/** Identifiant de ligne, unique sans coordination avec le serveur. */
export function nouvelIdentifiantDqe(): string {
  const aleatoire = Array.from({ length: 8 }, HEXA).join('');
  const horloge = Date.now().toString(36).slice(-4);
  return `d-${aleatoire}${horloge}`;
}

// ── Montants ──

const round2 = (value: number) => Math.round(value * 100) / 100;

const nombre = (value: number | undefined): number =>
  typeof value === 'number' && isFinite(value) ? value : 0;

/** Prix total d'une ligne : quantité × prix unitaire. Nul pour une ligne de titre. */
export function montantLigne(ligne: LigneDqe): number {
  if (ligne.titre) return 0;
  return round2(nombre(ligne.quantite) * nombre(ligne.prixUnitaire));
}

/** Niveau d'une ligne, les lignes anciennes étant toutes au même rang. */
export const niveauDe = (ligne: LigneDqe): number => Math.max(0, Math.trunc(nombre(ligne.niveau)));

/**
 * Montant d'une ligne de titre : la somme des prestations qu'elle couvre,
 * c'est-à-dire les lignes qui la suivent tant qu'elles sont plus profondes.
 * Pour une prestation, c'est son propre montant.
 */
export function sousTotal(lignes: LigneDqe[], index: number): number {
  const ligne = lignes[index];
  if (!ligne) return 0;
  if (!ligne.titre) return montantLigne(ligne);

  const rang = niveauDe(ligne);
  let somme = 0;
  for (let i = index + 1; i < lignes.length && niveauDe(lignes[i]) > rang; i++) {
    somme += montantLigne(lignes[i]);
  }
  return round2(somme);
}

/** Quantité cumulée d'une ligne de titre n'a pas de sens : les unités diffèrent. */
export function totauxDqe(lignes: LigneDqe[], fiscalite: Fiscalite = FISCALITE_PAR_DEFAUT): TotauxDqe {
  const totalHT = round2(lignes.reduce((somme, ligne) => somme + montantLigne(ligne), 0));
  const montantTva = round2((totalHT * nombre(fiscalite.tva)) / 100);
  const montantIr = round2((totalHT * nombre(fiscalite.ir)) / 100);
  return {
    totalHT,
    montantTva,
    totalTTC: round2(totalHT + montantTva),
    montantIr,
    // Ce que l'entreprise perçoit, une fois retenu ce que l'État récupère sur
    // son marché. À confirmer sur un décompte réel : la règle a été donnée de
    // mémoire en réunion.
    netAMandater: round2(totalHT - montantIr),
  };
}

/** Fiscalité lue d'un enregistrement, où elle peut manquer ou être incomplète. */
export function normaliserFiscalite(valeur: Partial<Fiscalite> | undefined | null): Fiscalite {
  const taux = (v: unknown, defaut: number) =>
    typeof v === 'number' && isFinite(v) && v >= 0 && v <= 100 ? v : defaut;
  return {
    tva: taux(valeur?.tva, FISCALITE_PAR_DEFAUT.tva),
    ir: taux(valeur?.ir, FISCALITE_PAR_DEFAUT.ir),
  };
}

// ── Contrôles ──

/**
 * Problèmes qui empêchent d'enregistrer. Une ligne incomplète est tolérée tant
 * qu'elle est vide : on ne souligne pas en rouge une ligne qu'on vient
 * d'ajouter. Ce qui est refusé, c'est ce qui rend le devis faux.
 */
export function analyserDqe(lignes: LigneDqe[], fiscalite: Fiscalite = FISCALITE_PAR_DEFAUT): ProblemeDqe[] {
  const problemes: ProblemeDqe[] = [];
  const vus = new Map<string, number>();

  lignes.forEach((ligne, index) => {
    const numero = (ligne.numero ?? '').trim();
    const designation = (ligne.designation ?? '').trim();
    const vide = !numero && !designation && !ligne.quantite && !ligne.prixUnitaire;
    if (vide) return;

    if (!numero) {
      problemes.push({ index, champ: 'numero', message: `Ligne ${index + 1} : numéro de prix manquant.` });
    } else if (vus.has(numero)) {
      problemes.push({ numero, index, champ: 'numero', message: `Le numéro de prix ${numero} est utilisé deux fois.` });
    } else {
      vus.set(numero, index);
    }

    if (!designation) {
      problemes.push({ numero, index, champ: 'designation', message: `${numero || `Ligne ${index + 1}`} : désignation manquante.` });
    }

    if (ligne.titre) {
      if (ligne.quantite || ligne.prixUnitaire) {
        problemes.push({
          numero,
          index,
          champ: 'quantite',
          message: `${numero} est une ligne de titre : son montant est la somme des lignes qu'elle couvre, elle ne porte ni quantité ni prix.`,
        });
      }
      return;
    }

    if (ligne.quantite !== undefined && ligne.quantite < 0) {
      problemes.push({ numero, index, champ: 'quantite', message: `${numero} : la quantité ne peut pas être négative.` });
    }
    if (ligne.prixUnitaire !== undefined && ligne.prixUnitaire < 0) {
      problemes.push({ numero, index, champ: 'prixUnitaire', message: `${numero} : le prix unitaire ne peut pas être négatif.` });
    }
    // Une valeur NULLE est une information — une prestation chiffrée mais non
    // retenue dans l'offre finale en porte une. Seule l'absence est un oubli.
    if (ligne.quantite !== undefined && ligne.prixUnitaire === undefined) {
      problemes.push({ numero, index, champ: 'prixUnitaire', message: `${numero} : quantité saisie sans prix unitaire.` });
    }
    if (ligne.prixUnitaire !== undefined && ligne.quantite === undefined) {
      problemes.push({ numero, index, champ: 'quantite', message: `${numero} : prix unitaire saisi sans quantité.` });
    }
  });

  const horsBornes = (taux: number) => !isFinite(taux) || taux < 0 || taux > 100;
  if (horsBornes(fiscalite.tva)) {
    problemes.push({ champ: 'fiscalite', message: 'Le taux de TVA doit être compris entre 0 et 100 %.' });
  }
  if (horsBornes(fiscalite.ir)) {
    problemes.push({ champ: 'fiscalite', message: "Le taux d'impôt sur le revenu doit être compris entre 0 et 100 %." });
  }

  return problemes;
}

// ── Cohérence avec le planning ──

export interface CoherenceDqe {
  /** Lignes du devis qu'aucune tâche ne réalise. */
  sansTache: LigneDqe[];
  /** Tâches qui ne réalisent aucune ligne du devis. */
  sansLigne: Array<{ id?: string; numero: string; designation?: string }>;
}

/**
 * Le devis et le planning doivent décrire les mêmes travaux : chaque ligne de
 * prix se retrouve dans le planning, et réciproquement. EDC le garantit en
 * principe à la source, mais leur planning est parfois reconstitué après coup :
 * autant le vérifier plutôt que de le supposer.
 *
 * Les lignes de titre sont ignorées : elles ne se réalisent pas, elles
 * regroupent.
 */
export function coherenceDqe<T extends { id?: string; numero: string; designation?: string }>(
  lignes: LigneDqe[],
  taches: T[],
): CoherenceDqe {
  const prestations = lignes.filter((l) => !l.titre && (l.numero ?? '').trim());
  const reliees = new Set<string>();
  for (const ligne of prestations) {
    for (const tacheId of ligne.tacheIds ?? []) reliees.add(tacheId);
  }

  return {
    sansTache: prestations.filter((l) => !(l.tacheIds ?? []).length),
    sansLigne: taches.filter((t) => !t.id || !reliees.has(t.id)),
  };
}

/**
 * Apparie devis et planning sur le numéro de prix, puis sur la désignation.
 * C'est la reprise automatique proposée à l'import, quand les deux fichiers
 * ont été montés ensemble — le cas nominal chez EDC.
 */
export function apparierParNumero<T extends { id?: string; numero: string; designation?: string }>(
  lignes: LigneDqe[],
  taches: T[],
): LigneDqe[] {
  const cle = (texte: string | undefined) => (texte ?? '').trim().toLowerCase();
  const parNumero = new Map<string, T[]>();
  const parDesignation = new Map<string, T[]>();
  for (const tache of taches) {
    if (!tache.id) continue;
    const ajouter = (carte: Map<string, T[]>, valeur: string) => {
      if (!valeur) return;
      const liste = carte.get(valeur);
      if (liste) liste.push(tache);
      else carte.set(valeur, [tache]);
    };
    ajouter(parNumero, cle(tache.numero));
    ajouter(parDesignation, cle(tache.designation));
  }

  return lignes.map((ligne) => {
    if (ligne.titre || (ligne.tacheIds ?? []).length) return ligne;
    const trouvees = parNumero.get(cle(ligne.numero)) ?? parDesignation.get(cle(ligne.designation));
    if (!trouvees?.length) return ligne;
    return { ...ligne, tacheIds: trouvees.map((t) => t.id!).filter(Boolean) };
  });
}

// ── Structure ──

/** Ligne vierge, au même niveau que celle qui précède. */
export function nouvelleLigneDqe(niveau = 1, titre = false): LigneDqe {
  return { id: nouvelIdentifiantDqe(), numero: '', designation: '', niveau, titre };
}

/**
 * Décale une ligne d'un rang, et avec elle tout ce qu'elle couvre si c'est un
 * titre : sans cela, indenter une série détacherait ses prestations.
 */
export function decalerNiveau(lignes: LigneDqe[], index: number, sens: 1 | -1): LigneDqe[] {
  const ligne = lignes[index];
  if (!ligne) return lignes;

  const rang = niveauDe(ligne);
  if (sens === -1 && rang === 0) return lignes;
  // Une ligne ne peut pas s'enfoncer de plus d'un rang sous celle qui la
  // précède, sinon la hiérarchie devient illisible.
  if (sens === 1 && index > 0 && rang > niveauDe(lignes[index - 1])) return lignes;

  let dernier = index;
  if (ligne.titre) {
    while (dernier + 1 < lignes.length && niveauDe(lignes[dernier + 1]) > rang) dernier++;
  }

  return lignes.map((l, i) =>
    i >= index && i <= dernier ? { ...l, niveau: Math.max(0, niveauDe(l) + sens) } : l,
  );
}
