import type { Prisma } from "@prisma/client";

/** Client Prisma ou transaction en cours : l'écriture au journal se fait dans la même transaction que l'action. */
type Tx = Prisma.TransactionClient;

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
}

/** Enregistre une action dans le journal (F25). */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details,
    },
  });
}
