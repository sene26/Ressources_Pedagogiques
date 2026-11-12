import { hash, verify } from "@node-rs/argon2";

/**
 * Hachage des mots de passe avec argon2id (paramètres recommandés par l'OWASP :
 * 19 Mio de mémoire, 2 itérations, parallélisme 1).
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    // Empreinte mal formée : on refuse sans divulguer de détail.
    return false;
  }
}

/**
 * Empreinte factice utilisée quand l'adresse est inconnue, pour que la durée de réponse
 * ne révèle pas l'existence d'un compte.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("mot-de-passe-factice-0");
  return dummyHash;
}
