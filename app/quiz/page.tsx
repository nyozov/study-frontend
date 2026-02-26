"use client";

import { Button, Card, Chip, Separator, TextArea } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { writeRateLimitFromHeaders } from "../lib/rateLimit";

type MockInterviewSession = {
  jobTitle: string;
  questions: string[];
};

type ReviewResponse = {
  summary: string;
  strengths: string[];
  improvements: string[];
  score: string;
};

type IdealAnswerResponse = {
  answer: string;
};

type QuizState = {
  currentIndex: number;
  completed: number;
};

export default function QuizPage() {
  const router = useRouter();
  const [course, setCourse] = useState<MockInterviewSession | null>(null);
  const [state, setState] = useState<QuizState>({
    currentIndex: 0,
    completed: 0,
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Record<string, ReviewResponse>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [reviewError, setReviewError] = useState<Record<string, string>>({});
  const [ideals, setIdeals] = useState<Record<string, IdealAnswerResponse>>({});
  const [idealLoading, setIdealLoading] = useState<Record<string, boolean>>({});
  const [idealError, setIdealError] = useState<Record<string, string>>({});

  useEffect(() => {
    const rawSession = localStorage.getItem("aceai_session");
    const rawCourse = localStorage.getItem("aceai_course");
    const raw = rawSession ?? rawCourse;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as MockInterviewSession & {
        mockInterviewQuestions?: string[];
      };
      const questions = parsed.questions ?? parsed.mockInterviewQuestions ?? [];
      setCourse({ jobTitle: parsed.jobTitle, questions });
    } catch {
      return;
    }
  }, []);

  const questions = useMemo<string[]>(() => {
    if (!course) return [];
    return course.questions ?? [];
  }, [course]);

  const total = questions.length;
  const current = questions[state.currentIndex];
  const progressValue = total
    ? Math.min(Math.round((state.currentIndex / total) * 100), 100)
    : 0;

  const nextQuestion = () => {
    setState((prev) => ({
      currentIndex: Math.min(prev.currentIndex + 1, total),
      completed: Math.min(prev.completed + 1, total),
    }));
  };

  const prevQuestion = () => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(prev.currentIndex - 1, 0),
    }));
  };

  const submitReview = async (question: string, key: string) => {
    const answer = answers[key] ?? "";
    if (!answer.trim() || !course) return;

    setReviewLoading((prev) => ({ ...prev, [key]: true }));
    setReviewError((prev) => ({ ...prev, [key]: "" }));

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_STUDY_API_URL ?? "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/mock-interview/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer: answer.trim(),
          jobTitle: course.jobTitle,
        }),
      });

      writeRateLimitFromHeaders(res.headers);

      const text = await res.text();
      if (!res.ok) {
        setReviewError((prev) => ({
          ...prev,
          [key]: `Request failed (${res.status}). ${text}`,
        }));
        return;
      }

      const json = JSON.parse(text) as ReviewResponse;
      setReviews((prev) => ({ ...prev, [key]: json }));
    } catch (err) {
      setReviewError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Unknown error",
      }));
    } finally {
      setReviewLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getIdealAnswer = async (question: string, key: string) => {
    if (!course) return;

    setIdealLoading((prev) => ({ ...prev, [key]: true }));
    setIdealError((prev) => ({ ...prev, [key]: "" }));

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_STUDY_API_URL ?? "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/mock-interview/ideal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          jobTitle: course.jobTitle,
        }),
      });

      writeRateLimitFromHeaders(res.headers);

      const text = await res.text();
      if (!res.ok) {
        setIdealError((prev) => ({
          ...prev,
          [key]: `Request failed (${res.status}). ${text}`,
        }));
        return;
      }

      const json = JSON.parse(text) as IdealAnswerResponse;
      setIdeals((prev) => ({ ...prev, [key]: json }));
    } catch (err) {
      setIdealError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Unknown error",
      }));
    } finally {
      setIdealLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (!course) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Card variant="secondary" className="glass-panel max-w-lg w-full">
          <Card.Content className="flex flex-col gap-4 text-center">
            <h1 className="text-lg font-semibold">No quiz session found</h1>
            <p className="text-sm text-muted">
              Go back to AceAi and start a session.
            </p>
            <Button className="btn-primary" onPress={() => router.push("/")}>
              Back to AceAi
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (state.currentIndex >= total) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Card variant="secondary" className="glass-panel max-w-2xl w-full">
          <Card.Content className="flex flex-col gap-6">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-xs  tracking-[0.3em] text-muted">AceAi</p>
                <h1 className="text-2xl font-semibold">Session complete</h1>
              </div>
              <Chip variant="soft" color="default">
                {course.jobTitle}
              </Chip>
            </div>
            <div className="rounded-2xl  ">
              <p className="text-2xl font-semibold">{total} questions done</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="btn-primary" onPress={() => router.push("/")}>
                Back to AceAi
              </Button>
              <Button
                variant="outline"
                onPress={() => setState({ currentIndex: 0, completed: 0 })}
              >
                Retake session
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (!current) {
    return null;
  }

  const answerKey = `short-${state.currentIndex}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-16 top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl animate-glow" />
        <div className="absolute right-12 top-12 h-60 w-60 rounded-full bg-accent-soft/15 blur-3xl animate-glow" />
        <div className="absolute left-1/3 top-[55%] h-80 w-80 rounded-full bg-default/20 blur-3xl animate-glow" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="btn-ghost"
              onPress={() => router.push("/")}
            >
              Back
            </Button>
            <div>
              <p className="text-xs  tracking-[0.3em] text-muted">
                Interview Session
              </p>
              <p className="text-lg font-semibold text-foreground">
                Mock Interview
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted">
            <span>
              Question {state.currentIndex + 1} of {total}
            </span>
            <div className="h-2 w-36 rounded-full bg-default/40">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </header>

        <Card variant="secondary" className="glass-panel">
          <Card.Content className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Chip variant="soft" color="accent" size="sm">
                Short answer
              </Chip>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              {current}
            </h2>
            <div className="flex flex-col gap-3">
              <TextArea
                rows={5}
                placeholder="Write your response..."
                value={answers[answerKey] ?? ""}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [answerKey]: event.target.value,
                  }))
                }
                variant="secondary"
                className="bg-default text-foreground placeholder:text-muted"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="btn-primary"
                  isDisabled={!(answers[answerKey] ?? "").trim()}
                  onPress={() => submitReview(current, answerKey)}
                >
                  {reviewLoading[answerKey] ? "Reviewing..." : "Get feedback"}
                </Button>
                <Button
                  variant="outline"
                  className="btn-ghost"
                  onPress={() => getIdealAnswer(current, answerKey)}
                >
                  {idealLoading[answerKey]
                    ? "Generating..."
                    : "Show ideal answer"}
                </Button>
              </div>
              {reviewError[answerKey] && (
                <Card
                  variant="secondary"
                  className="border border-danger/40 bg-danger/10"
                >
                  <Card.Content className="text-xs text-danger-foreground">
                    {reviewError[answerKey]}
                  </Card.Content>
                </Card>
              )}
              {idealError[answerKey] && (
                <Card
                  variant="secondary"
                  className="border border-danger/40 bg-danger/10"
                >
                  <Card.Content className="text-xs text-danger-foreground">
                    {idealError[answerKey]}
                  </Card.Content>
                </Card>
              )}
              {reviews[answerKey] && (
                <Card variant="secondary" className="bg-surface">
                  <Card.Content className="flex flex-col gap-3 text-xs text-muted">
                    <p className="text-sm text-foreground">
                      {reviews[answerKey].summary}
                    </p>
                    <div>
                      <p className="">Strengths</p>
                      <ul className="mt-2 grid gap-1">
                        {reviews[answerKey].strengths.map((item, index) => (
                          <li
                            key={`${answerKey}-s-${index}`}
                            className="rounded-lg bg-default/40 px-2 py-1"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-muted">Improvements</p>
                      <ul className="mt-2 grid gap-1">
                        {reviews[answerKey].improvements.map((item, index) => (
                          <li
                            key={`${answerKey}-i-${index}`}
                            className="rounded-lg bg-default/40 px-2 py-1"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card.Content>
                </Card>
              )}
              {ideals[answerKey] && (
                <Card className="border ">
                  <Card.Content className="flex flex-col gap-2 text-xs ">
                    <p>Ideal answer</p>
                    <p className="text-sm ">{ideals[answerKey].answer}</p>
                  </Card.Content>
                </Card>
              )}
            </div>

            <Separator variant="secondary" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                className="btn-ghost"
                onPress={prevQuestion}
                isDisabled={state.currentIndex === 0}
              >
                Previous
              </Button>
              <div className="flex flex-wrap gap-3">
                <Button className="btn-primary" onPress={nextQuestion}>
                  Next question
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
