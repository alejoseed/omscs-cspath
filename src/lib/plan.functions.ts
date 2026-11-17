import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { generatePlans } from "@/lib/plan.server";
import { clientKey } from "@/lib/rate-limit.server";
import type { BucketId } from "@/lib/types";

export const createPlan = createServerFn({ method: "POST" })
  .validator((data: { interests: Record<string, BucketId> }) => data)
  .handler(async ({ data }) => {
    const outcome = await generatePlans(data?.interests, clientKey(getRequest()));
    if (!outcome.ok) {
      setResponseStatus(outcome.status);
      if (outcome.retryAfterSeconds) {
        setResponseHeader("retry-after", String(outcome.retryAfterSeconds));
      }
      throw new Error(outcome.error);
    }
    return outcome.data;
  });
