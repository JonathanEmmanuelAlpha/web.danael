/**
 * Ambient module declaration for `z-ai-web-dev-sdk`.
 *
 * The package is an OPTIONAL runtime dependency. It is only loaded dynamically
 * in `server/services/ai-questions.ts`; the files under `/skills/*` use it
 * directly but those scripts are not part of the application bundle.
 *
 * When the package isn't installed (sandbox, CI, etc.) the AI service falls
 * back to placeholder questions so the teacher validation UI still works
 * end-to-end.
 *
 * This very loose stub lets TypeScript compile in environments where the
 * package isn't present (so `bunx tsc --noEmit` doesn't fail on the dynamic
 * import). When the real package IS installed, its bundled `.d.ts` types take
 * precedence over this ambient declaration (TypeScript prefers concrete
 * modules over ambient declarations).
 *
 * We intentionally keep the typing loose here to avoid constraining the varied
 * call sites under `/skills/*`.
 */
declare module "z-ai-web-dev-sdk" {
  // The SDK's surface area is wide and varies across versions. We expose a
  // minimal, permissive shape so our own code (server/services/ai-questions.ts)
  // type-checks, while leaving the /skills/* call sites unconstrained.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const ZAI: any;
  export default ZAI;

  // Allow named imports used elsewhere (skills/*) — typed loosely.
  export const chat: any;
  export const audio: any;
  export const images: any;
  export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string | unknown;
  };
  export type VisionMessage = {
    role: "system" | "user" | "assistant";
    content: unknown;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
