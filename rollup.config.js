import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import nodeResolve from 'rollup-plugin-node-resolve';
import { createFilter } from '@rollup/pluginutils';
import { readFile } from 'fs/promises';

function base64(opts) {
    const filter = createFilter(opts.include, opts.exclude);

    return {
        name: 'base64',
        async transform(_code, id) {
            if (filter(id)) {
                const buffer = await readFile(id);
                return {
                    code: `export default '${buffer.toString('base64')}';`,
                    map: null
                };
            }
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
        external: ['@resvg/resvg-wasm', 'opentype.js', 'twemoji', 'twemoji-parser'],
        plugins: [base64({ include: '**/*.wasm' }), esbuild(), nodeResolve()]
    },
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es'
        },
        plugins: [dts()]
    }
];
