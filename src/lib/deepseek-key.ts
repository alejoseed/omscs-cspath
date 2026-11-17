import { z } from "zod";

export const deepseekKeySchema = z
  .string()
  .trim()
  .max(200, "That DeepSeek key is too long.")
  .regex(/^[\x21-\x7e]*$/, "That DeepSeek key has characters an API key never contains.");
