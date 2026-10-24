import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma, UserRepository, ApiTokenRepository } from "@syapa/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET || "syapa-super-secret-development-key-32chars"
);

const COOKIE_NAME = "syapa_session";

export interface UserSessionPayload {
  userId: string;
  email: string;
  name?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Authenticates the request from either:
 * 1. Web session cookie (`syapa_session`)
 * 2. Extension Bearer token (`Authorization: Bearer syp_...`)
 * 3. Extension header (`x-api-token: syp_...`)
 */
export async function authenticateRequest(req?: NextRequest): Promise<{ userId: string; email: string; name?: string | null } | null> {
  // 1. Check API token header (Extension)
  if (req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-token");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token.startsWith("syp_")) {
        const apiToken = await ApiTokenRepository.validateToken(token);
        if (apiToken && apiToken.user) {
          return {
            userId: apiToken.userId,
            email: apiToken.user.email,
            name: apiToken.user.name,
          };
        }
      }
    }
  }

  // 2. Check Cookie (Web browser)
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie?.value) return null;

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload?.userId) return null;

    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
