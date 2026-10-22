import { NextResponse, type NextRequest } from "next/server";
import { bucket } from "@/lib/firebase/admin";
import { getSession } from "@/lib/session";

// Streams private project photos to members of the owning business only.
// Path shape: project-files/{businessId}/{file}
export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const [root, businessId, ...rest] = path;
  const s = await getSession();
  if (root !== "project-files" || !businessId || rest.length !== 1 || s.membership?.business.id !== businessId) {
    return new NextResponse("Not found", { status: 404 });
  }
  const file = bucket().file(path.join("/"));
  try {
    const [[buf], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": String(meta.contentType ?? "application/octet-stream"), "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
