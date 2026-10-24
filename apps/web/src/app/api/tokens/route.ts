import { NextRequest, NextResponse } from "next/server";
import { CreateApiTokenInputSchema } from "@syapa/shared";
import { ApiTokenRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await ApiTokenRepository.listByUser(user.userId);
  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateApiTokenInputSchema.safeParse(body);
  const name = parsed.success ? parsed.data.name : "Chrome Extension";
  const expiresInDays = parsed.success ? parsed.data.expiresInDays : 30;

  const token = await ApiTokenRepository.createToken(user.userId, name, expiresInDays);
  return NextResponse.json({ token }, { status: 201 });
}
