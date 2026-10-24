import { NextRequest, NextResponse } from "next/server";
import { RegisterInputSchema } from "@syapa/shared";
import { UserRepository } from "@syapa/db";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, email, password } = parsed.data;
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await UserRepository.createUser({ name, email, passwordHash });

    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    setSessionCookie(sessionToken);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to register" }, { status: 500 });
  }
}
