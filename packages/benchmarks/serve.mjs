import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join, resolve, sep } from "node:path";
import { cache, profiles, directory } from "./config.mjs";

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const allowed = new Set(profiles.flatMap((profile) => [profile.id, `contracts-${profile.id}`]));
const port = Number(process.env.PORT ?? 4174);
const token = randomUUID();
const server = createServer(async (request, response) => {
  try {
    const host = request.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      response.writeHead(403).end();
      return;
    }
    const url = new URL(request.url, `http://${host}`);
    if (request.method === "POST" && url.pathname === "/results") {
      if (request.headers.origin !== url.origin || request.headers["x-benchmark-token"] !== token) {
        response.writeHead(403).end();
        return;
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const manifest = JSON.parse(await readFile(join(cache, "manifest.json"), "utf8"));
      if (
        data.fixtureHash !== manifest.fixtureHash ||
        !Array.isArray(data.runs) ||
        !Array.isArray(data.contracts)
      ) {
        response.writeHead(400).end();
        return;
      }
      await writeFile(join(cache, "browser.json"), JSON.stringify(data, null, 2));
      response.writeHead(204).end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    if (url.pathname === "/" || url.pathname === "/collect.mjs") {
      const configuration = JSON.stringify({
        profiles: profiles.map((profile) => profile.id),
        token,
      });
      const html = `<!doctype html><meta charset="utf-8"><title>SVG benchmark collector</title><button>Run browser matrix</button> <output>Ready</output><iframe style="display:block;width:1200px;height:720px;border:0"></iframe><script type="application/json" id="configuration">${configuration}</script><script type="module" src="/collect.mjs"></script>`;
      response
        .writeHead(200, {
          "Content-Type": url.pathname === "/" ? "text/html" : "text/javascript",
          "Cache-Control": "no-store",
        })
        .end(url.pathname === "/" ? html : await readFile(join(directory, "collect.mjs")));
      return;
    }
    if (url.pathname === "/manifest.json") {
      response
        .writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
        .end(await readFile(join(cache, "manifest.json")));
      return;
    }
    let file;
    const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
    if (parts[0] === "icons" && /^[a-z0-9_-]+\.svg$/.test(parts[1] ?? "") && parts.length === 2) {
      file = join(cache, "better-raw", "icons", parts[1]);
      try {
        await stat(file);
      } catch {
        file = join(cache, "contracts-better-raw", "icons", parts[1]);
      }
    } else {
      if (!allowed.has(parts[0])) {
        response.writeHead(404).end();
        return;
      }
      const folder = join(cache, parts[0], "dist");
      file = resolve(folder, parts.slice(1).join("/") || "index.html");
      if (!file.startsWith(`${folder}${sep}`)) {
        response.writeHead(400).end();
        return;
      }
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": extname(file) === ".svg" ? "public, max-age=3600" : "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Benchmark worker listening on http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
