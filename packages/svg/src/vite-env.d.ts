/// <reference types="vite/client" />

interface ImportMeta {
  glob: (
    pattern: string | string[],
    options?: { eager?: boolean; import?: string; query?: string },
  ) => Record<string, string>;
}
