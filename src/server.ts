/**
 * Dev server — serves .html files and transpiles .ts → .js on the fly.
 *
 * Run: npx tsx src/server.ts
 * Open: http://localhost:3000/src/examples/06-component.html
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";

const PORT = 3000;
const ROOT = process.cwd();

const MIME: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".ts": "application/javascript",
    ".css": "text/css",
};

const server = http.createServer((req, res) => {
    let url = req.url ?? "/";

    // Rewrite .js requests → .ts if .ts exists
    let filePath = path.join(ROOT, url);
    if (url.endsWith(".js")) {
        const tsPath = filePath.replace(/\.js$/, ".ts");
        if (fs.existsSync(tsPath)) {
            filePath = tsPath;
        }
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] ?? "application/octet-stream";

    let content = fs.readFileSync(filePath, "utf-8");

    // Transpile TypeScript on the fly
    if (ext === ".ts") {
        const result = transformSync(content, {
            loader: "ts",
            format: "esm",
            target: "es2020",
            tsconfigRaw: JSON.stringify({
                compilerOptions: { experimentalDecorators: true },
            }),
        });
        content = result.code;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
});

server.listen(PORT, () => {
    console.log(`Dev server: http://localhost:${PORT}/src/examples/06-component.html`);
});
