import { SVG } from "@mhaadi/svg/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/svg")({
  component: SvgDemoPage,
});

const INLINE_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="52" height="52" rx="12" fill="currentColor" />
  <path d="M20 32h24" stroke="#0f172a" stroke-width="6" stroke-linecap="round" />
  <path d="M32 20v24" stroke="#0f172a" stroke-width="6" stroke-linecap="round" />
</svg>`;

function SvgDemoPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">SVG Demo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Local name lookup and inline markup rendering using @mhaadi/svg.
      </p>
      <div className="mt-6 grid gap-4">
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-medium">Local asset (name)</h2>
          <div className="mt-3 flex items-center gap-4">
            <SVG
              name="logo"
              className="h-12 w-12 text-emerald-400"
              aria-label="Local logo"
            />
            <span className="text-xs text-muted-foreground">/assets/svg/logo.svg</span>
          </div>
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-medium">Inline SVG markup</h2>
          <div className="mt-3 flex items-center gap-4">
            <SVG
              src={INLINE_SVG}
              className="h-12 w-12 text-indigo-400"
              aria-label="Inline plus"
            />
            <span className="text-xs text-muted-foreground">Inline &lt;svg&gt; string</span>
          </div>
        </section>
      </div>
    </div>
  );
}
