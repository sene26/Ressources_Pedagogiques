# Sécurité — RessourcesPéda

Bilan des mesures en place à la fin du Lot 6, au regard du cahier des charges (§7) et des risques OWASP courants.

| Risque | Mesure | Où |
| --- | --- | --- |
| Mots de passe | argon2id (paramètres OWASP) ; 10 caractères minimum, avec lettre et chiffre ; jamais transmis par courriel (liens d'activation et de réinitialisation à usage unique, seule leur empreinte est stockée) | `src/server/password.ts`, `password-reset.ts` |
| Force brute | 5 essais par adresse et par 15 minutes ; 3 demandes de réinitialisation par heure ; message d'échec unique ; durée de réponse identique si l'adresse est inconnue | `services/users.ts`, `rate-limit.ts` |
| Contrôle d'accès (RG2 à RG7) | Vérifié côté serveur pour chaque fiche, liste, recherche et téléchargement. Une seule politique, sous deux formes dont la concordance est testée sur 486 ressources × 11 profils. Une ressource interdite répond « introuvable » (404) | `policies/resource-policy.ts` |
| Comptes désactivés, rôles retirés | Rôles et statut relus en base à chaque requête : effet immédiat | `current-user.ts` |
| Téléchargements | Liens personnels signés (HMAC-SHA256), valables 10 minutes, revérifiés à chaque requête ; chemins de stockage jamais exposés ; clés de stockage aléatoires et validées | `file-tokens.ts`, `api/files/[token]` |
| Fichiers malveillants | Extension **et** signature binaire contrôlées ; 100 Mo au maximum ; HTML, texte et code toujours servis en pièce jointe avec `nosniff` (pas d'exécution de script) | `lib/file-types.ts`, `services/files.ts` |
| Injection SQL | Prisma (requêtes paramétrées) ; recherche plein texte en `Prisma.sql` paramétré ; opérateurs booléens de MariaDB neutralisés | `services/search.ts` |
| XSS | Échappement par React, aucun `dangerouslySetInnerHTML` ; politique CSP (`object-src 'none'`, cadres limités à YouTube nocookie et Google Drive) | `next.config.ts` |
| CSRF | Server Actions de Next.js (contrôle de l'origine) ; cookies de session `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS ; routes GET sans effet de bord, sauf la lecture d'une notification | Auth.js, Next.js |
| Clickjacking | `X-Frame-Options: DENY` pour les pages ; `SAMEORIGIN` pour les fichiers (aperçu PDF) | `next.config.ts` |
| Redirections ouvertes | Destination après connexion et liens des notifications limités aux chemins internes | `(auth)/actions.ts`, `notifications/[id]` |
| Injection de formules (CSV) | Valeurs commençant par `= + - @` neutralisées dans les exports | `lib/csv.ts` |
| Tâche périodique | Secret partagé (`CRON_SECRET`), comparé en temps constant | `api/cron/notifications` |
| Secrets | Uniquement en variables d'environnement (`.env`, non versionné ; `.env.example` documenté) | — |
| Données personnelles (loi 2008-12) | Statistiques agrégées uniquement ; consultations anonymisées après 2 ans ; page d'information « Confidentialité » | `services/privacy.ts`, `/confidentialite` |
| Traçabilité | Journal des actions (dépôts, publications, validations, suppressions, comptes, imports) | `audit.ts`, Gestion › Journal |
| Dépendances | `npm audit --omit=dev` : 0 vulnérabilité (versions corrigées de nodemailer et deepmerge-ts imposées par `overrides`) | `package.json` |
| Disponibilité des données | Sauvegarde quotidienne de la base et des fichiers, 14 jours de rétention | `docker/backup.sh` |

## Limites connues et recommandations

- **CSP** : `script-src 'unsafe-inline'` reste nécessaire, car Next.js insère des scripts en ligne. Une évolution possible : des nonces par requête, via un `proxy.ts`.
- **Limitation des tentatives** : elle est gardée en mémoire et suffit pour une seule instance de l'application. Pour plusieurs instances, la stocker dans MariaDB ou Redis.
- **Sauvegardes** : les copier régulièrement **hors du serveur**.
- **Comptes de démonstration** : ne pas lancer `db:seed` en production, ou désactiver ensuite ces comptes.
- **Déclaration à la CDP** (Commission de protection des données personnelles) : elle relève de l'université.
