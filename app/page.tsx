"use client";

import { useMemo, useState } from "react";

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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

type CourseGuide = {
  jobTitle: string;
  overview: string;
  modules: Array<{
    title: string;
    description: string;
    resources: string[];
    quizQuestions: QuizQuestion[];
  }>;
  mockInterviewQuestions: string[];
};

type QuizState = {
  started: boolean;
  currentIndex: number;
  selectedIndex?: number;
  revealed: boolean;
  score: number;
};

const promptPresets = [
  "Junior backend engineer focused on Java, Spring Boot, and PostgreSQL",
  "Data analyst transitioning into ML engineering with Python and SQL",
  "Frontend engineer learning TypeScript, React, and system design",
  "Product manager pivoting into AI product roles in 60 days",
];

const optionLabels = ["A", "B", "C", "D"];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CourseGuide | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [quizStates, setQuizStates] = useState<Record<number, QuizState>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Record<string, ReviewResponse>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});
  const [reviewError, setReviewError] = useState<Record<string, string>>({});
  const [ideals, setIdeals] = useState<Record<string, IdealAnswerResponse>>({});
  const [idealLoading, setIdealLoading] = useState<Record<string, boolean>>({});
  const [idealError, setIdealError] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string[]>([]);

  const canSubmit = prompt.trim().length > 3 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setRaw(null);
    setQuizStates({});
    setAnswers({});
    setReviews({});
    setReviewLoading({});
    setReviewError({});
    setIdeals({});
    setIdealLoading({});
    setIdealError({});
    setProgress(["Starting..."]);

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_STUDY_API_URL ?? "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/course-guide/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

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
            setRaw(eventData);
            const json = JSON.parse(eventData) as CourseGuide;
            setResponse(json);
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

  const modules = useMemo(() => response?.modules ?? [], [response]);

  const startQuiz = (moduleIndex: number) => {
    setQuizStates((prev) => ({
      ...prev,
      [moduleIndex]: {
        started: true,
        currentIndex: 0,
        selectedIndex: undefined,
        revealed: false,
        score: 0,
      },
    }));
  };

  const selectOption = (
    moduleIndex: number,
    optionIndex: number,
    correctIndex: number
  ) => {
    setQuizStates((prev) => {
      const current = prev[moduleIndex];
      if (!current) return prev;

      const alreadyAnswered = current.revealed;
      const scoreDelta =
        !alreadyAnswered && optionIndex === correctIndex ? 1 : 0;

      return {
        ...prev,
        [moduleIndex]: {
          ...current,
          selectedIndex: optionIndex,
          score: current.score + scoreDelta,
        },
      };
    });
  };

  const revealAnswer = (moduleIndex: number) => {
    setQuizStates((prev) => {
      const current = prev[moduleIndex];
      if (!current) return prev;
      return {
        ...prev,
        [moduleIndex]: {
          ...current,
          revealed: true,
        },
      };
    });
  };

  const nextQuestion = (moduleIndex: number, total: number) => {
    setQuizStates((prev) => {
      const current = prev[moduleIndex];
      if (!current) return prev;

      const isLast = current.currentIndex >= total - 1;
      if (isLast) {
        return {
          ...prev,
          [moduleIndex]: {
            ...current,
            currentIndex: total,
          },
        };
      }

      return {
        ...prev,
        [moduleIndex]: {
          ...current,
          currentIndex: current.currentIndex + 1,
          selectedIndex: undefined,
          revealed: false,
        },
      };
    });
  };

  const submitReview = async (question: string, key: string) => {
    const answer = answers[key] ?? "";
    if (!answer.trim() || !response) return;

    setReviewLoading((prev) => ({ ...prev, [key]: true }));
    setReviewError((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch("/api/mock-interview/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer: answer.trim(),
          jobTitle: response.jobTitle,
        }),
      });

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
    if (!response) return;

    setIdealLoading((prev) => ({ ...prev, [key]: true }));
    setIdealError((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch("/api/mock-interview/ideal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          jobTitle: response.jobTitle,
        }),
      });

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

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-16 top-16 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-16 top-10 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-1/3 top-[55%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <span className="badge-dark">Study Mode</span>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Enter a job description. Start studying.
          </h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Generate a structured course, quizzes, and mock interviews. Practice fast.
          </p>
        </header>

        <section className="flex flex-col gap-6">
          <div className="panel">
            <textarea
              className="min-h-[160px] w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-inner outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/10"
              placeholder="Paste a job description or role target here..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {promptPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="chip"
                  onClick={() => setPrompt(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {loading ? "Building your course..." : "Generate study plan"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPrompt("");
                  setResponse(null);
                  setRaw(null);
                  setError(null);
                  setQuizStates({});
                  setAnswers({});
                  setReviews({});
                  setReviewLoading({});
                  setReviewError({});
                  setIdeals({});
                  setIdealLoading({});
                  setIdealError({});
                  setProgress([]);
                }}
              >
                Reset
              </button>
            </div>
            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            {progress.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                  Progress
                </p>
                <ul className="mt-2 grid gap-1">
                  {progress.slice(-5).map((item, idx) => (
                    <li key={`${item}-${idx}`} className="rounded-md bg-black/40 px-2 py-1">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {response && (
            <div className="panel space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {response.jobTitle}
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  {response.overview}
                </h2>
              </div>

              <div className="space-y-6">
                {modules.map((module, moduleIndex) => {
                  const quiz = quizStates[moduleIndex];
                  const quizQuestions = module.quizQuestions ?? [];
                  const quizCount = quizQuestions.length;
                  const inProgress = quiz?.started && quiz.currentIndex < quizCount;
                  const finished = quiz?.started && quiz.currentIndex >= quizCount;
                  const currentQuestion = inProgress
                    ? quizQuestions[quiz.currentIndex]
                    : null;
                  const progressValue = quizCount
                    ? Math.min(
                        Math.round(
                          ((quiz?.currentIndex ?? 0) / quizCount) * 100
                        ),
                        100
                      )
                    : 0;

                  return (
                    <div key={`${module.title}-${moduleIndex}`} className="card">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {module.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-300">
                            {module.description}
                          </p>
                        </div>
                        <span className="tag">Module {moduleIndex + 1}</span>
                      </div>

                      <div className="mt-6 space-y-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="section-label">Module Quiz</p>
                            {quiz?.started && (
                              <span className="text-xs text-slate-400">
                                Progress: {progressValue}%
                              </span>
                            )}
                          </div>

                          {!quiz?.started && (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  Ready for quiz mode?
                                </p>
                                <p className="text-xs text-slate-300">
                                  {quizCount} questions. Get instant feedback.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="primary"
                                onClick={() => startQuiz(moduleIndex)}
                                disabled={quizCount === 0}
                              >
                                Start quiz
                              </button>
                            </div>
                          )}

                          {inProgress && currentQuestion && quiz && (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>
                                  Question {quiz.currentIndex + 1} of {quizCount}
                                </span>
                                <span>Score: {quiz.score}</span>
                              </div>
                              <p className="mt-3 text-sm font-semibold text-white">
                                {currentQuestion.question}
                              </p>
                              <div className="mt-3 grid gap-2">
                                {(currentQuestion.options ?? []).map(
                                  (option, optionIndex) => {
                                    const selected = quiz.selectedIndex === optionIndex;
                                    const isCorrect =
                                      quiz.revealed &&
                                      optionIndex === currentQuestion.correctIndex;
                                    const isWrong =
                                      quiz.revealed &&
                                      selected &&
                                      !isCorrect;

                                    return (
                                      <button
                                        key={`${moduleIndex}-${quiz.currentIndex}-${optionIndex}`}
                                        type="button"
                                        className={
                                          "option " +
                                          (isCorrect
                                            ? "option-correct"
                                            : isWrong
                                            ? "option-wrong"
                                            : selected
                                            ? "option-selected"
                                            : "")
                                        }
                                        onClick={() =>
                                          selectOption(
                                            moduleIndex,
                                            optionIndex,
                                            currentQuestion.correctIndex
                                          )
                                        }
                                      >
                                        <span className="option-label">
                                          {optionLabels[optionIndex] ?? ""}
                                        </span>
                                        <span>{option}</span>
                                      </button>
                                    );
                                  }
                                )}
                              </div>
                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={quiz.selectedIndex === undefined}
                                  onClick={() => revealAnswer(moduleIndex)}
                                >
                                  Check answer
                                </button>
                                {quiz.revealed && (
                                  <button
                                    type="button"
                                    className="primary"
                                    onClick={() =>
                                      nextQuestion(moduleIndex, quizCount)
                                    }
                                  >
                                    Next question
                                  </button>
                                )}
                                {quiz.revealed && (
                                  <span
                                    className={
                                      "text-xs font-semibold " +
                                      (quiz.selectedIndex ===
                                      currentQuestion.correctIndex
                                        ? "text-emerald-300"
                                        : "text-rose-300")
                                    }
                                  >
                                    {quiz.selectedIndex ===
                                    currentQuestion.correctIndex
                                      ? "Correct"
                                      : "Not quite"}
                                  </span>
                                )}
                              </div>
                              {quiz.revealed && (
                                <p className="mt-3 text-xs text-slate-300">
                                  {currentQuestion.explanation}
                                </p>
                              )}
                            </div>
                          )}

                          {finished && quiz && (
                            <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
                              <p className="text-sm font-semibold text-emerald-200">
                                Quiz complete
                              </p>
                              <p className="mt-1 text-xs text-emerald-100">
                                You scored {quiz.score} / {quizCount}.
                              </p>
                              <button
                                type="button"
                                className="secondary mt-3"
                                onClick={() => startQuiz(moduleIndex)}
                              >
                                Retake quiz
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="section-label">Resources</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(module.resources ?? []).map((resource, resourceIndex) => (
                              <span
                                key={`${resource}-${resourceIndex}`}
                                className="chip"
                              >
                                {resource}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <p className="section-label">Mock interview practice</p>
                <div className="mt-4 grid gap-4">
                  {(response.mockInterviewQuestions ?? []).map((question, idx) => {
                    const key = `q-${idx}`;
                    const review = reviews[key];
                    const loadingReview = reviewLoading[key];
                    const errorReview = reviewError[key];
                    const ideal = ideals[key];
                    const loadingIdeal = idealLoading[key];
                    const errorIdeal = idealError[key];

                    return (
                      <div key={key} className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-sm font-semibold text-white">{question}</p>
                        <textarea
                          className="mt-3 min-h-[120px] w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10"
                          placeholder="Type your answer..."
                          value={answers[key] ?? ""}
                          onChange={(event) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            className="primary"
                            onClick={() => submitReview(question, key)}
                            disabled={loadingReview || !(answers[key] ?? "").trim()}
                          >
                            {loadingReview ? "Reviewing..." : "Get feedback"}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => getIdealAnswer(question, key)}
                            disabled={loadingIdeal}
                          >
                            {loadingIdeal ? "Generating..." : "Show ideal answer"}
                          </button>
                          {review && (
                            <span className="text-xs text-slate-400">
                              Score: {review.score}
                            </span>
                          )}
                        </div>
                        {errorReview && (
                          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                            {errorReview}
                          </div>
                        )}
                        {errorIdeal && (
                          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                            {errorIdeal}
                          </div>
                        )}
                        {review && (
                          <div className="mt-4 grid gap-3 text-xs text-slate-200">
                            <p className="text-sm text-white">{review.summary}</p>
                            <div>
                              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                                Strengths
                              </p>
                              <ul className="mt-2 grid gap-1">
                                {(review.strengths ?? []).map((item, itemIndex) => (
                                  <li
                                    key={`${key}-s-${itemIndex}`}
                                    className="rounded-lg bg-white/5 px-2 py-1"
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                                Improvements
                              </p>
                              <ul className="mt-2 grid gap-1">
                                {(review.improvements ?? []).map((item, itemIndex) => (
                                  <li
                                    key={`${key}-i-${itemIndex}`}
                                    className="rounded-lg bg-white/5 px-2 py-1"
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                        {ideal && (
                          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
                            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-300">
                              Ideal answer
                            </p>
                            <p className="mt-2 text-sm text-emerald-50">
                              {ideal.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {raw && (
            <details className="panel text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold uppercase tracking-wide text-slate-400">
                Raw response
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-slate-200">
{raw}
              </pre>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
