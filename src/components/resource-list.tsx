import Link from "next/link";
import type { ApprovalStatus, ResourceStatus, ResourceType, Visibility } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import { FORMAT_LABELS, formatSize } from "@/lib/file-types";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { ResourceBadges } from "./resource-badges";

const TYPE_ICONS: Record<ResourceType, string> = {
  COURSE: "📄", TUTORIAL: "📝", LAB: "🧪", EXAM: "📋", SOLUTION: "✅", VIDEO: "🎬", LINK: "🔗", OTHER: "📦",
};

export interface ResourceListItem {
  id: string;
  title: string;
  type: ResourceType;
  status: ResourceStatus;
  visibility: Visibility;
  approvalStatus: ApprovalStatus;
  publishAt: Date | null;
  createdAt: Date;
  author: { firstName: string; lastName: string };
  versions: { format: string; sizeBytes: number | null }[];
  courseElements?: { courseElement: { title: string } }[];
}

/** Liste compacte de ressources (pages d'EC, recherche) : une ligne légère par ressource. */
export function ResourceList({ resources, showBadges, showCourseElements }: { resources: ResourceListItem[]; showBadges: boolean; showCourseElements?: boolean }) {
  if (resources.length === 0) return <p className="text-sm">Aucune ressource.</p>;
  return (
    <ul className="divide-y divide-slate-100" data-testid="resource-list">
      {resources.map((r) => {
        const version = r.versions[0];
        return (
          <li key={r.id} className="py-3">
            <Link href={`/ressources/${r.id}`} className="link font-medium">
              <span aria-hidden="true">{TYPE_ICONS[r.type]} </span>
              {r.title}
            </Link>
            <p className="text-sm text-slate-600">
              {RESOURCE_TYPE_LABELS[r.type]}
              {version && <> · {FORMAT_LABELS[version.format] ?? version.format}{version.sizeBytes ? ` · ${formatSize(version.sizeBytes)}` : ""}</>}
              {" · "}{r.author.firstName} {r.author.lastName} · {formatDate(r.publishAt ?? r.createdAt)}
              {showCourseElements && r.courseElements && <> · {r.courseElements.map((c) => c.courseElement.title).join(", ")}</>}
            </p>
            {showBadges && <ResourceBadges resource={r} />}
          </li>
        );
      })}
    </ul>
  );
}
