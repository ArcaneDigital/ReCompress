const fsPlus = require('fs-plus');
const fsPath = require('path');
const os = require('os');
const fs = require('fs');
const Promise = require('bluebird');
const sharp = require('sharp');
const globby = require('globby');
const imageMin = require('imagemin');
const imageMinJPEGOptim = require('imagemin-jpegoptim');
const imageMinGifsicle = require('imagemin-gifsicle');
const imageMinPngquant = require('imagemin-pngquant');
const imageMinSvgo = require('imagemin-svgo');

const CPUCOUNT = (os.cpus().length || 4) / 2;

const THUMBNAIL_SIZE = 30;
const FULL_SIZE_MAX = 1920;
const DEFAULT_SIZES = [
    THUMBNAIL_SIZE,
    FULL_SIZE_MAX,
    480,
    640,
    768,
    1024,
    1366,
    1600,
];
const IMAGE_FORMATS = ['gif', 'svg', 'png', 'jpeg', 'jpg', 'webp'];
const additionalFormats = ['webp'];
const IMAGEMIN_OPTIONS = {
    plugins: [
        imageMinJPEGOptim({
            max: 85,
            progressive: true,
        }),
        imageMinPngquant({
            quality: '65-80',
            strip: true,
        }),
        imageMinGifsicle({
            interlaced: true,
        }),
        imageMinSvgo(),
    ],
};

const pathSegments = paths => [].concat(...paths.map(p => p.split(fsPath.sep)));

const fileOutputFolderPath = (resource, inputBasePath) =>
    resource
        .split(fsPath.sep)
        .filter(segment => inputBasePath.indexOf(segment) < 0)
        .filter(
            segment => segment !== fsPath.basename(resource, resource.extname),
        )
        .join(fsPath.sep);

const configure = ({
    input,
    inputPathSegments,
    outputBase,
    sizes,
    compressOnlyPaths,
}) => {
    const compressOnly = compressOnlyPaths.some(path => path === input);
    return {
        input,
        outputSizes: compressOnly ? [THUMBNAIL_SIZE, FULL_SIZE_MAX] : sizes,
        compressOnly,
        outputPath: [
            outputBase,
            fileOutputFolderPath(input, inputPathSegments),
        ].join(fsPath.sep),
    };
};
const setMaxSize = (size, imageWidth) => {
    if (size === THUMBNAIL_SIZE) return size;
    return imageWidth >= size ? size : imageWidth;
};

const instanceResize = async (size, instance) =>
    instance
        .clone()
        .resize(size)
        .toBuffer();

const minify = async buffer => imageMin.buffer(buffer, IMAGEMIN_OPTIONS);

const outputFile = async (path, buffer) => fsPlus.writeFileSync(path, buffer);

const fileHandler = async ({
    input,
    outputSizes,
    compressOnly,
    outputPath,
} = {}) => {
    const fileInfo = fsPath.parse(input);
    const filenameBase = [outputPath, fileInfo.name].join(fsPath.sep);

    if (['.gif', '.webp', '.svg'].indexOf(fileInfo.ext) >= 0) {
        return fs.readFile(input, async (err, buffer) => {
            if (err) throw err;
            const minBuffer = await minify(buffer);
            await outputFile(`${filenameBase}${fileInfo.ext}`, minBuffer);
        });
    }

    const instance = sharp(input);
    const metadata = await instance.metadata();
    if (compressOnly) {
        return Promise.map(
            outputSizes,
            async size => {
                const maxSize = setMaxSize(size, metadata.width);
                const buffer = await instanceResize(maxSize, instance);
                const fileSizeSuffix =
                    size === THUMBNAIL_SIZE ? '-thumbnail' : '';
                const minBuffer = await minify(buffer);
                await outputFile(
                    `${filenameBase}${fileSizeSuffix}${fileInfo.ext}`,
                    minBuffer,
                );
            },
            { concurrency: CPUCOUNT },
        );
    }

    const manifest = {
        ratio: (metadata.height / metadata.width) * 100,
        formats: [metadata.format, ...additionalFormats],
        sizes: [],
    };
    await Promise.map(
        outputSizes,
        async size => {
            const buffer = await instanceResize(size, instance);
            const fileSizeSuffix = size === THUMBNAIL_SIZE ? 'thumbnail' : size;
            const minBuffer = await minify(buffer);
            await outputFile(
                `${filenameBase}-${fileSizeSuffix}${fileInfo.ext}`,
                minBuffer,
            );
            await sharp(buffer)
                .webp()
                .toBuffer()
                .then(convertedBuf =>
                    outputFile(
                        `${filenameBase}-${fileSizeSuffix}.webp`,
                        convertedBuf,
                    ),
                );
            manifest.sizes.push(fileSizeSuffix);
        },
        { concurrency: CPUCOUNT },
    );

    return outputFile(`${filenameBase}.json`, JSON.stringify(manifest));
};

module.exports = async ({
    input,
    output,
    sizes = DEFAULT_SIZES,
    compressOnly = [],
} = {}) => {
    if (!input) throw new Error('Input path is a required field');
    if (!output) throw new Error('Output path is a required field');
    if (typeof output !== 'string' || !(output instanceof String))
        throw new Error('Output must be a string.');

    const inputs = await globby(Array.isArray(input) ? input : [input], {
        extension: IMAGE_FORMATS,
    });
    const inputPathSegments = pathSegments(input);
    const compressOnlyPaths = await globby(
        Array.isArray(compressOnly) ? compressOnly : [compressOnly],
        {
            extension: IMAGE_FORMATS,
        },
    );
    const outputSizes = Array.isArray(sizes)
        ? [THUMBNAIL_SIZE, FULL_SIZE_MAX, ...sizes]
        : DEFAULT_SIZES;

    const processQueue = inputs.map(path =>
        configure({
            input: path,
            inputPathSegments,
            output,
            sizes: outputSizes,
            compressOnlyPaths,
        }),
    );
    await Promise.map(processQueue, fileHandler, { concurrency: CPUCOUNT / 2 });
};
