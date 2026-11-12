import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { academicYearSchema, createProgramSchema, createUserSchema, emailSchema, parseInput, passwordSchema } from "@/lib/validation";

describe("Validation des saisies", () => {
  it("normalise l'adresse électronique en minuscules", () => {
    expect(emailSchema.parse("  Awa.Diallo@UASZ.test ")).toBe("awa.diallo@uasz.test");
  });

  it("applique la politique de mot de passe", () => {
    expect(passwordSchema.safeParse("court1").success).toBe(false);
    expect(passwordSchema.safeParse("sanschiffreaucun").success).toBe(false);
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
    expect(passwordSchema.safeParse("motdepasse2026").success).toBe(true);
  });

  it("renvoie des messages d'erreur en français, par champ", () => {
    try {
      parseInput(createUserSchema, { lastName: "", firstName: "Awa", email: "pas-une-adresse", password: "x", roles: [] });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const fields = (error as ValidationError).fieldErrors;
      expect(fields.lastName).toBe("Nom : champ obligatoire.");
      expect(fields.email).toBe("Adresse électronique invalide.");
      expect(fields.roles).toBe("Choisir au moins un rôle.");
    }
  });

  it("refuse une année dont la fin précède le début", () => {
    const result = academicYearSchema.safeParse({ label: "2026-2027", startDate: "2027-07-01", endDate: "2026-10-01" });
    expect(result.success).toBe(false);
  });

  it("restreint les caractères des codes", () => {
    expect(createProgramSchema.safeParse({ code: "M-MIO", title: "Master MIO", cycle: "MASTER" }).success).toBe(true);
    expect(createProgramSchema.safeParse({ code: "M MIO<script>", title: "x", cycle: "MASTER" }).success).toBe(false);
  });
});
