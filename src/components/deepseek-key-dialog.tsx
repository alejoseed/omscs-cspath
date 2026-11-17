import { useState, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export function DeepseekKeyDialog() {
  const savedKey = useDeepseekKey();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border bg-card/60 p-2 text-xs leading-none font-bold transition-colors hover:border-foreground/30"
        >
          <span
            className={cn(
              "size-2 rounded-full",
              savedKey ? "bg-high" : "border border-muted-foreground/50",
            )}
          />
          DeepSeek key
        </button>
      </DialogTrigger>

      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-bold">DeepSeek API key</DialogTitle>
        </DialogHeader>

        {savedKey ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
            <span className="text-sm tabular-nums">{mask(savedKey)}</span>
            <button
              type="button"
              onClick={clearKey}
              className="rounded-md p-2 text-xs leading-none text-muted-foreground transition-colors hover:text-destructive"
            >
              Remove
            </button>
          </div>
        ) : (
          <form
            className="flex gap-2"
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
              className="min-w-0 flex-1 rounded-md border border-border bg-background p-2 text-sm leading-none outline-none focus:border-foreground/40"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="shrink-0 rounded-md bg-foreground p-2 text-xs leading-none font-bold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noreferrer"
          className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Get a key
        </a>
      </DialogContent>
    </Dialog>
  );
}
