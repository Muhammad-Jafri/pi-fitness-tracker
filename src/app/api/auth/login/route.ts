import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (
    username === process.env.AUTH_USERNAME &&
    password === process.env.AUTH_PASSWORD
  ) {
    await createSession();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
