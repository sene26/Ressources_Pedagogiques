"use client";

import { useState } from "react";
import type { ResourceType, Visibility } from "@prisma/client";
import { ACCEPT_ATTRIBUTE } from "@/lib/file-types";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/labels";

export interface CourseElementOption {
  id: string;
  label: string;
}

interface MetadataFieldsProps {
  courseElements: CourseElementOption[];
  defaults?: {
    title?: string;
    description?: string;
    type?: ResourceType;
    keywords?: string;
    courseElementIds?: string[];
    visibility?: Visibility;
  };
}

/** Titre, description, type, EC, mots-clés et visibilité d'une ressource (F9). */
export function ResourceMetadataFields({ courseElements, defaults = {} }: MetadataFieldsProps) {
  const [type, setType] = useState<ResourceType>(defaults.type ?? "COURSE");
  const sensitive = type === "EXAM" || type === "SOLUTION";
  return (
    <>
      <div>
        <label htmlFor="title" className="label">Titre</label>
        <input id="title" name="title" required maxLength={200} defaultValue={defaults.title} className="input" />
      </div>
      <div>
        <label htmlFor="description" className="label">Description (facultatif)</label>
        <textarea id="description" name="description" rows={3} maxLength={5000} defaultValue={defaults.description} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className="label">Type</label>
          <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as ResourceType)} className="input">
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="keywords" className="label">Mots-clés (séparés par des virgules)</label>
          <input id="keywords" name="keywords" defaultValue={defaults.keywords} placeholder="simplexe, dualité" className="input" />
        </div>
      </div>
      <fieldset>
        <legend className="label">EC (au moins un — seulement les EC qui vous sont affectés)</legend>
        {courseElements.length === 0 ? (
          <p className="text-sm text-red-700">Aucun EC ne vous est affecté pour l&apos;année en cours.</p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {courseElements.map((ec) => (
              <label key={ec.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="courseElementIds" value={ec.id} defaultChecked={defaults.courseElementIds?.includes(ec.id)} className="mt-1" />
                <span>{ec.label}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend className="label">Visibilité</legend>
        <div className="space-y-1">
          {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="radio" name="visibility" value={v} defaultChecked={(defaults.visibility ?? "EC_STUDENTS") === v} required />
              {VISIBILITY_LABELS[v]}
            </label>
          ))}
        </div>
      </fieldset>
      {sensitive && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="note">
          Sujet d&apos;examen ou corrigé : la date de publication est obligatoire et la publication pour les étudiants
          doit être validée par le responsable de formation (RG5).
        </p>
      )}
    </>
  );
}

/** Contenu d'une version : fichier ou lien externe (F9, F10). */
export function ContentFields({ required = true }: { required?: boolean }) {
  const [mode, setMode] = useState<"file" | "link">("file");
  return (
    <fieldset className="space-y-2">
      <legend className="label">Contenu</legend>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="contentMode" value="file" checked={mode === "file"} onChange={() => setMode("file")} /> Fichier
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="contentMode" value="link" checked={mode === "link"} onChange={() => setMode("link")} /> Lien externe
        </label>
      </div>
      {mode === "file" ? (
        <div>
          <label htmlFor="file" className="sr-only">Fichier</label>
          <input id="file" name="file" type="file" accept={ACCEPT_ATTRIBUTE} required={required} className="block w-full text-sm" />
          <p className="mt-1 text-xs text-slate-600">
            PDF, DOCX, PPTX, XLSX, ODT, ZIP, MP4, MP3, PNG, JPG, TXT, code source ou CSV — 100 Mo au maximum.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="externalUrl" className="label">Lien (YouTube, Google Drive…)</label>
          <input id="externalUrl" name="externalUrl" type="url" placeholder="https://" required={required} className="input" />
        </div>
      )}
    </fieldset>
  );
}

/** Choix de publication : brouillon, maintenant ou à une date (F11, F13). */
export function PublicationFields({ allowDraft = true, defaultMode = "draft" }: { allowDraft?: boolean; defaultMode?: "draft" | "now" | "schedule" }) {
  const [mode, setMode] = useState(allowDraft ? defaultMode : defaultMode === "draft" ? "now" : defaultMode);
  return (
    <fieldset className="space-y-1">
      <legend className="label">Publication</legend>
      {allowDraft && (
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="publicationMode" value="draft" checked={mode === "draft"} onChange={() => setMode("draft")} />
          Enregistrer en brouillon
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="publicationMode" value="now" checked={mode === "now"} onChange={() => setMode("now")} />
        Publier maintenant
      </label>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <input type="radio" name="publicationMode" value="schedule" checked={mode === "schedule"} onChange={() => setMode("schedule")} />
        Programmer le
        <input
          type="datetime-local"
          name="publishAt"
          aria-label="Date et heure de publication (heure du Sénégal)"
          disabled={mode !== "schedule"}
          required={mode === "schedule"}
          className="input w-auto py-1"
        />
      </label>
    </fieldset>
  );
}
