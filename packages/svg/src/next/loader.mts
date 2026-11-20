import { loadSvg, type LoaderContext } from "./load.js";

export default function loader(this: LoaderContext, source: string) {
  const done = this.async();
  loadSvg(this, source).then(
    (result) => done(null, result),
    (cause: unknown) => done(cause instanceof Error ? cause : new Error(String(cause))),
  );
}
