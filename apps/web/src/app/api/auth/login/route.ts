import { NextRequest, NextResponse } from "next/server";
import { LoginInputSchema } from "@syapa/shared";
import { UserRepository } from "@syapa/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await UserRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

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
    return NextResponse.json({ error: err.message || "Failed to log in" }, { status: 500 });
  }
}
