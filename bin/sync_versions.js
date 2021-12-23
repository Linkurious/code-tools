#!/usr/bin/env node

/*
 syncs versions in
  - package.json
  - .version
  - .bumpversion.cfg
*/

import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

const cfgPath = path.join(process.cwd(), ".bumpversion.cfg");
const versionPath = path.join(process.cwd(), ".version");

let version = "0.0.0";

fs.readFile(path.join(process.cwd(), "package.json"), "utf8")
  .then((packageJson) => (version = JSON.parse(packageJson).version))
  .then(() => fs.readFile(cfgPath, "utf8"))
  .then((cfg) => {
    const updated = cfg.replace(
      /current_version\s*=\s*[^\n]*/i,
      `current_version = ${version}`
    );
    return fs.writeFile(cfgPath, updated, "utf8");
  })
  .then(() => fs.writeFile(versionPath, version, "utf8"))
  .catch((e) => {
    console.error(chalk.red("sync_versions:"), e.path, "does not exist");
    process.exit(1);
  });
