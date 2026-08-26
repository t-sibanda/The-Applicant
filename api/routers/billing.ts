import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../trpc";
import {
  isPaymentsEnabled,
  availablePlans,
  createCheckoutSession,
} from "../services/payments";

export const billingRouter = router({
  status: authedProcedure.query(({ ctx }) => ({
    enabled: isPaymentsEnabled(),
    plans: availablePlans(),
    currentTier: ctx.user.subscriptionTier,
  })),

  createCheckout: authedProcedure
    .input(
      z.object({
        planId: z.enum(["basic", "pro"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isPaymentsEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured on this deployment.",
        });
      }
      const session = await createCheckoutSession({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        planId: input.planId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create checkout session.",
        });
      }
      return session;
    }),
});
