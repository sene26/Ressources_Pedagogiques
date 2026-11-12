/**
 * Génère de petits fichiers de démonstration valides (PDF d'une page, texte),
 * pour que les aperçus et téléchargements fonctionnent avec les données de démonstration.
 */

/** Échappe le texte pour un flux PDF et remplace les caractères hors Latin-1. */
function pdfText(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[^\x20-\xff]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

/** PDF minimal (une page, police Helvetica) avec un titre et quelques lignes. */
export function makePdf(title: string, lines: string[]): Buffer {
  const content = [
    "BT /F1 20 Tf 60 760 Td (" + pdfText(title) + ") Tj ET",
    ...lines.map((line, i) => `BT /F1 12 Tf 60 ${720 - i * 18} Td (${pdfText(line)}) Tj ET`),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
