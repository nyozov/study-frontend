import { NextResponse } from "next/server";

type CourseGuideRequest = {
  prompt?: string;
};

export async function POST(req: Request) {
  let body: CourseGuideRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const baseUrl = process.env.STUDY_API_URL ?? "http://localhost:8080";
  const targetUrl = `${baseUrl.replace(/\/$/, "")}/api/course-guide`;

  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: body.prompt.trim() }),
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
