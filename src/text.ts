import { Font, Glyph, parse } from 'opentype.js';
import twemojiParser from 'twemoji-parser';
import twemoji from 'twemoji';
import { loadGoogleFont } from './font';
import { EzogFont } from './type';
import { encode } from 'base64-arraybuffer';

export async function generateTextPath(
    text: string,
    width: number,
    fontSize: number,
    lineHeight: number,
    fonts: EzogFont[],
    lineClamp?: number,
    align: 'left' | 'right' | 'center' = 'left',
    color = '#000',
    fetch = globalThis.fetch
) {
    text = text.replace(/\s+/g, ' ');

    const opentypeFonts: Font[] = [];

    for (const font of fonts) {
        if (font.type == 'normalFont') {
            if (font.data instanceof ArrayBuffer) {
                opentypeFonts.push(parse(font.data));
            } else {
                opentypeFonts.push(parse(font.data.buffer));
            }
        } else {
            const fontData = await loadGoogleFont(
                `${font.googleFontName}:wght@${font.weight}`,
                text + '…',
                fetch
            );
            if (fontData) {
                opentypeFonts.push(parse(fontData));
            }
        }
    }

    const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    const segments = [...wordSegmenter.segment(text)]
        .map((seg) => {
            const segments: { type: 'word' | 'emoji'; text: string }[] = [];
            let lastIndex = 0;

            for (const entity of twemojiParser.parse(seg.segment)) {
                if (lastIndex < entity.indices[0]) {
                    segments.push({
                        type: 'word',
                        text: seg.segment.slice(lastIndex, entity.indices[0])
                    });
                }

                segments.push({ type: 'emoji', text: entity.text });
                lastIndex = entity.indices[1];
            }

            if (lastIndex < seg.segment.length) {
                segments.push({ type: 'word', text: seg.segment.slice(lastIndex) });
            }

            const cjkBreakAllSegments: { type: 'word' | 'emoji'; text: string }[] = [];

            for (const segment of segments) {
                if (segment.type == 'word') {
                    let lastIndex = 0;

                    for (const match of segment.text.matchAll(
                        /\p{scx=Hani}|\p{scx=Hira}|\p{scx=Kana}|\p{scx=Hang}/gu
                    )) {
                        const index = match.index ?? 0;

                        if (lastIndex < index) {
                            cjkBreakAllSegments.push({
                                type: 'word',
                                text: segment.text.slice(lastIndex, match.index)
                            });
                        }

                        cjkBreakAllSegments.push({
                            type: 'word',
                            text: match[0]
                        });
                        lastIndex = index + match[0].length;
                    }

                    if (lastIndex < segment.text.length) {
                        cjkBreakAllSegments.push({
                            type: 'word',
                            text: segment.text.slice(lastIndex)
                        });
                    }
                } else {
                    cjkBreakAllSegments.push(segment);
                }
            }

            return cjkBreakAllSegments;
        })
        .flat();

    const chars: (
        | {
              type: 'glyph';
              glyph: Glyph;
              width: number;
              fontIndex: number | null;
              segmentIndex: number;
          }
        | {
              type: 'image';
              url: string;
              width: number;
              segmentIndex: number;
          }
    )[] = [];

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        if (segments[segmentIndex].type == 'word') {
            const wordGlyphs: {
                type: 'glyph';
                glyph: Glyph;
                width: number;
                fontIndex: number | null;
                segmentIndex: number;
            }[] = [];

            for (let fontIndex = 0; fontIndex < opentypeFonts.length; fontIndex++) {
                const fontGlyphs = opentypeFonts[fontIndex].stringToGlyphs(
                    segments[segmentIndex].text
                );

                for (let charIndex = 0; charIndex < fontGlyphs.length; charIndex++) {
                    const fontScale = fontSize / opentypeFonts[fontIndex].unitsPerEm;
                    const advanceWidth =
                        fontGlyphs[charIndex].advanceWidth ?? opentypeFonts[fontIndex].unitsPerEm;
                    const glyphWidth = advanceWidth * fontScale;

                    if (
                        (wordGlyphs[charIndex] === undefined ||
                            wordGlyphs[charIndex].fontIndex === null) &&
                        fontGlyphs[charIndex].index != 0
                    ) {
                        wordGlyphs[charIndex] = {
                            type: 'glyph',
                            glyph: fontGlyphs[charIndex],
                            width: glyphWidth,
                            fontIndex,
                            segmentIndex
                        };
                    } else if (wordGlyphs[charIndex] === undefined) {
                        wordGlyphs[charIndex] = {
                            type: 'glyph',
                            glyph: fontGlyphs[charIndex],
                            width: glyphWidth,
                            fontIndex: null,
                            segmentIndex
                        };
                    }
                }
            }

            chars.push(...wordGlyphs);
        } else {
            const codePoint = twemoji.convert.toCodePoint(segments[segmentIndex].text);
            const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoint}.png`;
            chars.push({
                type: 'image',
                url,
                width: fontSize,
                segmentIndex
            });
        }
    }

    const renderOptions: opentype.RenderOptions = {};

    const lines: {
        startIndex: number;
        endIndex: number;
        width: number;
    }[] = [];

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segmentChars = chars.filter((char) => char.segmentIndex == segmentIndex);
        let segmentWidth = segmentChars.reduce((sum, char) => sum + char.width, 0);

        if (width < segmentWidth) {
            for (let charIndex = 0; charIndex < segmentChars.length; charIndex++) {
                const char = segmentChars[charIndex];

                if (
                    (charIndex == 0 && lines[lines.length - 1]?.width !== 0) ||
                    width < lines[lines.length - 1].width + char.width
                ) {
                    let startIndex = 0;
                    let endIndex = 0;
                    let lineWidth = char.width;

                    if (lines.length > 0) {
                        startIndex = lines[lines.length - 1].endIndex;
                        endIndex = lines[lines.length - 1].endIndex;
                    }

                    if (char.type == 'glyph' && char.glyph.unicode == 32) {
                        startIndex += 1;
                        lineWidth = 0;
                    }

                    lines.push({
                        startIndex: startIndex,
                        endIndex: endIndex + 1,
                        width: lineWidth
                    });
                } else {
                    lines[lines.length - 1].endIndex += 1;
                    lines[lines.length - 1].width += char.width;
                }
            }
        } else if (lines.length == 0 || width < lines[lines.length - 1].width + segmentWidth) {
            const char = segmentChars[0];
            let startIndex = 0;
            let endIndex = 0;

            if (lines.length > 0) {
                startIndex = lines[lines.length - 1].endIndex;
                endIndex = lines[lines.length - 1].endIndex;
            }

            if (char.type == 'glyph' && char.glyph.unicode == 32) {
                startIndex += 1;
                segmentWidth -= char.width;
            }

            lines.push({
                startIndex: startIndex,
                endIndex: endIndex + segmentChars.length,
                width: segmentWidth
            });
        } else {
            lines[lines.length - 1].endIndex += segmentChars.length;
            lines[lines.length - 1].width += segmentWidth;
        }
    }

    if (lineClamp !== undefined && lineClamp < lines.length) {
        lines.length = lineClamp;

        const ellipsisGlyph = opentypeFonts[0].charToGlyph('…');
        const fontScale = fontSize / opentypeFonts[0].unitsPerEm;
        const ellipsisWidth =
            (ellipsisGlyph.advanceWidth ?? opentypeFonts[0].unitsPerEm) * fontScale;
        let ellipsisIndex = lines[lines.length - 1].endIndex;

        for (
            let i = 0;
            i < lines[lines.length - 1].endIndex - lines[lines.length - 1].startIndex + 1;
            i++
        ) {
            const charWidth = i == 0 ? 0 : chars[ellipsisIndex].width;
            lines[lines.length - 1].width -= charWidth;

            if (width >= lines[lines.length - 1].width + ellipsisWidth) {
                chars.length = ellipsisIndex;
                chars.push({
                    type: 'glyph',
                    glyph: ellipsisGlyph,
                    width: ellipsisWidth,
                    fontIndex: 0,
                    segmentIndex: -1
                });
                lines[lines.length - 1].endIndex += 1 - i;
                lines[lines.length - 1].width += ellipsisWidth;
                break;
            } else {
                ellipsisIndex -= 1;
            }
        }
    }

    const svgs: string[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        let lineOffsetX = 0;
        let charOffsetX = 0;

        if (align === 'right') {
            lineOffsetX = width - lines[lineIndex].width;
        } else if (align === 'center') {
            lineOffsetX = (width - lines[lineIndex].width) / 2;
        }

        for (
            let charIndex = 0;
            charIndex < lines[lineIndex].endIndex - lines[lineIndex].startIndex;
            charIndex++
        ) {
            const char = chars[lines[lineIndex].startIndex + charIndex];

            if (char.type == 'glyph') {
                const path = char.glyph.getPath(
                    lineOffsetX + charOffsetX,
                    lineHeight * (lineIndex + 1) - (lineHeight - fontSize) / 2,
                    fontSize,
                    renderOptions
                );
                path.fill = color;
                svgs.push(path.toSVG(2));
            } else {
                const x = lineOffsetX + charOffsetX;
                const y = lineHeight * lineIndex + (lineHeight - fontSize) / 2;
                const buffer = await (await fetch(char.url)).arrayBuffer();
                const base64 = encode(buffer);
                svgs.push(
                    `<image x="${x}" y="${y}" width="${fontSize}" height="${fontSize}" href="data:image/png;base64,${base64}" ></image>`
                );
            }

            charOffsetX += char.width;
        }
    }

    return svgs.join();
}
