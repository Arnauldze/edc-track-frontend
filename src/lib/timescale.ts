// ══════════════════════════════════════════════════════════════
// ÉCHELLE DE TEMPS DU DIAGRAMME DE GANTT
//
// Comme MS Project, l'utilisateur choisit le niveau de zoom. Chaque échelle
// fixe une largeur par jour et deux bandeaux d'en-tête : un bandeau
// supérieur (période large) et un bandeau inférieur (graduation).
//
//   Échelle      px/jour   bandeau supérieur   graduation
//   jours          28      semaine             jour (lettre + numéro)
//   semaines        8      mois                semaine (S36)
//   mois            3      année               mois
//   trimestres      1      année               trimestre (T1)
//   années        0.3      décennie            année
//
// Fonctions pures : les dates sont des minuits locaux.
// ══════════════════════════════════════════════════════════════

export type TimeScale = "jours" | "semaines" | "mois" | "trimestres" | "annees";

type Unit = "day" | "week" | "month" | "quarter" | "year" | "decade";

interface ScaleDef {
  id: TimeScale;
  label: string;
  pxPerDay: number;
  top: Unit;
  bottom: Unit;
  /** Marge laissée avant et après les données. */
  padding: { unit: Unit; count: number };
}

export const TIME_SCALES: ScaleDef[] = [
  { id: "jours", label: "Jours", pxPerDay: 28, top: "week", bottom: "day", padding: { unit: "week", count: 1 } },
  { id: "semaines", label: "Semaines", pxPerDay: 8, top: "month", bottom: "week", padding: { unit: "week", count: 2 } },
  { id: "mois", label: "Mois", pxPerDay: 3, top: "year", bottom: "month", padding: { unit: "month", count: 1 } },
  { id: "trimestres", label: "Trimestres", pxPerDay: 1, top: "year", bottom: "quarter", padding: { unit: "quarter", count: 1 } },
  { id: "annees", label: "Années", pxPerDay: 0.3, top: "decade", bottom: "year", padding: { unit: "year", count: 1 } },
];

export const scaleDef = (scale: TimeScale) => TIME_SCALES.find((s) => s.id === scale)!;

const DAY_MS = 86_400_000;
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Nombre de jours entre deux dates, insensible aux changements d'heure. */
export const daysBetween = (from: Date, to: Date) => Math.round((midnight(to).getTime() - midnight(from).getTime()) / DAY_MS);

export function startOf(date: Date, unit: Unit): Date {
  const d = midnight(date);
  switch (unit) {
    case "day":
      return d;
    case "week": {
      const offset = (d.getDay() + 6) % 7; // semaine commençant le lundi
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
    }
    case "month":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "quarter":
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    case "year":
      return new Date(d.getFullYear(), 0, 1);
    case "decade":
      return new Date(Math.floor(d.getFullYear() / 10) * 10, 0, 1);
  }
}

export function add(date: Date, unit: Unit, count: number): Date {
  const d = midnight(date);
  switch (unit) {
    case "day":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + count);
    case "week":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * count);
    case "month":
      return new Date(d.getFullYear(), d.getMonth() + count, d.getDate());
    case "quarter":
      return new Date(d.getFullYear(), d.getMonth() + 3 * count, d.getDate());
    case "year":
      return new Date(d.getFullYear() + count, d.getMonth(), d.getDate());
    case "decade":
      return new Date(d.getFullYear() + 10 * count, d.getMonth(), d.getDate());
  }
}

