"use client";

import { useState } from "react";

export type PreviewKind = "pdf" | "image" | "video" | "audio" | "youtube" | "drive";

/**
 * Aperçu dans le navigateur (F12), chargé seulement au clic : rien n'est téléchargé
 * tant que l'utilisateur ne le demande pas (faible débit).
 */
export function Preview({ kind, src, title }: { kind: PreviewKind; src: string; title: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        👁 Aperçu
      </button>
    );
  }
  return (
    <div className="space-y-2" data-testid="preview">
      <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>Fermer l&apos;aperçu</button>
      {kind === "pdf" && (
        <>
          {/* Chrome sur Android n'affiche pas les PDF intégrés : on propose aussi un nouvel onglet. */}
          <a href={src} target="_blank" rel="noopener" className="link block text-sm">
            Ouvrir le PDF dans un nouvel onglet
          </a>
          <iframe src={src} title={`Aperçu : ${title}`} className="h-[70vh] w-full rounded border border-slate-200" />
        </>
      )}
      {kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element -- fichier protégé servi par /api/files, non optimisable par next/image
        <img src={src} alt={title} className="max-h-[70vh] w-auto rounded border border-slate-200" />
      )}
      {kind === "video" && <video src={src} controls preload="metadata" className="w-full rounded" />}
      {kind === "audio" && <audio src={src} controls preload="metadata" className="w-full" />}
      {(kind === "youtube" || kind === "drive") && (
        <div className="aspect-video w-full">
          <iframe
            src={src}
            title={`Aperçu : ${title}`}
            className="h-full w-full rounded border border-slate-200"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </div>
  );
}
