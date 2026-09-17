// Vérifie le contraste des jetons de couleur, thème clair et thème sombre.
//
// Le design system pose des encres SUR des fonds pleins (--on-success sur
// --success, etc.). En thème sombre les teintes d'état s'éclaircissent : une
// encre blanche qui convenait en clair y devient illisible. Ce script relit
// globals.css et rejoue tous les appariements, pour qu'un ajustement de jeton
// ne puisse pas casser silencieusement la lisibilité.
//
//   node scripts/audit-contraste.mjs
//
// Sortie non nulle si un appariement passe sous sa cible WCAG.

import { readFileSync } from "node:fs";

const CSS = new URL("../src/app/globals.css", import.meta.url);
const source = readFileSync(CSS, "utf8");

// Le fichier déclare le thème clair, puis le thème sombre.
const coupure = source.indexOf("--bg-root: #0C1220");
if (coupure === -1) {
  console.error("Bloc du thème sombre introuvable dans globals.css.");
  process.exit(2);
}

const jetons = (bloc) =>
  Object.fromEntries(
    [...bloc.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );

const THEMES = {
  clair: jetons(source.slice(0, coupure)),
  sombre: jetons(source.slice(coupure)),
};

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Composite `avant` à `alpha` sur `arriere` : les utilitaires /10, /20. */
const melange = (avant, arriere, alpha) => {
  const c = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  const canaux = [1, 3, 5].map((i) =>
    Math.round(c(avant, i) * alpha + c(arriere, i) * (1 - alpha)),
  );
  return `#${canaux.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Fond plein → encre posée dessus. */
const ENCRES = {
  primary: "on-primary",
  accent: "on-accent",
  success: "on-success",
  warning: "on-warning",
  danger: "on-danger",
};
/** Rôles dont la couleur de texte n'est pas la couleur de remplissage. */
const TEXTES = { primary: "primary-text", accent: "accent-text" };
const CATEGORIES = ["cat-violet", "cat-indigo", "cat-cyan", "cat-teal", "cat-rose"];

const TEXTE = 4.5; // WCAG AA, texte courant
const OBJET = 3.0; // WCAG AA, élément non textuel (bordure, pastille d'état)

function appariements(T) {
  const paires = [];
  for (const [role, encre] of Object.entries(ENCRES)) {
    for (const fond of [role, `${role}-hover`]) {
      paires.push([`encre ${encre} sur ${fond}`, T[encre], T[fond], TEXTE]);
    }
    // primary et accent ont un jeton de texte distinct du remplissage
    // (--primary-text / --accent-text) : c'est lui qui va sur le fond teinté.
    const texte = TEXTES[role] ?? role;
    paires.push([`texte ${texte} sur ${role}-subtle`, T[texte], T[`${role}-subtle`], TEXTE]);
    paires.push([`texte ${texte} sur surface`, T[texte], T["bg-surface"], TEXTE]);
    paires.push([`${role} sur surface`, T[role], T["bg-surface"], OBJET]);
  }
  for (const cat of CATEGORIES) {
    paires.push([`encre on-cat sur ${cat}`, T["on-cat"], T[cat], TEXTE]);
    paires.push([`texte ${cat} sur ${cat}/10`, T[cat], melange(T[cat], T["bg-surface"], 0.1), TEXTE]);
    paires.push([`${cat} sur surface`, T[cat], T["bg-surface"], OBJET]);
  }
  // Pastille de repli neutre des rôles (lib/rbacStore.ts).
  paires.push(["repli fg-inverted sur fg-muted", T["text-inverted"], T["text-secondary"], TEXTE]);
  return paires;
}

// Écart connu et assumé, à revoir avec la marque plutôt qu'en douce ici :
// l'orange EDC #E3861C n'atteint que 2.73:1 sur une surface claire, alors que
// WCAG 1.4.11 demande 3:1 pour un repère non textuel (pastille « modification
// non enregistrée », badge de notification). Le passer à #D97B14 suffirait
// (3.09:1) ; c'est une décision de charte, pas de code.
const TOLERES = new Set(["clair/accent sur surface"]);

let echecs = 0;
for (const [nom, T] of Object.entries(THEMES)) {
  console.log(`\n=== thème ${nom} ===`);
  for (const [libelle, encre, fond, cible] of appariements(T)) {
    if (!encre || !fond) {
      console.log(`  ? ${libelle.padEnd(40)} jeton manquant`);
      echecs++;
      continue;
    }
    const v = contraste(encre, fond);
    const ok = v >= cible;
    const tolere = !ok && TOLERES.has(`${nom}/${libelle}`);
    if (!ok && !tolere) echecs++;
    const marque = ok ? " " : tolere ? "~" : "!";
    console.log(`  ${marque} ${libelle.padEnd(40)} ${v.toFixed(2)}:1 (cible ${cible})`);
  }
}

console.log(`\n${echecs === 0 ? "Aucun échec." : `${echecs} appariement(s) sous la cible.`}`);
process.exit(echecs === 0 ? 0 : 1);
