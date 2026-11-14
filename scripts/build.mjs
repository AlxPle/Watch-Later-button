import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DIST_CHROME_DIR = path.join(DIST_DIR, "chrome");
const DIST_FIREFOX_DIR = path.join(DIST_DIR, "firefox");

const args = process.argv.slice(2);
const NO_ZIP = args.includes("--no-zip");

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab";
const FIREFOX_STORE_URL = "https://addons.mozilla.org/firefox/addon/watchlaterbutton/";

const URL_CONFIG = {
  chrome: {
    "{{STORE_URL}}": CHROME_STORE_URL,
    "{{REVIEWS_URL}}": `${CHROME_STORE_URL}/reviews`,
    "{{SUPPORT_URL}}": `${CHROME_STORE_URL}/support`
  },
  firefox: {
    "{{STORE_URL}}": FIREFOX_STORE_URL,
    "{{REVIEWS_URL}}": `${FIREFOX_STORE_URL}reviews/`,
    "{{SUPPORT_URL}}": "https://watchlater.alxple.com/"
  }
};

const IGNORED_FILES = new Set(["manifest.base.json", "manifest.json", ".DS_Store", "Thumbs.db"]);

function validateJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Failed to parse JSON file at: ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }
}

function validateAllJsonFiles() {
  const baseManifestPath = path.join(SRC_DIR, "manifest.base.json");
  if (!fs.existsSync(baseManifestPath)) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Base manifest not found at: ${baseManifestPath}`);
    process.exit(1);
  }
  const baseManifest = validateJsonFile(baseManifestPath);

  const localesDir = path.join(SRC_DIR, "_locales");
  if (fs.existsSync(localesDir)) {
    const localeFolders = fs.readdirSync(localesDir);
    for (const locale of localeFolders) {
      const messagesPath = path.join(localesDir, locale, "messages.json");
      if (fs.existsSync(messagesPath)) {
        validateJsonFile(messagesPath);
      }
    }
  }

  return baseManifest;
}

function copyDirectory(src, dest, target) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (IGNORED_FILES.has(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, target);
    } else {
      if (entry.name.endsWith(".html")) {
        let content = fs.readFileSync(srcPath, "utf8");
        const replacements = URL_CONFIG[target];
        for (const [placeholder, val] of Object.entries(replacements)) {
          content = content.replaceAll(placeholder, val);
        }
        fs.writeFileSync(destPath, content, "utf8");
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function generateManifests(baseManifest) {
  // Chrome manifest
  const chromeManifest = {
    ...baseManifest,
    background: {
      service_worker: "background.js"
    }
  };
  fs.writeFileSync(
    path.join(DIST_CHROME_DIR, "manifest.json"),
    JSON.stringify(chromeManifest, null, 2) + "\n",
    "utf8"
  );

  // Firefox manifest
  const firefoxManifest = {
    ...baseManifest,
    browser_specific_settings: {
      gecko: {
        id: "pletnov.alex@gmail.com",
        data_collection_permissions: {
          required: ["none"]
        }
      }
    },
    background: {
      scripts: ["background.js"]
    }
  };
  fs.writeFileSync(
    path.join(DIST_FIREFOX_DIR, "manifest.json"),
    JSON.stringify(firefoxManifest, null, 2) + "\n",
    "utf8"
  );
}

function postBuildLint(targetDir, targetName) {
  function checkFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkFiles(fullPath);
      } else {
        const isHtml = entry.name.endsWith(".html");
        const isJs = entry.name.endsWith(".js");

        if (isHtml || isJs) {
          const content = fs.readFileSync(fullPath, "utf8");

          // Unresolved template tokens check in all html/js files
          const tokenMatch = content.match(/\{\{[A-Z_]+\}\}/g);
          if (tokenMatch) {
            console.error(`\x1b[31m[LINT ERROR]\x1b[0m Unresolved placeholders ${tokenMatch.join(", ")} in ${fullPath}`);
            process.exit(1);
          }

          // Mozilla store policy: no Chrome Web Store references in Firefox build
          if (targetName === "firefox" && content.includes("chromewebstore.google.com")) {
            console.error(`\x1b[31m[LINT ERROR]\x1b[0m Forbidden reference to 'chromewebstore.google.com' found in Firefox build: ${fullPath}`);
            process.exit(1);
          }
        }
      }
    }
  }

  checkFiles(targetDir);
}

function createZipArchive(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const isWindows = process.platform === "win32";
  if (isWindows) {
    const psScript = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $src = '${sourceDir.replaceAll("\\", "/")}';
      $dst = '${zipPath.replaceAll("\\", "/")}';
      $archive = [System.IO.Compression.ZipFile]::Open($dst, 'Create');
      Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($src.Length + 1).Replace('\\', '/');
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel) | Out-Null;
      };
      $archive.Dispose();
    `;
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
      stdio: "inherit"
    });
  } else {
    execFileSync("zip", ["-r", "-q", zipPath, "."], {
      cwd: sourceDir,
      stdio: "inherit"
    });
  }
}

function build() {
  console.log("\x1b[36m[BUILD]\x1b[0m Starting Watch Later Button build...");
  const startTime = Date.now();

  // Step 1: Validate all JSON files
  console.log("  → Validating JSON and locales...");
  const baseManifest = validateAllJsonFiles();
  const version = baseManifest.version || "1.0.0";

  // Step 2: Clean and prepare dist directory
  console.log("  → Cleaning dist directory...");
  if (fs.existsSync(DIST_DIR)) {
    // Clean old unpacked directories and zip files
    fs.rmSync(DIST_CHROME_DIR, { recursive: true, force: true });
    fs.rmSync(DIST_FIREFOX_DIR, { recursive: true, force: true });
    const existingZips = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith(".zip"));
    for (const zip of existingZips) {
      fs.unlinkSync(path.join(DIST_DIR, zip));
    }
  } else {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Step 3: Copy assets and render HTML templates
  console.log("  → Assembling Chrome build...");
  copyDirectory(SRC_DIR, DIST_CHROME_DIR, "chrome");

  console.log("  → Assembling Firefox build...");
  copyDirectory(SRC_DIR, DIST_FIREFOX_DIR, "firefox");

  // Step 4: Generate target manifests
  console.log("  → Generating manifest.json for Chrome and Firefox...");
  generateManifests(baseManifest);

  // Step 5: Post-build lint
  console.log("  → Running post-build lint checks...");
  postBuildLint(DIST_CHROME_DIR, "chrome");
  postBuildLint(DIST_FIREFOX_DIR, "firefox");

  // Step 6: Create ZIP archives
  if (!NO_ZIP) {
    console.log("  → Creating release ZIP archives...");
    const chromeZipPath = path.join(DIST_DIR, `watch-later-chrome-v${version}.zip`);
    const firefoxZipPath = path.join(DIST_DIR, `watch-later-firefox-v${version}.zip`);

    createZipArchive(DIST_CHROME_DIR, chromeZipPath);
    createZipArchive(DIST_FIREFOX_DIR, firefoxZipPath);
    console.log(`    • ${path.basename(chromeZipPath)}`);
    console.log(`    • ${path.basename(firefoxZipPath)}`);
  } else {
    console.log("  → Skipping ZIP creation (--no-zip specified).");
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\x1b[32m[SUCCESS]\x1b[0m Build v${version} completed in ${duration}s!`);
}

build();
