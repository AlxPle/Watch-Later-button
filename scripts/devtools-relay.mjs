#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.DEVTOOLS_RELAY_PORT || 3030);
const outputDir = path.resolve(process.cwd(), ".devtools-relay");
const outputFile = path.join(outputDir, "captures.ndjson");

fs.mkdirSync(outputDir, { recursive: true });

const send = (res, status, body) => {
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST,OPTIONS,GET",
        "access-control-allow-headers": "content-type"
    });
    res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
        send(res, 200, { ok: true });
        return;
    }

    if (req.url === "/health" && req.method === "GET") {
        send(res, 200, {
            ok: true,
            port,
            outputFile
        });
        return;
    }

    if (req.url !== "/capture" || req.method !== "POST") {
        send(res, 404, { ok: false, error: "Not found" });
        return;
    }

    let raw = "";
    req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 2_000_000) {
            req.destroy();
        }
    });

    req.on("end", () => {
        try {
            const payload = raw ? JSON.parse(raw) : {};
            const entry = {
                ts: new Date().toISOString(),
                url: req.headers.origin || req.headers.referer || "unknown",
                payload
            };
            fs.appendFileSync(outputFile, `${JSON.stringify(entry)}\n`, "utf8");
            send(res, 200, {
                ok: true,
                savedTo: outputFile
            });
        } catch (error) {
            send(res, 400, {
                ok: false,
                error: error instanceof Error ? error.message : "Invalid JSON"
            });
        }
    });
});

server.listen(port, "127.0.0.1", () => {
    console.log(`[devtools-relay] listening on http://127.0.0.1:${port}`);
    console.log(`[devtools-relay] writing to ${outputFile}`);
});
