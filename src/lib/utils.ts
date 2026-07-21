import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as money with thousand separators and 2 decimals
 * @example formatMoney(1500000) => "1 500 000,00"
 * @example formatMoney(1500000.5) => "1 500 000,50"
 */
export function formatMoney(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a date string to French format DD/MM/YYYY without time
 * @example formatDate("2024-01-15T10:30:00.000Z") => "15/01/2024"
 * @example formatDate("2024-01-15") => "15/01/2024"
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) return "—";
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return "—";
  }
}

/**
 * Format a date string to French long format with line break support
 * @example formatDateLong("2024-01-15") => "15 janvier 2024"
 */
export function formatDateLong(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "—";
    
    return date.toLocaleDateString("fr-FR", { 
      day: "numeric", 
      month: "long", 
      year: "numeric" 
    });
  } catch {
    return "—";
  }
}
