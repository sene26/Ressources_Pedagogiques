import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("CSV (F3, F26)", () => {
  it("lit les séparateurs « ; » ou « , », les guillemets, le BOM et les fins de ligne Windows", () => {
    expect(parseCsv("﻿nom;prenom\r\nSarr;\"Fatou; Aïda\"\r\n")).toEqual([["nom", "prenom"], ["Sarr", "Fatou; Aïda"]]);
    expect(parseCsv('nom,prenom\nDiallo,"A ""B"""\n\n')).toEqual([["nom", "prenom"], ["Diallo", 'A "B"']]);
  });

  it("écrit un CSV pour Excel (BOM, « ; ») et neutralise les formules", () => {
    const csv = toCsv(["Titre", "Vues"], [["=HYPERLINK(\"x\")", 3], ["Cours; partie 1", 0]]);
    expect(csv.startsWith("﻿Titre;Vues\r\n")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")";3`);
    expect(csv).toContain('"Cours; partie 1";0');
  });
});
