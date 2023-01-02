import sharp from 'sharp';
import { generateTextPath } from './text';
import { EzogElement, EzogFont, EzogOptions } from './type';

export async function generate(elements: EzogElement[], options: EzogOptions) {
    const elementSvgs = await Promise.all(
        elements.map(async (element) => {
            if (element.type == 'textBox') {
                const fonts: EzogFont[] = [];

                for (const fontName of element.fontFamily) {
                    const font = options.fonts.find((font) => font.name == fontName);
                    if (font) {
                        fonts.push(font);
                    }
                }

                return `
                    <g transform="translate(${element.x}, ${element.y})">
                        ${await generateTextPath(
                            element.text,
                            element.width,
                            element.fontSize,
                            element.lineHeight,
                            fonts,
                            element.lineClamp,
                            element.align,
                            element.color
                        )}
                    </g>
                `;
            } else {
                let url = 'data:image/png;base64,';
                if (element.buffer instanceof Buffer) {
                    url += element.buffer.toString('base64');
                } else {
                    url += Buffer.from(element.buffer).toString('base64');
                }
                return `<image x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" href="${url}" />`;
            }
        })
    );

    const svg = `
        <svg width="${options.width}" height="${options.height}">
            ${
                options.background !== undefined
                    ? `<rect x="0" y="0" width="${options.width}" height="${options.height}" fill="${options.background}" />`
                    : ''
            }
            ${elementSvgs.join('')}
        </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}
