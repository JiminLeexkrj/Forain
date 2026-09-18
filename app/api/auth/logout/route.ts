import { deleteCurrentSession } from "@/app/auth";
import { jsonError } from "@/lib/forain-server";

export async function POST() {
  try {
    await deleteCurrentSession();
    return new Response(null, { status: 204 });
  } catch (error) { return jsonError(error); }
}
