// Tâche périodique (conteneur « cron ») : toutes les 10 minutes, demande à l'application
// d'envoyer les notifications dues (F13, F22) et d'anonymiser les consultations de plus de 2 ans (A12).
const url = process.env.CRON_TARGET ?? "http://app:3000/api/cron/notifications";
const secret = process.env.CRON_SECRET;
const intervalMs = Number(process.env.CRON_INTERVAL_MINUTES ?? 10) * 60_000;

if (!secret) {
  console.error("CRON_SECRET n'est pas défini : tâche périodique désactivée.");
  process.exit(1);
}

async function tick() {
  try {
    const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    console.log(new Date().toISOString(), response.status, await response.text());
  } catch (error) {
    console.error(new Date().toISOString(), "Application injoignable :", error.message);
  }
}

await tick();
setInterval(tick, intervalMs);
