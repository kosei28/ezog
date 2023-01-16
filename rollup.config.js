import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import nodeResolve from 'rollup-plugin-node-resolve';
import crypto from 'crypto';
import path from 'path';
import makeDir from 'make-dir';
import { createReadStream, createWriteStream } from 'fs';

function wasm() {
    const fileNames = {};

    return {
        name: 'wasm',
        async resolveId(id, importer, options) {
            if (id.endsWith('.wasm')) {
                return {
                    id,
                    external: true
                };
            } else if (id.endsWith('.wasm?cloudflare')) {
                const resolution = await this.resolve(id.slice(0, -11), importer, {
                    skipSelf: true,
                    ...options
                });
                if (resolution && !resolution.external) {
                    return `${resolution.id}?cloudflare`;
                }
            }
            return null;
        },
        load(id) {
            if (id.endsWith('.wasm?cloudflare')) {
                const name = id.slice(0, -11);
                const hash = crypto.createHash('sha1').update(name).digest('hex').slice(0, 16);
                fileNames[name] = `${hash}.wasm`;
                return `export { default } from './${fileNames[name]}'`;
            }
            return null;
        },
        async generateBundle(outputOptions) {
            const base = outputOptions.dir || path.dirname(outputOptions.file);

            await makeDir(base);

            await Promise.all(
                Object.keys(fileNames).map(async (name) => {
                    const output = fileNames[name];

                    return new Promise((resolve, reject) => {
                        const read = createReadStream(name);
                        read.on('error', reject);

                        const write = createWriteStream(path.join(base, output));
                        write.on('error', reject);
                        write.on('finish', resolve);

                        read.pipe(write);
                    });
                })
            );
        }
    };
}

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.js',
                format: 'es',
                sourcemap: true
            }
        ],
        external: [
            '@resvg/resvg-js',
            'base64-arraybuffer',
            'opentype.js',
            'twemoji',
            'twemoji-parser'
        ],
        plugins: [esbuild(), nodeResolve()]
    },
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es'
        },
        plugins: [dts()]
    },
    {
        input: 'src/cloudflare/index.ts',
        output: [
            {
                file: 'cloudflare/index.js',
                format: 'es',
                sourcemap: true
            }
        ],
        external: [
            '@resvg/resvg-wasm',
            'base64-arraybuffer',
            'opentype.js',
            'twemoji',
            'twemoji-parser'
        ],
        plugins: [wasm(), esbuild(), nodeResolve()]
    },
    {
        input: 'src/cloudflare/index.ts',
        output: {
            file: 'cloudflare/index.d.ts',
            format: 'es'
        },
        plugins: [dts()]
    }
];
