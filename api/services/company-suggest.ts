import { COMPANY_DIRECTORY, type CompanyEntry } from "./ats-boards";

/**
 * Rank employers from the curated directory against a user's profile and
 * search settings. Deterministic, no AI call, so it's instant and free.
 *
 * Signal:
 *  - tag overlap with the user's industry + role + free-text keywords
 *  - a light bonus for companies we can actually pull listings from
 *    (greenhouse/lever/ashby) over external-only careers links
 */

export interface SuggestInputs {
  industry?: string | null;
  role?: string | null;
  keywords?: string[];
  limit?: number;
}

export interface CompanySuggestion {
  name: string;
  ats: CompanyEntry["ats"];
  token?: string;
  careersUrl?: string;
  tags: string[];
  score: number;
  searchable: boolean; // true when we can pull this company's listings directly
}

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export function suggestCompanies(inputs: SuggestInputs): CompanySuggestion[] {
  const wants = new Set<string>([
    ...tokenize(inputs.industry ?? ""),
    ...tokenize(inputs.role ?? ""),
    ...(inputs.keywords ?? []).flatMap(tokenize),
  ]);

  const scored = COMPANY_DIRECTORY.map((c) => {
    const searchable = c.ats !== "external";
    let score = 0;

    // Tag overlap is the primary signal.
    for (const tag of c.tags) {
      for (const w of wants) {
        if (tag === w) score += 3;
        else if (tag.includes(w) || w.includes(tag)) score += 1;
      }
    }
    // Company-name mention in keywords is a strong direct signal.
    const nameTokens = tokenize(c.name);
    if (nameTokens.some((n) => wants.has(n))) score += 6;

    // Small nudge toward companies whose jobs we can actually fetch.
    if (searchable) score += 0.5;

    return {
      name: c.name,
      ats: c.ats,
      token: c.token,
      careersUrl: c.careersUrl,
      tags: c.tags,
      score,
      searchable,
    };
  });

  // If the user has given us nothing to match on, return a sensible default
  // set (searchable, well-known employers) rather than an empty list.
  const hasSignal = wants.size > 0 && scored.some((s) => s.score > 0.5);
  const ranked = hasSignal
    ? scored.filter((s) => s.score > 0.5).sort((a, b) => b.score - a.score)
    : scored.filter((s) => s.searchable).sort((a, b) => b.score - a.score);

  return ranked.slice(0, inputs.limit ?? 12);
}