/** Numéro de semaine ISO 8601 (la semaine 1 contient le premier jeudi de l'année). */
export function isoWeek(date: Date): number {
  const d = midnight(date);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round((daysBetween(firstThursday, thursday) - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

const fullDate = (d: Date) => `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;

export interface HeaderCell {
  key: string;
  left: number;
  width: number;
  label: string;
  /** Seconde ligne (numéro du jour sous sa lettre). */
  sub?: string;
  /** Libellé complet, en infobulle. */
  title: string;
  weekend?: boolean;
}

function labelOf(start: Date, unit: Unit, width: number): Pick<HeaderCell, "label" | "sub" | "title" | "weekend"> {
  const end = add(start, unit, 1);
  const last = add(end, "day", -1);
  switch (unit) {
    case "day":
      return {
        label: DAY_LETTERS[start.getDay()],
        sub: String(start.getDate()),
        title: `${DAY_NAMES[start.getDay()]} ${fullDate(start)}`,
        weekend: start.getDay() === 0 || start.getDay() === 6,
      };
    case "week":
      return width >= 150
        ? { label: `Semaine ${isoWeek(start)} · ${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`, title: `Semaine ${isoWeek(start)}, du ${fullDate(start)} au ${fullDate(last)}` }
        : { label: `S${isoWeek(start)}`, title: `Semaine ${isoWeek(start)}, du ${fullDate(start)} au ${fullDate(last)}` };
    case "month":
      return {
        label: width >= 110 ? `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}` : MONTHS_SHORT[start.getMonth()],
        title: `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`,
      };
    case "quarter": {
      const q = Math.floor(start.getMonth() / 3) + 1;
      return { label: `T${q}`, title: `${q === 1 ? "1er" : `${q}e`} trimestre ${start.getFullYear()}` };
    }
    case "year":
      return { label: String(start.getFullYear()), title: `Année ${start.getFullYear()}` };
    case "decade":
      return { label: `${start.getFullYear()} – ${start.getFullYear() + 9}`, title: `Années ${start.getFullYear()} à ${start.getFullYear() + 9}` };
  }
}

export interface Timeline {
  scale: TimeScale;
  start: Date;
  end: Date;
  pxPerDay: number;
  width: number;
  top: HeaderCell[];
  bottom: HeaderCell[];
  /** Position de la date du jour, ou null hors de la période affichée. */
  todayX: number | null;
}

function cells(start: Date, end: Date, unit: Unit, pxPerDay: number): HeaderCell[] {
  const result: HeaderCell[] = [];
  for (let cursor = startOf(start, unit); cursor < end; cursor = add(cursor, unit, 1)) {
    const from = cursor < start ? start : cursor;
    const nextStart = add(cursor, unit, 1);
    const to = nextStart > end ? end : nextStart;
    const left = daysBetween(start, from) * pxPerDay;
    const width = daysBetween(from, to) * pxPerDay;
    if (width <= 0) continue;
    result.push({ key: `${unit}-${cursor.getTime()}`, left, width, ...labelOf(cursor, unit, width) });
  }
  return result;
}

/**
 * Période et graduations à afficher.
 *
 * @param dataStart début des données (null : aucune date planifiée)
 * @param dataEnd fin des données
 * @param minWidth largeur visible : la période est prolongée pour la remplir
 */
export function buildTimeline(
  dataStart: Date | null,
  dataEnd: Date | null,
  scale: TimeScale,
  minWidth = 0,
  today = new Date(),
): Timeline {
  const def = scaleDef(scale);
  const from = dataStart ?? today;
  const to = dataEnd && dataEnd > from ? dataEnd : add(from, "month", scale === "jours" ? 1 : 12);

  const start = startOf(add(from, def.padding.unit, -def.padding.count), def.top);
  let end = startOf(add(add(to, def.padding.unit, def.padding.count), def.top, 1), def.top);
  while (daysBetween(start, end) * def.pxPerDay < minWidth) end = add(end, def.top, 1);

  const days = daysBetween(start, end);
  const todayOffset = daysBetween(start, today);
  return {
    scale,
    start,
    end,
    pxPerDay: def.pxPerDay,
    width: days * def.pxPerDay,
    top: cells(start, end, def.top, def.pxPerDay),
    bottom: cells(start, end, def.bottom, def.pxPerDay),
    todayX: todayOffset >= 0 && todayOffset < days ? (todayOffset + 0.5) * def.pxPerDay : null,
  };
}

/** Abscisse d'une date sur la période. */
export const dateToX = (timeline: Timeline, date: Date) => daysBetween(timeline.start, date) * timeline.pxPerDay;

/** Date située à une abscisse (pour conserver la position lors d'un changement d'échelle). */
export const xToDate = (timeline: Timeline, x: number) => add(timeline.start, "day", Math.round(x / timeline.pxPerDay));

/** Échelle proposée par défaut, selon la durée couverte par les données. */
export function suggestScale(dataStart: Date | null, dataEnd: Date | null): TimeScale {
  if (!dataStart || !dataEnd) return "semaines";
  const days = daysBetween(dataStart, dataEnd);
  if (days <= 75) return "jours";
  if (days <= 550) return "semaines";
  if (days <= 5 * 365) return "mois";
  if (days <= 15 * 365) return "trimestres";
  return "annees";
}
