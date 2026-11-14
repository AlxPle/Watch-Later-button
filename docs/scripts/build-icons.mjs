import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../assets/icons/ui/", import.meta.url));
const icons = {};

for (const file of (await fs.readdir(source)).filter(file => file.endsWith(".svg")).sort()) {
    const svg = await fs.readFile(path.join(source, file), "utf8");
    icons[path.basename(file, ".svg")] = {
        viewBox: svg.match(/viewBox="([^"]+)"/)[1],
        body: svg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim()
    };
}

await fs.writeFile(new URL("../_data/ui_icons.json", import.meta.url), `${JSON.stringify(icons, null, 2)}\n`);
console.log(`Prepared ${Object.keys(icons).length} inline SVG icons.`);
