# Code automation tools

```sh
npm i -D @linkurious/code-tools
```

### `sync_versions`

```sh
$ sync_versions
```
Syncs versions between `package.json`, `.version`, `.bumpversion.cfg`. Use in `postbump` npm script:

```json
"script": {
  "postversion": "sync_versions", // will sync everything after you have changed the versions
  ...
}
```
