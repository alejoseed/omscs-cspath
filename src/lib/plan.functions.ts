import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";
import { deepseekKeySchema } from "@/lib/deepseek-key";
import { generatePlans } from "@/lib/plan.server";
import { clientKey } from "@/lib/rate-limit.server";

const planInput = z.object({
  interests: z.record(z.string(), z.enum(["high", "medium", "low"])),
  deepseekApiKey: deepseekKeySchema.optional(),
});

export const createPlan = createServerFn({ method: "POST" })
  .validator(planInput)
  .handler(async ({ data }) => {
    const outcome = await generatePlans(
      data.interests,
      clientKey(getRequest()),
      data.deepseekApiKey || null,
    );
    if (!outcome.ok) {
      setResponseStatus(outcome.status);
      if (outcome.retryAfterSeconds) {
        setResponseHeader("retry-after", String(outcome.retryAfterSeconds));
      }
      throw new Error(outcome.error);
    }
    return outcome.data;
  });
