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

function updateJSON(filename, version) {
  const filepath = path.join(process.cwd(), filename) 
  return fs.readFile(filepath, "utf8")
    .then((fileContent) => JSON.parse(fileContent))
    .then((json) => {
      if (json.version) {
        json.version = version;
      }
      // lke-plugins manifest update
      if (json.pluginApiVersion) {
        json.pluginApiVersion = version;
      }
      return fs.writeFile(filepath, JSON.stringify(json, 0,2));
    })
}
fs.readFile(path.join(process.cwd(), "package.json"), "utf8")
  .then((packageJson) => (version = JSON.parse(packageJson).version))
  .then(() => fs.readFile(cfgPath, "utf8"))
  .then((cfg) => {
    const updated = cfg.replace(
      /current_version\s*=\s*[^\n]*/i,
      `current_version = ${version}`
    );
    // update the files specified in the .bumpversion file
    const matches = cfg.match(/\[bumpversion:file:(.*)\]/g);
    let updateFiles = Promise.resolve();
    if (matches && matches.length) {
      updateFiles = updateFiles.then(() => Promise.all(matches
        .map(m => m.match(/\[bumpversion:file:(.*)\]/)[1])
        .filter(filepath => filepath && filepath.endsWith('.json'))
        .map(filepath =>  updateJSON(filepath, version))));
    }
    return updateFiles.then(() => fs.writeFile(cfgPath, updated, "utf8"));
  })
  .then(() => fs.writeFile(versionPath, version, "utf8"))
  .catch((e) => {
    console.error(chalk.red("sync_versions:"), e.path, "does not exist");
    process.exit(1);
  });
