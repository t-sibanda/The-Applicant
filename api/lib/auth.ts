import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const scryptAsync = promisify(scrypt);

/** Hash a password as `salt:hash` using scrypt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time verify of a password against a stored `salt:hash`. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

const secretKey = () => new TextEncoder().encode(env.sessionSecret);

export interface SessionClaims {
  userId: number;
  role: string;
}

/** Sign a session token valid for 30 days. */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ userId: claims.userId, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

/** Verify a session token; returns null if invalid/expired. */
export async function verifySession(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== "number" || typeof payload.role !== "string")
      return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}
