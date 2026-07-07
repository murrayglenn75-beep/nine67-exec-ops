import { buildDigest } from "@/lib/digest";
import { createClaudeClient, explainProjectRisk } from "@/lib/claude";

export const dynamic = "force-dynamic";

interface ExplainRequestBody {
  projectId: number;
}

export async function POST(req: Request) {
  const body = (await req.json()) as ExplainRequestBody;

  if (typeof body.projectId !== "number") {
    return new Response("Missing projectId", { status: 400 });
  }

  const digest = await buildDigest();
  const project = digest.projects.find((p) => p.id === body.projectId);

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const client = createClaudeClient();
  const explanation = await explainProjectRisk({ client, digest, project });

  return Response.json({ explanation });
}
