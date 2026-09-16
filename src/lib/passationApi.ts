// Lignes du plan de passation des marchés (PPM) entre le tableau et l'API.
// Le tableau manipule du texte (champs de saisie) ; l'API attend des dates et
// des nombres, et refuse les champs vides ou inconnus.

import type { LignePassation, LignePassationApi } from "@/services/api/planningService";

/** Étapes datées d'un marché, dans l'ordre du modèle PPM d'EDC. */
export const DATES_PASSATION = [
  "saisineCIPM",
  "examenDAOCIPM",
  "nonObjectionBF1",
  "lancementAO",
  "depouillementOffres",
  "rapportAnalyseSCA",
  "examenRapportCIPM",
  "nonObjectionBF2",
  "ouvertureOF",
  "rapportAnalyseOF",
  "propositionAttributionCIPM",
  "nonObjectionBF3",
  "publicationResultats",
  "souscriptionMarche",
  "saisineCIPM2",
  "examenMarcheCIPM",
  "nonObjectionBF4",
  "signatureMarche",
  "notificationMarche",
  "enregistrementMarche",
  "osDeDemarrage",
  "dateReceptionProvisoire",
  "dateReceptionDefinitive",
] as const satisfies readonly (keyof LignePassation)[];

/** Délais exprimés en jours. */
export const NOMBRES_PASSATION = [
  "montantPrevisionnel",
  "delaiGlobalPassation",
  "delaiGlobalExecution",
  "periodeGarantie",
] as const satisfies readonly (keyof LignePassation)[];

const TEXTES_PASSATION = [
  "designation",
  "typeAO",
  "typePrestation",
  "sourceFinancement",
  "imputationBudgetaire",
  "visaCA",
] as const satisfies readonly (keyof LignePassation)[];

/** Jour d'une date, au format AAAA-MM-JJ attendu par les champs de saisie. */
function jour(valeur: string | Date | undefined): string {
  if (!valeur) return "";
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Ligne prête pour l'API : les étapes non renseignées sont omises. */
export function lignePassationPourApi(ligne: LignePassation, index: number): LignePassationApi {
  const envoi: LignePassationApi = { numero: ligne.numero?.trim() || String(index + 1) };

  for (const champ of TEXTES_PASSATION) {
    const valeur = ligne[champ]?.trim();
    if (valeur) envoi[champ] = valeur;
  }
  for (const champ of DATES_PASSATION) {
    const valeur = jour(ligne[champ]);
    if (valeur) envoi[champ] = valeur;
  }
  for (const champ of NOMBRES_PASSATION) {
    const nombre = Number(String(ligne[champ] ?? "").replace(",", "."));
    if (Number.isFinite(nombre) && String(ligne[champ] ?? "").trim() !== "") envoi[champ] = nombre;
  }
  return envoi;
}

/** Ligne renvoyée par l'API, remise en texte pour le tableau. */
export function lignePassationDepuisApi(ligne: LignePassationApi): LignePassation {
  const saisie = { numero: ligne.numero ?? "" } as LignePassation;

  for (const champ of TEXTES_PASSATION) saisie[champ] = ligne[champ] ?? "";
  for (const champ of DATES_PASSATION) saisie[champ] = jour(ligne[champ]);
  for (const champ of NOMBRES_PASSATION) saisie[champ] = ligne[champ] === undefined ? "" : String(ligne[champ]);

  return saisie;
}

/** Une ligne vide ne vaut pas la peine d'être enregistrée. */
export function lignePassationRenseignee(ligne: LignePassation): boolean {
  return Object.entries(ligne).some(([champ, valeur]) => champ !== "numero" && String(valeur ?? "").trim() !== "");
}
