// Ambient fallbacks for optional dependencies. These packages are listed in
// optionalDependencies and may not be installed in every environment (for
// example a minimal local dev install). When the real package IS installed,
// TypeScript resolves its own bundled types first and these declarations are
// ignored, so there is no risk of conflicts.

declare module "@supabase/supabase-js" {
  // Minimal surface used by api/services/storage.ts. The real package's
  // types take precedence whenever it is installed.
  export function createClient(
    url: string,
    key: string,
    opts?: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any;
}
