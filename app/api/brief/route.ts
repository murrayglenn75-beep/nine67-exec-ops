import { buildDigest } from "@/lib/digest";
import { createClaudeClient, generateWeeklyBrief } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST() {
  const digest = await buildDigest();
  const client = createClaudeClient();
  const brief = await generateWeeklyBrief({ client, digest });

  return Response.json({ brief });
}
