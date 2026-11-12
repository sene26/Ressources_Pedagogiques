/**
 * Affichage des dates en français, à l'heure du Sénégal (GMT, sans heure d'été).
 */
const TIME_ZONE = "Africa/Dakar";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date).replace(" ", " à ");
}

/** Valeur pour un champ « datetime-local » (heure GMT du Sénégal). */
export function toLocalInputValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}
