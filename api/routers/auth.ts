import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, authedProcedure } from "../trpc";
import {
  findUserByEmail,
  createUser,
  updateLastSignIn,
} from "../queries/users";
import { hashPassword, verifyPassword, signSession } from "../lib/auth";
import { checkRateLimit } from "../lib/rate-limit";
import {
  SESSION_COOKIE,
  Roles,
  UserStatus,
  SubscriptionTier,
} from "../../shared/constants";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function setSessionCookie(headers: Headers, token: string) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${
      30 * 24 * 60 * 60
    }; SameSite=Lax;${secure}`,
  );
}

function publicUser(u: {
  id: number;
  email: string;
  displayName: string | null;
  role: string;
  subscriptionTier: string;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.displayName,
    role: u.role,
    subscriptionTier: u.subscriptionTier,
  };
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        displayName: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      checkRateLimit(`register:${clientIp(ctx.req)}`, 5, 15 * 60 * 1000);

      const existing = await findUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with that email already exists.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user = await createUser({
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? input.email.split("@")[0],
        role: Roles.USER,
        status: UserStatus.ACTIVE,
        subscriptionTier: SubscriptionTier.FREE,
      });

      const token = await signSession({ userId: user.id, role: user.role });
      setSessionCookie(ctx.resHeaders, token);
      return { success: true, user: publicUser(user) };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      checkRateLimit(`login:${clientIp(ctx.req)}`, 10, 15 * 60 * 1000);

      const user = await findUserByEmail(input.email);
      // Generic message: don't reveal which field was wrong.
      const invalid = () =>
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });

      if (!user) {
        // Still run a hash to reduce timing signal.
        await verifyPassword(input.password, "x:y");
        throw invalid();
      }
      if (user.status === UserStatus.SUSPENDED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account is suspended. Contact support.",
        });
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        throw invalid();
      }

      await updateLastSignIn(user.id);
      const token = await signSession({ userId: user.id, role: user.role });
      setSessionCookie(ctx.resHeaders, token);
      return { success: true, user: publicUser(user) };
    }),

  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return publicUser(ctx.user);
  }),

  logout: authedProcedure.mutation(({ ctx }) => {
    ctx.resHeaders.append(
      "set-cookie",
      `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;`,
    );
    return { success: true };
  }),
});
