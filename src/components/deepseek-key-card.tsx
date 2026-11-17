import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { deepseekKeySchema } from "@/lib/deepseek-key";
import {
  clearKey,
  getKeyServerSnapshot,
  getKeySnapshot,
  saveKey,
  subscribeKey,
} from "@/lib/deepseek-key-store";

export function useDeepseekKey(): string | null {
  return useSyncExternalStore(subscribeKey, getKeySnapshot, getKeyServerSnapshot);
}

function mask(key: string): string {
  return key.length > 10 ? `${key.slice(0, 3)}…${key.slice(-4)}` : "••••";
}

export function DeepseekKeyCard() {
  const savedKey = useDeepseekKey();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = deepseekKeySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That DeepSeek key doesn't look right.");
      return;
    }
    if (!parsed.data) return;
    saveKey(parsed.data);
    setDraft("");
    setError(null);
  };

  return (
    <div className="mb-3 rounded-xl border border-border bg-card/40 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Your DeepSeek key
        </h2>
        <span
          className={cn(
            "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            savedKey
              ? "border-high/40 bg-high/10 text-foreground/80"
              : "border-border text-muted-foreground",
          )}
        >
          {savedKey ? "DeepSeek ready" : "Solver only"}
        </span>
      </div>

      {savedKey ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-foreground/80">{mask(savedKey)}</span>
          <button
            type="button"
            onClick={clearKey}
            className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-destructive"
          >
            Remove key
          </button>
        </div>
      ) : (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor="deepseek-key" className="sr-only">
            DeepSeek API key
          </label>
          <input
            id="deepseek-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] outline-none focus:border-foreground/40"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 rounded-md bg-foreground px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-widest text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </form>
      )}

      {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Optional. Bring your own key from{" "}
        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          platform.deepseek.com
        </a>{" "}
        to get DeepSeek&apos;s written ranking. It stays in this browser and is only sent with your
        plan runs; it is never stored on the server. Without it, plans are solver-ranked.
      </p>
    </div>
  );
}
