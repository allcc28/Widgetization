// Pure diff helpers for showing what an update changed. No UI imports.

export type DiffKind = "same" | "add" | "del";
export interface DiffPart<T = string> {
  kind: DiffKind;
  value: T;
}

/** Longest-common-subsequence diff of two token lists. */
export function diffTokens<T>(before: readonly T[], after: readonly T[]): DiffPart<T>[] {
  const n = before.length;
  const m = after.length;
  // lcs[i][j] = length of the LCS of before[i..] and after[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        before[i] === after[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const out: DiffPart<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ kind: "same", value: before[i] as T });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "del", value: before[i] as T });
      i++;
    } else {
      out.push({ kind: "add", value: after[j] as T });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", value: before[i++] as T });
  while (j < m) out.push({ kind: "add", value: after[j++] as T });
  return out;
}

/** Below this share of common words, a word-by-word diff is just noise: show a whole replacement. */
const MIN_SHARED_WORDS = 0.5;

/**
 * Word-level diff of two texts. Whitespace is kept, and neighbouring parts of one kind are
 * merged. If the texts hardly share any words (a rewrite, not an edit), the result is the whole
 * old text removed and the whole new text added, which reads better than interleaved fragments.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const tokenize = (s: string) => s.split(/(\s+)/).filter((t) => t !== "");
  const parts = diffTokens(tokenize(before), tokenize(after));

  const words = (s: string) => tokenize(s).filter((t) => t.trim() !== "").length;
  const shared = parts.filter((p) => p.kind === "same" && p.value.trim() !== "").length;
  const longest = Math.max(words(before), words(after));
  if (before !== after && longest > 0 && shared / longest < MIN_SHARED_WORDS) {
    return [
      { kind: "del", value: before },
      { kind: "add", value: after },
    ];
  }

  const merged: DiffPart[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.kind === part.kind) last.value += part.value;
    else merged.push({ ...part });
  }
  return merged;
}
