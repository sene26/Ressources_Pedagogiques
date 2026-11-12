import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticate } from "./services/users";

/** Erreur de connexion distincte quand trop de tentatives ont échoué. */
export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

/**
 * Configuration Auth.js (F1) : connexion par adresse électronique et mot de passe,
 * session stockée dans un cookie JWT chiffré (HttpOnly, SameSite=Lax, Secure en HTTPS).
 * La session ne contient que l'identifiant : rôles et statut sont relus en base à chaque requête.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/connexion" },
  logger: {
    // Un mot de passe erroné est un cas normal : inutile d'écrire sa pile d'appels dans le journal.
    error(error) {
      // `type` survit à la minification, contrairement au nom de classe.
      if ((error as { type?: string }).type === "CredentialsSignin") return;
      console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const result = await authenticate(credentials?.email, credentials?.password);
        if (result.ok) return { id: result.userId };
        if (result.reason === "rate_limited") throw new TooManyAttempts();
        return null;
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
