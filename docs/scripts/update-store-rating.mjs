#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const STORE_URL = "https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab";
const DATA_PATH = path.resolve(process.cwd(), "_data/store_rating.json");
const DRY_RUN = process.argv.includes("--dry-run");

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9"
                }
            },
            (res) => {
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    body += chunk;
                });
                res.on("end", () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`Request failed with status ${res.statusCode}`));
                        return;
                    }
                    resolve(body);
                });
            }
        );

        req.on("error", reject);
        req.setTimeout(20000, () => {
            req.destroy(new Error("Request timeout"));
        });
    });
}

function extractFirst(html, patterns) {
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

function normalizeRatingValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > 5) {
        return null;
    }
    return n.toFixed(1);
}

function normalizeRatingCount(value) {
    const digits = String(value).replace(/[^\d]/g, "");
    if (!digits) {
        return null;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 0) {
        return null;
    }
    return String(n);
}

function readCurrentData() {
    if (!fs.existsSync(DATA_PATH)) {
        return {
            ratingValue: "4.5",
            ratingCount: "26",
            source: STORE_URL,
            lastCheckedAt: null
        };
    }

    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
        ratingValue: String(parsed.ratingValue ?? "4.5"),
        ratingCount: String(parsed.ratingCount ?? "26"),
        source: parsed.source || STORE_URL,
        lastCheckedAt: parsed.lastCheckedAt ?? null
    };
}

function writeData(data) {
    fs.writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
    const current = readCurrentData();

    try {
        const html = await fetchHtml(STORE_URL);

        const rawValue = extractFirst(html, [
            /"starRating"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
            /"ratingValue"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i
        ]);

        const rawCount = extractFirst(html, [
            /"ratingCount"\s*:\s*"?([0-9,\.\s]+)"?/i,
            /"reviewCount"\s*:\s*"?([0-9,\.\s]+)"?/i
        ]);

        const nextValue = normalizeRatingValue(rawValue ?? current.ratingValue);
        const nextCount = normalizeRatingCount(rawCount ?? current.ratingCount);

        if (!nextValue || !nextCount) {
            throw new Error("Could not parse rating fields from store page");
        }

        const nextData = {
            ratingValue: nextValue,
            ratingCount: nextCount,
            source: STORE_URL,
            lastCheckedAt: new Date().toISOString()
        };

        if (DRY_RUN) {
            console.log("[dry-run] Parsed rating data:");
            console.log(JSON.stringify(nextData, null, 2));
            return;
        }

        writeData(nextData);
        console.log(`Updated ${DATA_PATH}`);
        console.log(`ratingValue=${nextData.ratingValue}, ratingCount=${nextData.ratingCount}`);
    } catch (error) {
        const fallbackData = {
            ...current,
            source: STORE_URL,
            lastCheckedAt: new Date().toISOString()
        };

        if (!DRY_RUN) {
            writeData(fallbackData);
        }

        console.warn("Could not refresh rating from Chrome Web Store. Keeping previous values.");
        console.warn(String(error.message || error));

        if (DRY_RUN) {
            console.log("[dry-run] Current fallback data:");
            console.log(JSON.stringify(fallbackData, null, 2));
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
