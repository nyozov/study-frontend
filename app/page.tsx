"use client";

import { Button, Card, TextArea } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { writeRateLimitFromHeaders } from "./lib/rateLimit";

type CourseGuide = {
  jobTitle: string;
  overview: string;
  modules: Array<{
    title: string;
    description: string;
    resources: string[];
  }>;
  mockInterviewQuestions: string[];
};

const promptPresets = [
  "Senior growth marketer for Amazon marketplace strategy",
  "E-commerce specialist managing Amazon PPC, SEO, and listings",
  "Frontend engineer scaling design systems in React",
  "Data analyst pivoting to ML engineering in 90 days",
];

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);

  const canSubmit = prompt.trim().length > 3 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setProgress(["Starting..."]);

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_STUDY_API_URL ?? "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/course-guide/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      writeRateLimitFromHeaders(res.headers);

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(`Request failed (${res.status}). ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let eventEnd;
        while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, eventEnd).trim();
          buffer = buffer.slice(eventEnd + 2);

          if (!rawEvent) continue;

          let eventName = "message";
          let eventData = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.replace("event:", "").trim();
            } else if (line.startsWith("data:")) {
              eventData += line.replace("data:", "").trim();
            }
          }

          if (eventName === "progress") {
            setProgress((prev) => [...prev, eventData]);
          }

          if (eventName === "result") {
            const json = JSON.parse(eventData) as CourseGuide;
            localStorage.setItem("aceai_course", JSON.stringify(json));
            router.push("/quiz");
            return;
          }

          if (eventName === "error") {
            setError(eventData || "Unknown error");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-14">
        <header className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Ace your next interview with confidence.
          </h1>
          <p className="max-w-2xl text-sm text-muted">
            Paste a job description below. Our AI will analyze the requirements
            and generate a personalized mock interview with technical
            short-answer questions.
          </p>
        </header>

        <section className="flex flex-col gap-6">
          <Card variant="secondary" className="glass-panel">
            <Card.Content className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-muted">
                  Job description
                </label>
                <TextArea
                  rows={8}
                  placeholder="Paste a job description or describe a role here..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  variant="secondary"
                  className="bg-default text-foreground placeholder:text-muted"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {promptPresets.map((preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant="secondary"
                    className="btn-ghost"
                    onPress={() => setPrompt(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="btn-primary"
                  onPress={handleSubmit}
                  isDisabled={!canSubmit}
                >
                  {loading
                    ? "Building your session..."
                    : "Start interview session"}
                </Button>
                <Button
                  variant="outline"
                  className="btn-ghost"
                  onPress={() => {
                    setPrompt("");
                    setError(null);
                    setProgress([]);
                  }}
                >
                  Reset
                </Button>
              </div>

              {error && (
                <Card
                  variant="secondary"
                  className="border border-danger/40 bg-danger/10"
                >
                  <Card.Content className="text-sm text-danger-foreground">
                    {error}
                  </Card.Content>
                </Card>
              )}

              {progress.length > 0 && (
                <Card variant="secondary" className="bg-surface">
                  <Card.Header className="text-xs uppercase tracking-[0.2em] text-muted">
                    Progress
                  </Card.Header>
                  <Card.Content className="flex flex-col gap-2 text-xs text-muted">
                    {progress.slice(-5).map((item, idx) => (
                      <div
                        key={`${item}-${idx}`}
                        className="rounded-md bg-default/40 px-2 py-1"
                      >
                        {item}
                      </div>
                    ))}
                  </Card.Content>
                </Card>
              )}
            </Card.Content>
          </Card>
        </section>
      </div>
    </div>
  );
}
