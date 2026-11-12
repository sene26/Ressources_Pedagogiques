import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { getStorage } from "@/server/storage";

/** Photo de profil (F4), visible des seuls utilisateurs connectés. */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await getCurrentUser())) return new Response(null, { status: 401 });
  const { userId } = await params;
  const user = await db.user.findUnique({ where: { id: userId }, select: { photoKey: true } });
  if (!user?.photoKey) return new Response(null, { status: 404 });
  const object = await getStorage().get(user.photoKey);
  return new Response(object.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
