import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const SCRIPT_PATH = path.join(process.cwd(), "bin", "sync_versions.js");

/**
 * Creates a temporary directory with the given files
 * @param {Record<string, string>} files - filename -> content mapping
 * @returns {Promise<string>} - path to temp directory
 */
async function createTempDir(files) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync_versions_test_"));
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(tempDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
  return tempDir;
}

/**
 * Runs the sync_versions.js script in the given directory
 * @param {string} cwd - working directory
 * @returns {{ success: boolean, stdout: string, stderr: string }}
 */
function runScript(cwd) {
  try {
    const stdout = execSync(`node ${SCRIPT_PATH}`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, stdout, stderr: "" };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    };
  }
}

/**
 * Reads and parses a JSON file
 */
async function readJSON(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

/**
 * Reads a file as text
 */
async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

describe("sync_versions.js", () => {
  let tempDir;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  describe("basic version sync", () => {
    test("syncs version from package.json to .bumpversion.cfg and .version", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "2.5.0" }),
        ".bumpversion.cfg": "[bumpversion]\ncurrent_version = 1.0.0\n",
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true, `Script failed: ${result.stderr}`);

      // Check .version file
      const versionContent = await readText(path.join(tempDir, ".version"));
      assert.strictEqual(versionContent, "2.5.0");

      // Check .bumpversion.cfg
      const cfgContent = await readText(path.join(tempDir, ".bumpversion.cfg"));
      assert.match(cfgContent, /current_version = 2\.5\.0/);
    });

    test("handles version with prerelease tag", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "1.0.0-beta.1" }),
        ".bumpversion.cfg": "[bumpversion]\ncurrent_version = 0.0.0\n",
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const versionContent = await readText(path.join(tempDir, ".version"));
      assert.strictEqual(versionContent, "1.0.0-beta.1");
    });

    test("preserves other content in .bumpversion.cfg", async () => {
      const originalCfg = `[bumpversion]
current_version = 1.0.0
commit = True
tag = True

[bumpversion:file:package.json]
`;
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "3.0.0" }),
        ".bumpversion.cfg": originalCfg,
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const cfgContent = await readText(path.join(tempDir, ".bumpversion.cfg"));
      assert.match(cfgContent, /current_version = 3\.0\.0/);
      assert.match(cfgContent, /commit = True/);
      assert.match(cfgContent, /tag = True/);
      assert.match(cfgContent, /\[bumpversion:file:package\.json\]/);
    });

    test("handles different whitespace around current_version", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "1.2.3" }),
        ".bumpversion.cfg": "[bumpversion]\ncurrent_version=0.0.0\n",
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const cfgContent = await readText(path.join(tempDir, ".bumpversion.cfg"));
      assert.match(cfgContent, /current_version = 1\.2\.3/);
    });
  });

  describe("JSON file updates from bumpversion sections", () => {
    test("updates version in JSON files specified in bumpversion config", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "4.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:manifest.json]
`,
        "manifest.json": JSON.stringify({ name: "manifest", version: "1.0.0" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true, `Script failed: ${result.stderr}`);

      const manifest = await readJSON(path.join(tempDir, "manifest.json"));
      assert.strictEqual(manifest.version, "4.0.0");
    });

    test("updates multiple JSON files", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "5.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:manifest.json]

[bumpversion:file:config.json]
`,
        "manifest.json": JSON.stringify({ version: "1.0.0" }),
        "config.json": JSON.stringify({ version: "1.0.0", other: "data" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const manifest = await readJSON(path.join(tempDir, "manifest.json"));
      const config = await readJSON(path.join(tempDir, "config.json"));

      assert.strictEqual(manifest.version, "5.0.0");
      assert.strictEqual(config.version, "5.0.0");
      assert.strictEqual(config.other, "data"); // preserved
    });

    test("ignores non-JSON files in bumpversion config", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "2.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:setup.py]

[bumpversion:file:manifest.json]
`,
        "manifest.json": JSON.stringify({ version: "1.0.0" }),
        "setup.py": "version = '1.0.0'",
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      // setup.py should be unchanged
      const setupContent = await readText(path.join(tempDir, "setup.py"));
      assert.strictEqual(setupContent, "version = '1.0.0'");

      // manifest.json should be updated
      const manifest = await readJSON(path.join(tempDir, "manifest.json"));
      assert.strictEqual(manifest.version, "2.0.0");
    });

    test("handles JSON files in subdirectories", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "6.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:src/manifest.json]
`,
        "src/manifest.json": JSON.stringify({ version: "1.0.0" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const manifest = await readJSON(path.join(tempDir, "src", "manifest.json"));
      assert.strictEqual(manifest.version, "6.0.0");
    });
  });

  describe("pluginApiVersion field update", () => {
    test("updates pluginApiVersion when present", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "7.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:manifest.json]
`,
        "manifest.json": JSON.stringify({
          name: "plugin",
          version: "1.0.0",
          pluginApiVersion: "1.0.0",
        }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const manifest = await readJSON(path.join(tempDir, "manifest.json"));
      assert.strictEqual(manifest.version, "7.0.0");
      assert.strictEqual(manifest.pluginApiVersion, "7.0.0");
    });

    test("does not add pluginApiVersion if not present", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "8.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:manifest.json]
`,
        "manifest.json": JSON.stringify({ name: "plugin", version: "1.0.0" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const manifest = await readJSON(path.join(tempDir, "manifest.json"));
      assert.strictEqual(manifest.version, "8.0.0");
      assert.strictEqual(manifest.pluginApiVersion, undefined);
    });
  });

  describe("error handling", () => {
    test("fails when package.json is missing", async () => {
      tempDir = await createTempDir({
        ".bumpversion.cfg": "[bumpversion]\ncurrent_version = 1.0.0\n",
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, false);
      assert.match(result.stderr, /sync_versions:/);
    });

    test("fails when .bumpversion.cfg is missing", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "1.0.0" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, false);
      assert.match(result.stderr, /sync_versions:/);
    });

    test("fails when referenced JSON file is missing", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "1.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:missing.json]
`,
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, false);
      assert.match(result.stderr, /sync_versions:/);
    });

    test("fails when package.json has invalid JSON", async () => {
      tempDir = await createTempDir({
        "package.json": "{ invalid json }",
        ".bumpversion.cfg": "[bumpversion]\ncurrent_version = 1.0.0\n",
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, false);
    });
  });

  describe("edge cases", () => {
    test("handles empty bumpversion file sections", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "9.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0
`,
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const versionContent = await readText(path.join(tempDir, ".version"));
      assert.strictEqual(versionContent, "9.0.0");
    });

    test("handles JSON file without version field", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "10.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:config.json]
`,
        "config.json": JSON.stringify({ setting: "value" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const config = await readJSON(path.join(tempDir, "config.json"));
      assert.strictEqual(config.version, undefined);
      assert.strictEqual(config.setting, "value");
    });

    test("preserves JSON formatting with 2-space indent", async () => {
      tempDir = await createTempDir({
        "package.json": JSON.stringify({ name: "test", version: "11.0.0" }),
        ".bumpversion.cfg": `[bumpversion]
current_version = 1.0.0

[bumpversion:file:manifest.json]
`,
        "manifest.json": JSON.stringify({ version: "1.0.0" }),
      });

      const result = runScript(tempDir);
      assert.strictEqual(result.success, true);

      const content = await readText(path.join(tempDir, "manifest.json"));
      // Should be formatted with 2-space indent
      assert.match(content, /^{\n {2}"version"/);
    });
  });
});
