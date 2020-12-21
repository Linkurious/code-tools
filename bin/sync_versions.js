#!/usr/bin/env node

/*
 syncs versions in
  - package.json
  - .version
  - .bumpversion.cfg
*/

const fs = require('fs');
const path = require('path');
const { version } = require(path.join(process.cwd(), 'package.json'));
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const cfgPath = path.join(process.cwd(), '.bumpversion.cfg');
const versionPath = path.join(process.cwd(), '.version');

readFile(cfgPath, 'utf8')
  .then(cfg => {
    const updated = cfg.replace(
      /current_version\s*=\s*[^\n]*/i,
      `current_version = ${version}`
    );
    return writeFile(cfgPath, updated, 'utf8');
  })
  .then(() => writeFile(versionPath, version, 'utf8'))
  .catch(e => {
    console.error('sync_versions:', e.path, 'does not exist');
    process.exit(1);
  });
