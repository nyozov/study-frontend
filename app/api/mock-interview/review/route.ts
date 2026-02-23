import { NextResponse } from "next/server";

type ReviewRequest = {
  question?: string;
  answer?: string;
  jobTitle?: string;
};

export async function POST(req: Request) {
  let body: ReviewRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.question || !body.question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (!body.answer || !body.answer.trim()) {
    return NextResponse.json({ error: "answer is required" }, { status: 400 });
  }

  const baseUrl = process.env.STUDY_API_URL ?? "http://localhost:8080";
  const targetUrl = `${baseUrl.replace(/\/$/, "")}/api/mock-interview/review`;

  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: body.question.trim(),
      answer: body.answer.trim(),
      jobTitle: body.jobTitle ?? "",
    }),
  });

  const text = await upstream.text();

  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
