import { Resvg } from '@resvg/resvg-js';
import { EzogElement, EzogOptions } from './type';
import { generateSvg } from './svg';

export async function generate(elements: EzogElement[], options: EzogOptions) {
    const svg = await generateSvg(elements, options);

    const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
    const png = resvg.render().asPng();

    return png;
}
