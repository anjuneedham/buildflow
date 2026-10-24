import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { bucket } from "@/lib/firebase/admin";
import { getSession } from "@/lib/session";

// Serves private job files to members of the owning business only.
// Path shape: project-files/{businessId}/{file}. Streams from Storage instead
// of buffering the whole file in memory (audit D5).
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const [root, businessId, ...rest] = path;
  const s = await getSession();
  if (root !== "project-files" || !businessId || rest.length !== 1 || s.membership?.business.id !== businessId) {
    return new NextResponse("Not found", { status: 404 });
  }
  const file = bucket().file(path.join("/"));
  try {
    const [meta] = await file.getMetadata();
    const name = req.nextUrl.searchParams.get("name");
    const headers: Record<string, string> = {
      "Content-Type": String(meta.contentType ?? "application/octet-stream"),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...(meta.size ? { "Content-Length": String(meta.size) } : {}),
      ...(name ? { "Content-Disposition": `attachment; filename="${name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120)}"` } : {}),
    };
    return new NextResponse(Readable.toWeb(file.createReadStream()) as ReadableStream, { headers });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
