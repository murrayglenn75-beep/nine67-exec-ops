import type Anthropic from "@anthropic-ai/sdk";
import { buildDigest } from "@/lib/digest";
import { createClaudeClient, streamAskResponse } from "@/lib/claude";

export const dynamic = "force-dynamic";

interface AskRequestBody {
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as AskRequestBody;

  if (!body.question || typeof body.question !== "string") {
    return new Response("Missing question", { status: 400 });
  }

  const digest = await buildDigest();
  const client = createClaudeClient();

  const history: Anthropic.MessageParam[] = (body.history ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = streamAskResponse({
    client,
    digest,
    question: body.question,
    history,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
