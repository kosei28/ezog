import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?cloudflare';
import { EzogElement, EzogOptions } from '../type';
import { generateSvg } from '../svg';

export async function generate(elements: EzogElement[], options: EzogOptions) {
    const svg = await generateSvg(elements, options);

    await initWasm(resvgWasm);
    const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
    const png = resvg.render().asPng();

    return png;
}
