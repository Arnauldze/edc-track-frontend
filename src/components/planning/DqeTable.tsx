"use client";

// ══════════════════════════════════════════════════════════════
// DEVIS QUANTITATIF ET ESTIMATIF
//
// Composant contrôlé : la page détient les lignes. Les montants, sous-totaux
// et la cascade fiscale sont calculés par lib/dqe.ts, le même moteur que le
// serveur.
//
// Le devis appartient au marché, donc à l'activité. Il se présente comme dans
// Excel : des séries de prix en lignes de titre, les prestations dessous, et
// au pied le total hors taxe, la TVA, l'impôt sur le revenu et le net à
// mandater — avec les taux modifiables, parce qu'ils changent.
// ══════════════════════════════════════════════════════════════

import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Folder, Plus, Receipt, Trash2, Upload, Wand2 } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import { SelecteurTaches, type TacheLiable } from "./SelecteurTaches";
import {
  UNITES_DQE,
  analyserDqe,
  apparierParNumero,
  coherenceDqe,
  decalerNiveau,
  montantLigne,
  niveauDe,
  nouvelIdentifiantDqe,
  nouvelleLigneDqe,
  sousTotal,
  totauxDqe,
  type ChampDqe,
  type Fiscalite,
  type LigneDqe,
} from "@/lib/dqe";
import { Button } from "@/components/ui/button";

const GRID = "grid-cols-[110px_minmax(200px,1fr)_88px_112px_140px_150px_minmax(120px,160px)_88px]";

const formatQuantite = (value: number | undefined) =>
  value === undefined ? "" : value.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

const parseNombre = (raw: string): number | undefined => {
  const value = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return isFinite(value) && value >= 0 ? value : undefined;
};

const formatMontant = (value: number) => Math.round(value).toLocaleString("fr-FR");

const formatTaux = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

interface Props {
  lignes: LigneDqe[];
  onChange: (lignes: LigneDqe[]) => void;
  /** Tâches d'exécution auxquelles les lignes du devis se relient. */
  taches: TacheLiable[];
  fiscalite: Fiscalite;
  onFiscalite: (fiscalite: Fiscalite) => void;
  readOnly: boolean;
  /** Contrôle d'enregistrement demandé : champs obligatoires vides en rouge. */
  controleDemande?: boolean;
  /** Action placée dans l'en-tête de la carte. */
  action?: ReactNode;
}

