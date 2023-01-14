import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import nodeResolve from 'rollup-plugin-node-resolve';

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
            '@resvg/resvg-wasm',
            'base64-arraybuffer',
            'imagescript',
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
    }
];
