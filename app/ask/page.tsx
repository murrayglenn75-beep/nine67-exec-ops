"use client";

import { useRef, useState } from "react";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

const STARTER_QUESTIONS = [
  "Which clients may be at risk?",
  "What's our profit margin per project?",
  "Which projects haven't been updated recently?",
  "Who on the team is over-allocated this quarter?",
];

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || isStreaming) return;

    setError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      setError("Couldn't reach Signal Desk. Try again.");
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-64px)]">
      <div className="mx-auto flex h-[calc(100vh-64px)] max-w-3xl flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 border-b border-zinc-800 pb-6">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-zinc-50">
            Ask
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Grounded in the current projects, clients, team, and Q3 revenue digest — nothing
            outside that data.
          </p>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-wide text-zinc-600">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-full border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, i) => {
            const isLast = i === messages.length - 1;
            const isStreamingThis = isLast && message.role === "assistant" && isStreaming;
            return (
              <div
                key={i}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <span className="mb-1 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                  {message.role === "user" ? "You" : "Signal Desk"}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-sm border border-accent/30 bg-accent/10 text-zinc-100"
                      : "rounded-bl-sm border border-zinc-800 bg-zinc-900/60 text-zinc-200"
                  }`}
                >
                  {message.content}
                  {isStreamingThis && (
                    <span className="ml-0.5 animate-pulse text-accent">▍</span>
                  )}
                </div>
              </div>
            );
          })}

          {error && <p className="text-sm text-orange-300">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mt-4 flex gap-3 border-t border-zinc-800 pt-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a project, client, or team member…"
            disabled={isStreaming}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </div>
    </main>
  );
}
