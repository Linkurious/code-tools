#!/usr/bin/env node

import fs from "fs";
import { copyFile } from "fs/promises";
import path from "path";
import { parseArgs } from "util";
import chalk from "chalk";

const { values } = parseArgs({
  options: {
    verbose: { type: "boolean", short: "v" },
  },
});
const verbose = values.verbose || false;

const log = (str, force = false) => {
  if (verbose || force) console.log(str);
};

/**
 *
 * @param {string} source
 * @returns {string[]}
 */
const getDirectories = (source) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((file) => file.isDirectory())
    .map((dir) => dir.name);

const src = path.join(process.cwd(), ".npmrc");
if (fs.existsSync(src)) {
  Promise.all(
    getDirectories(path.join(process.cwd(), "packages")).map((packageName) => {
      const dest = path.join(process.cwd(), "packages", packageName, ".npmrc");
      log(chalk.green(` - Copying ${src} to ${dest}`));
      return copyFile(src, dest);
    })
  ).then(() => log(chalk.green(" .npmrc files copied to subpackages"), true));
}
