import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Confidentialité" };

/**
 * Information des utilisateurs sur le traitement de leurs données (loi sénégalaise n° 2008-12, A12).
 * Page publique. Le responsable du traitement et le contact sont à confirmer par l'université.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm leading-relaxed">
      <p><Link href="/" className="link">← RessourcesPéda</Link></p>
      <h1 className="h1">Protection des données personnelles</h1>
      <p>
        RessourcesPéda est la plateforme de gestion des ressources pédagogiques de l&apos;Université Assane Seck de Ziguinchor (UASZ).
        Le traitement des données respecte la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel.
      </p>
      <h2 className="h2">Données collectées</h2>
      <ul className="list-disc pl-5">
        <li>Identité et contact : nom, prénom, adresse électronique, téléphone (facultatif), photo (facultative).</li>
        <li>Rôles, inscription (formation, niveau, année) et affectations aux enseignements.</li>
        <li>Ressources déposées et journal des actions (dépôt, publication, suppression…).</li>
        <li>Consultations et téléchargements des ressources (utilisateur, ressource, date).</li>
      </ul>
      <h2 className="h2">Finalités</h2>
      <p>
        Donner accès aux ressources pédagogiques selon les droits de chacun, sécuriser la plateforme et produire des statistiques
        d&apos;usage <strong>agrégées</strong> pour le pilotage pédagogique. Aucune liste nominative des personnes ayant consulté une ressource
        n&apos;est présentée aux enseignants ni aux responsables.
      </p>
      <h2 className="h2">Durées de conservation</h2>
      <ul className="list-disc pl-5">
        <li>Consultations nominatives : 2 ans, puis anonymisées automatiquement (seuls les compteurs sont conservés).</li>
        <li>Comptes : tant que la personne est membre de l&apos;université ; un compte inactif est désactivé, pas supprimé.</li>
        <li>Sauvegardes : 14 jours.</li>
      </ul>
      <h2 className="h2">Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification et d&apos;opposition. Vous pouvez modifier vos informations depuis votre profil
        et vous adresser à l&apos;administrateur de la plateforme pour toute autre demande. Vous pouvez également saisir la Commission de
        protection des données personnelles (CDP).
      </p>
      <h2 className="h2">Sécurité</h2>
      <p>
        Mots de passe chiffrés (argon2id), accès contrôlé sur le serveur pour chaque ressource, liens de téléchargement personnels et
        temporaires, connexion chiffrée (HTTPS) et sauvegardes quotidiennes.
      </p>
    </main>
  );
}