export function DqeTable({ lignes, onChange, taches, fiscalite, onFiscalite, readOnly, controleDemande = false, action }: Props) {
  const [showImportModal, setShowImportModal] = useState(false);
  /** Lignes écartées au dernier import, pour ne pas les escamoter. */
  const [ignorees, setIgnorees] = useState(0);

  const problemes = useMemo(() => analyserDqe(lignes, fiscalite), [lignes, fiscalite]);
  const totaux = useMemo(() => totauxDqe(lignes, fiscalite), [lignes, fiscalite]);
  const coherence = useMemo(() => coherenceDqe(lignes, taches), [lignes, taches]);

  const problemeDe = (index: number, champ: ChampDqe) =>
    problemes.find((p) => p.index === index && p.champ === champ)?.message;
  const messages = [...new Set(problemes.filter((p) => p.champ !== "fiscalite").map((p) => p.message))];
  const messagesFiscalite = problemes.filter((p) => p.champ === "fiscalite").map((p) => p.message);

  // ── Modifications ──

  const modifier = (index: number, patch: Partial<LigneDqe>) =>
    onChange(lignes.map((ligne, i) => (i === index ? { ...ligne, ...patch } : ligne)));

  const ajouter = (titre: boolean) => {
    const derniere = lignes[lignes.length - 1];
    // Une prestation se range sous la dernière série ouverte ; une série
    // nouvelle repart de la racine.
    const niveau = titre ? 0 : derniere ? (derniere.titre ? niveauDe(derniere) + 1 : niveauDe(derniere)) : 1;
    onChange([...lignes, { ...nouvelleLigneDqe(niveau, titre), id: nouvelIdentifiantDqe() }]);
  };

  const supprimer = (index: number) => {
    const ligne = lignes[index];
    // Supprimer une série emporte ce qu'elle couvre : la laisser derrière
    // ferait des prestations orphelines, indentées sous rien.
    let dernier = index;
    if (ligne?.titre) {
      const rang = niveauDe(ligne);
      while (dernier + 1 < lignes.length && niveauDe(lignes[dernier + 1]) > rang) dernier++;
    }
    onChange(lignes.filter((_, i) => i < index || i > dernier));
  };

  /**
   * Remplace le devis par celui du tableur importé.
   *
   * Un devis d'EDC a une feuille par série de prix : quand on importe tout le
   * classeur, chaque feuille ouvre donc une série, et ce qu'elle contient se
   * range dessous. Une ligne sans quantité ni prix est un titre — c'est ainsi
   * que les séries et sous-séries se présentent dans leurs fichiers.
   */
  const importer = (data: Record<string, unknown>[]) => {
    const texte = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
    const feuilles = new Set(data.map((row) => texte(row.__feuille)).filter(Boolean));
    const parFeuille = feuilles.size > 1;

    const importees: LigneDqe[] = [];
    let ouverte: string | undefined;
    let ecartees = 0;

    for (const row of data) {
      const feuille = texte(row.__feuille);
      if (parFeuille && feuille && feuille !== ouverte) {
        ouverte = feuille;
        importees.push({ id: nouvelIdentifiantDqe(), numero: feuille, designation: feuille, niveau: 0, titre: true });
      }

      const numero = texte(row.numero);
      const designation = texte(row.designation);
      if (!numero && !designation) continue;

      // Un devis se termine par ses totaux — « Total série 100 », « SOUS TOTAL
      // PRIX 501 » — qui n'ont pas de numéro de prix et n'ont rien à faire
      // dans le bordereau : l'appli les recalcule. L'un d'eux porte même un
      // montant, qui gonflerait le total s'il était repris.
      if (!numero) {
        ecartees++;
        continue;
      }

      const quantite = parseNombre(texte(row.quantite));
      const prixUnitaire = parseNombre(texte(row.prixUnitaire));
      const titre = quantite === undefined && prixUnitaire === undefined;
      const racine = parFeuille ? 1 : 0;

      importees.push({
        id: nouvelIdentifiantDqe(),
        numero,
        designation,
        niveau: titre ? racine : racine + 1,
        titre,
        unite: texte(row.unite) || undefined,
        quantite,
        prixUnitaire,
      });
    }

    onChange(importees);
    setIgnorees(ecartees);
    setShowImportModal(false);
  };

  // ── Rendu ──

  const cellule = "px-1.5 py-1.5 flex items-center gap-1 border-r border-b border-line min-w-0";
  const champ = (options: { erreur?: string; sourd?: boolean } = {}) =>
    [
      "w-full min-w-0 px-1.5 py-1 rounded text-[11px] border focus:outline-none focus:border-primary disabled:cursor-not-allowed",
      options.erreur ? "border-danger bg-danger-subtle" : "border-transparent hover:border-line",
      options.sourd ? "italic text-fg-subtle bg-inset" : "bg-transparent text-fg",
    ].join(" ");

  const prestations = lignes.filter((l) => !l.titre && (l.numero ?? "").trim()).length;
  const entetes = ["N° prix", "Désignation des prix", "Unité", "Quantité", "Prix unitaire", "Montant HT", "Tâches", ""];

  /** Rapprochement automatique : sur le numéro de prix, puis sur la désignation. */
  const rapprocher = () => onChange(apparierParNumero(lignes, taches));
  const arapprocher = taches.some((t) => t.id) && coherence.sansTache.length > 0;

  const manquant = (ligne: LigneDqe, champName: "numero" | "designation") =>
    controleDemande && !(ligne[champName] ?? "").trim() ? "Champ obligatoire" : undefined;

  return (
    <>
      <FileImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={importer} importType="dqe" />

      <section className="bg-surface rounded-lg border border-line overflow-hidden">
        <header className="px-4 py-2.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <Receipt size={16} /> Devis quantitatif et estimatif
            </h2>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Le bordereau du marché : séries de prix, quantités, prix unitaires et fiscalité.
            </p>
          </div>

          <dl className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              { label: "Prestations", value: String(prestations) },
              { label: "Total HT", value: totaux.totalHT ? `${formatMontant(totaux.totalHT)} FCFA` : "—" },
              { label: "Net à mandater", value: totaux.netAMandater ? `${formatMontant(totaux.netAMandater)} FCFA` : "—" },
            ].map((item) => (
              <div key={item.label} className="px-2 py-1 rounded-md border border-line bg-inset">
                <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">{item.label}</dt>
                <dd className="font-semibold">{item.value}</dd>
              </div>
            ))}
            {action}
          </dl>
        </header>

        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className={`grid ${GRID} bg-inset border-b border-line text-[10px] font-bold uppercase tracking-wide text-fg-subtle`}>
              {entetes.map((entete, i) => (
                <div key={i} className="px-1.5 py-2 border-r border-line last:border-r-0">
                  {entete}
                </div>
              ))}
            </div>

            {lignes.length === 0 && (
              <p className="px-4 py-6 text-center text-[12px] text-fg-muted">
                Aucune ligne. Importez le devis depuis Excel, ou ajoutez une série de prix.
              </p>
            )}

            {lignes.map((ligne, index) => {
              const rang = niveauDe(ligne);
              const montant = ligne.titre ? sousTotal(lignes, index) : montantLigne(ligne);
              return (
                <div
                  key={ligne.id ?? index}
                  className={`grid ${GRID} text-[11px] ${ligne.titre ? "bg-inset/60 font-semibold" : "hover:bg-inset/40"}`}
                >
                  <div className={cellule}>
                    <input
                      value={ligne.numero}
                      onChange={(e) => modifier(index, { numero: e.target.value })}
                      disabled={readOnly}
                      placeholder="101"
                      title={problemeDe(index, "numero") ?? manquant(ligne, "numero")}
                      className={`${champ({ erreur: problemeDe(index, "numero") ?? manquant(ligne, "numero") })} text-center font-bold`}
                    />
                  </div>

                  <div className={cellule} style={{ paddingLeft: 6 + rang * 16 }}>
                    {ligne.titre && <Folder size={11} className="shrink-0 text-fg-subtle" />}
                    <input
                      value={ligne.designation}
                      onChange={(e) => modifier(index, { designation: e.target.value })}
                      disabled={readOnly}
                      placeholder={ligne.titre ? "Série de prix…" : "Désignation…"}
                      title={problemeDe(index, "designation") ?? manquant(ligne, "designation")}
                      className={champ({ erreur: problemeDe(index, "designation") ?? manquant(ligne, "designation") })}
                    />
                    {!readOnly && (
                      <span className="flex shrink-0">
                        <button
                          type="button"
                          onClick={() => onChange(decalerNiveau(lignes, index, -1))}
                          className="p-0.5 rounded text-fg-subtle hover:bg-inset hover:text-fg disabled:opacity-30"
                          disabled={rang === 0}
                          title="Remonter d'un rang"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(decalerNiveau(lignes, index, 1))}
                          className="p-0.5 rounded text-fg-subtle hover:bg-inset hover:text-fg"
                          title="Ranger sous la ligne précédente"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </span>
                    )}
                  </div>

                  {/* Une ligne de titre ne porte ni unité, ni quantité, ni prix :
                      son montant est la somme de ce qu'elle couvre. */}
                  <div className={cellule}>
                    {!ligne.titre && (
                      <>
                        <input
                          list="unites-dqe"
                          value={ligne.unite ?? ""}
                          onChange={(e) => modifier(index, { unite: e.target.value || undefined })}
                          disabled={readOnly}
                          placeholder="m³"
                          className={`${champ()} text-center`}
                        />
                        <datalist id="unites-dqe">
                          {UNITES_DQE.map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>

                  <div className={cellule}>
                    {!ligne.titre && (
                      <input
                        inputMode="decimal"
                        value={formatQuantite(ligne.quantite)}
                        onChange={(e) => modifier(index, { quantite: parseNombre(e.target.value) })}
                        disabled={readOnly}
                        placeholder="0"
                        title={problemeDe(index, "quantite")}
                        className={`${champ({ erreur: problemeDe(index, "quantite") })} text-right`}
                      />
                    )}
                  </div>

                  <div className={cellule}>
                    {!ligne.titre && (
                      <input
                        inputMode="decimal"
                        value={formatQuantite(ligne.prixUnitaire)}
                        onChange={(e) => modifier(index, { prixUnitaire: parseNombre(e.target.value) })}
                        disabled={readOnly}
                        placeholder="0"
                        title={problemeDe(index, "prixUnitaire")}
                        className={`${champ({ erreur: problemeDe(index, "prixUnitaire") })} text-right`}
                      />
                    )}
                  </div>

                  <div className={`${cellule} justify-end pr-2 tabular-nums ${ligne.titre ? "text-fg" : "text-fg-muted"}`}>
                    {montant ? formatMontant(montant) : "—"}
                  </div>

                  {/* Une série ne se réalise pas : ce sont ses prestations qui
                      se relient au planning. */}
                  <div className={cellule}>
                    {!ligne.titre && (
                      <SelecteurTaches
                        taches={taches}
                        valeur={ligne.tacheIds ?? []}
                        onChange={(ids) => modifier(index, { tacheIds: ids.length ? ids : undefined })}
                        disabled={readOnly}
                      />
                    )}
                  </div>

                  <div className={`${cellule} justify-center`}>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => supprimer(index)}
                        className="p-1 rounded text-fg-subtle hover:bg-danger-subtle hover:text-danger"
                        title={ligne.titre ? "Supprimer la série et les lignes qu'elle couvre" : "Supprimer la ligne"}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => ajouter(false)}>
                <Plus size={13} /> Ligne de prix
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => ajouter(true)}>
                <Folder size={13} /> Série de prix
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                <Upload size={13} /> Importer depuis Excel
              </Button>
              {arapprocher && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={rapprocher}
                  title="Relie chaque ligne encore libre à la tâche de même numéro, ou de même désignation."
                >
                  <Wand2 size={13} /> Rapprocher du planning
                </Button>
              )}
            </div>
          )}

          {ignorees > 0 && (
            <p className="text-[11px] text-fg-subtle">
              {ignorees} ligne(s) sans numéro de prix écartée(s) à l&apos;import — les totaux et sous-totaux du
              fichier, que l&apos;application recalcule.
            </p>
          )}

          {messages.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-[11px] text-danger">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertCircle size={13} /> À corriger avant d&apos;enregistrer
              </p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Cohérence avec le planning ──
              Le devis et le planning doivent décrire les mêmes travaux. EDC le
              garantit en principe à la source, mais leur planning est parfois
              reconstitué après coup : autant le vérifier. */}
          {taches.some((t) => t.id) && (coherence.sansTache.length > 0 || coherence.sansLigne.length > 0) && (
            <div className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-[11px] text-warning">
              <p className="font-semibold">Devis et planning ne se recouvrent pas entièrement</p>
              <ul className="mt-1 space-y-0.5">
                {coherence.sansTache.length > 0 && (
                  <li>
                    <strong>{coherence.sansTache.length}</strong> ligne(s) du devis qu&apos;aucune tâche ne réalise :{" "}
                    <span className="opacity-80">
                      {coherence.sansTache.slice(0, 8).map((l) => l.numero).join(", ")}
                      {coherence.sansTache.length > 8 ? "…" : ""}
                    </span>
                  </li>
                )}
                {coherence.sansLigne.length > 0 && (
                  <li>
                    <strong>{coherence.sansLigne.length}</strong> tâche(s) hors devis :{" "}
                    <span className="opacity-80">
                      {coherence.sansLigne.slice(0, 8).map((t) => t.numero).join(", ")}
                      {coherence.sansLigne.length > 8 ? "…" : ""}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* ── Cascade fiscale ── */}
          <div className="rounded-md border border-line bg-inset/50 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Récapitulatif</h3>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1.5">
                  <span className="text-fg-muted">TVA</span>
                  <input
                    inputMode="decimal"
                    value={formatTaux(fiscalite.tva)}
                    onChange={(e) => onFiscalite({ ...fiscalite, tva: parseNombre(e.target.value) ?? 0 })}
                    disabled={readOnly}
                    className="w-16 rounded border border-line bg-surface px-1.5 py-1 text-right focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                  <span className="text-fg-muted">%</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-fg-muted" title="Impôt sur le revenu : 2,2 % ou 5,5 % selon le type d'entreprise.">
                    Impôt sur le revenu
                  </span>
                  <input
                    inputMode="decimal"
                    value={formatTaux(fiscalite.ir)}
                    onChange={(e) => onFiscalite({ ...fiscalite, ir: parseNombre(e.target.value) ?? 0 })}
                    disabled={readOnly}
                    className="w-16 rounded border border-line bg-surface px-1.5 py-1 text-right focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                  <span className="text-fg-muted">%</span>
                </label>
              </div>
            </div>

            {messagesFiscalite.length > 0 && (
              <p className="mt-1.5 text-[11px] text-danger">{messagesFiscalite.join(" ")}</p>
            )}

            <dl className="mt-2.5 space-y-1 text-[12px]">
              {[
                { label: "Total hors taxe", value: totaux.totalHT },
                { label: `TVA (${formatTaux(fiscalite.tva)} %)`, value: totaux.montantTva },
                { label: "Total toutes taxes comprises", value: totaux.totalTTC, fort: true },
                { label: `Impôt sur le revenu (${formatTaux(fiscalite.ir)} %)`, value: -totaux.montantIr },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <dt className={item.fort ? "font-semibold text-fg" : "text-fg-muted"}>{item.label}</dt>
                  <dd className={`tabular-nums ${item.fort ? "font-semibold text-fg" : "text-fg-muted"}`}>
                    {formatMontant(item.value)} FCFA
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-line pt-1.5">
                <dt className="font-bold text-fg">Net à mandater</dt>
                <dd className="font-bold text-fg tabular-nums">{formatMontant(totaux.netAMandater)} FCFA</dd>
              </div>
            </dl>

            <p className="mt-2 text-[10px] text-fg-subtle">
              Le net à mandater est ce que l&apos;entreprise perçoit une fois retenu ce que l&apos;État récupère sur son
              marché.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
