# ReCompress

Image resizing, multi-format generation, and compression tool. It will process `gif`, `svg`, `png`, `jpeg|jpg`, `webp` image types with the following default configuration...

- `gif`, `svg`, `webp` : by default compress and output to the output path specificed
- `png`, `jpeg|jpg` : by defaults creates 7 different sized images, compresses them, and also creates a `webp` version of the resized image

It will generate a `.json` manifest file for each image that multiple formats are created for which includes the sizes generated as well.

## API
`recompress({
    input,
    output
    [, sizes]
    [, compressOnly]
})`

#### input
Type: `string|string[]`

Files to be optimized. See supported `globby` [patterns](https://github.com/sindresorhus/globby#usage).

_*NOTE*_: File exclusions can be handled here, see above patterns.

#### output
Type: `string`

Output base path. Folder structure will be preserved when the images are output.

#### sizes
Type: `int[]`

If any sizes are specified it will override the default set, but will include `30` and `1920`.

*Defaults*: `[30, 1920, 480, 640, 768, 1024, 1366, 1600 ]`

#### compressOnly
Type: `string|string[]`

Any file paths passed in here will trigger the system to only compress the images and generate a `30px` wide thumbnail. You do not need to exclude the paths from the input param, these paths are merged with the input paths. 

Files to be optimized. See supported `globby` [patterns](https://github.com/sindresorhus/globby#usage).
## Installation
```
npm install recompress --save
```

## Examples
### Async/Await

```javascript
const recompress = require('recompress');

(async () => {
    await recompress();
    console.log('done');
})();
```

### Promises

```javascript
const recompress = require('recompress');

recompress()
    .then(() => {
        console.log('done');
    });
```

## Maintainers

- [Jamieson Roberts](https://github.com/JamiesonRoberts)
- [Arcane Digital Inc](https://github.com/arcanedigital)

Copyright (c) 2018, Arcane & Jamieson Roberts.
