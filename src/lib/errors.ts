/**
 * Erreurs métier. Leur message est en français et peut être affiché tel quel à l'utilisateur.
 * Toute autre erreur est considérée comme inattendue : on affiche alors un message générique.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Données saisies invalides. `fieldErrors` associe un nom de champ à son message. */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** L'utilisateur n'a pas le droit d'effectuer l'action. */
export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas les droits nécessaires pour effectuer cette action.") {
    super(message);
  }
}

/** Élément introuvable (ou invisible pour l'utilisateur : on ne révèle pas son existence). */
export class NotFoundError extends AppError {
  constructor(message = "Élément introuvable.") {
    super(message);
  }
}

/** Conflit avec l'état existant (doublon, élément déjà utilisé…). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message);
  }
}
