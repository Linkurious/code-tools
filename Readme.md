# Code automation tools

```sh
npm i -D @linkurious/code-tools
```

### `sync_versions`

```sh
$ sync_versions
```

Syncs versions between `package.json`, `.version`, `.bumpversion.cfg`. Use in `postbump` npm script:

```js
"scripts": {
  "postversion": "sync_versions", // will sync everything after 'npm version ...'
  ...
}
```

### `copy_npmrc`

```sh
$ copy_npmrc
```

Copies `.npmrc` to all the subpackages in `packages` directory of a monorepository. Needed to make `lerna` work with Node<16.x.

```js
"scripts": {
  "postinstall": "copy_npmrc && lerna bootstrap", // will copy .npmrc to all subpackages
  ...
}
```
