'use strict';

var sharp = require('sharp');
var opentype_js = require('opentype.js');
var twemojiParser = require('twemoji-parser');
var twemoji = require('twemoji');
var fetch = require('node-fetch');

async function loadGoogleFont(font, text) {
  const API = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(API, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1"
    }
  })).text();
  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);
  if (resource) {
    const res = await fetch(resource[1]);
    if (res.status == 200) {
      return await res.arrayBuffer();
    }
  }
}
const googleFonts = [
  "Noto+Sans",
  "Noto+Sans+JP",
  "Noto+Sans+SC",
  "Noto+Sans+KR",
  "Noto+Sans+Thai",
  "Noto+Sans+Hebrew",
  "Noto+Sans+Arabic",
  "Noto+Sans+Bengali",
  "Noto+Sans+Tamil",
  "Noto+Sans+Telugu",
  "Noto+Sans+Malayalam",
  "Noto+Sans+Devanagari"
];
function defaultFonts(weight = 400) {
  return googleFonts.map((font) => ({
    type: "googleFont",
    name: font,
    weight
  }));
}

async function generateTextPath(text, width, fontSize, lineHeight, fonts, lineClamp, align = "left", color = "#000") {
  text = text.replace(/\s+/g, " ");
  const opentypeFonts = [];
  for (const font of fonts) {
    if (font.type == "normalFont") {
      if (font.data instanceof Buffer) {
        opentypeFonts.push(opentype_js.parse(font.data.buffer));
      } else {
        opentypeFonts.push(opentype_js.parse(font.data));
      }
    } else {
      const fontData = await loadGoogleFont(`${font.name}:wght@${font.weight}`, text + "\u2026");
      if (fontData) {
        opentypeFonts.push(opentype_js.parse(fontData));
      }
    }
  }
  const wordSegmenter = new Intl.Segmenter(void 0, { granularity: "word" });
  const segments = [...wordSegmenter.segment(text)].map((seg) => {
    const segments2 = [];
    let lastIndex = 0;
    for (const entity of twemojiParser.parse(seg.segment)) {
      if (lastIndex < entity.indices[0]) {
        segments2.push({
          type: "word",
          text: seg.segment.slice(lastIndex, entity.indices[0])
        });
      }
      segments2.push({ type: "emoji", text: entity.text });
      lastIndex = entity.indices[1];
    }
    if (lastIndex < seg.segment.length) {
      segments2.push({ type: "word", text: seg.segment.slice(lastIndex) });
    }
    const cjkBreakAllSegments = [];
    for (const segment of segments2) {
      if (segment.type == "word") {
        let lastIndex2 = 0;
        for (const match of segment.text.matchAll(
          /\p{scx=Hani}|\p{scx=Hira}|\p{scx=Kana}|\p{scx=Hang}/gu
        )) {
          const index = match.index ?? 0;
          if (lastIndex2 < index) {
            cjkBreakAllSegments.push({
              type: "word",
              text: segment.text.slice(lastIndex2, match.index)
            });
          }
          cjkBreakAllSegments.push({
            type: "word",
            text: match[0]
          });
          lastIndex2 = index + match[0].length;
        }
        if (lastIndex2 < segment.text.length) {
          cjkBreakAllSegments.push({
            type: "word",
            text: segment.text.slice(lastIndex2)
          });
        }
      } else {
        cjkBreakAllSegments.push(segment);
      }
    }
    return cjkBreakAllSegments;
  }).flat();
  const chars = [];
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    if (segments[segmentIndex].type == "word") {
      const wordGlyphs = [];
      for (let fontIndex = 0; fontIndex < opentypeFonts.length; fontIndex++) {
        const fontGlyphs = opentypeFonts[fontIndex].stringToGlyphs(
          segments[segmentIndex].text
        );
        for (let charIndex = 0; charIndex < fontGlyphs.length; charIndex++) {
          const fontScale = fontSize / opentypeFonts[fontIndex].unitsPerEm;
          const advanceWidth = fontGlyphs[charIndex].advanceWidth ?? opentypeFonts[fontIndex].unitsPerEm;
          const glyphWidth = advanceWidth * fontScale;
          if ((wordGlyphs[charIndex] === void 0 || wordGlyphs[charIndex].fontIndex === null) && fontGlyphs[charIndex].index != 0) {
            wordGlyphs[charIndex] = {
              type: "glyph",
              glyph: fontGlyphs[charIndex],
              width: glyphWidth,
              fontIndex,
              segmentIndex
            };
          } else if (wordGlyphs[charIndex] === void 0) {
            wordGlyphs[charIndex] = {
              type: "glyph",
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
        type: "image",
        url,
        width: fontSize,
        segmentIndex
      });
    }
  }
  const renderOptions = {};
  const lines = [];
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segmentChars = chars.filter((char) => char.segmentIndex == segmentIndex);
    let segmentWidth = segmentChars.reduce((sum, char) => sum + char.width, 0);
    if (width < segmentWidth) {
      for (let charIndex = 0; charIndex < segmentChars.length; charIndex++) {
        const char = segmentChars[charIndex];
        if (charIndex == 0 && lines[lines.length - 1]?.width !== 0 || width < lines[lines.length - 1].width + char.width) {
          let startIndex = 0;
          let endIndex = 0;
          let lineWidth = char.width;
          if (lines.length > 0) {
            startIndex = lines[lines.length - 1].endIndex;
            endIndex = lines[lines.length - 1].endIndex;
          }
          if (char.type == "glyph" && char.glyph.unicode == 32) {
            startIndex += 1;
            lineWidth = 0;
          }
          lines.push({
            startIndex,
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
      if (char.type == "glyph" && char.glyph.unicode == 32) {
        startIndex += 1;
        segmentWidth -= char.width;
      }
      lines.push({
        startIndex,
        endIndex: endIndex + segmentChars.length,
        width: segmentWidth
      });
    } else {
      lines[lines.length - 1].endIndex += segmentChars.length;
      lines[lines.length - 1].width += segmentWidth;
    }
  }
  if (lineClamp !== void 0 && lineClamp < lines.length) {
    lines.length = lineClamp;
    const ellipsisGlyph = opentypeFonts[0].charToGlyph("\u2026");
    const fontScale = fontSize / opentypeFonts[0].unitsPerEm;
    const ellipsisWidth = (ellipsisGlyph.advanceWidth ?? opentypeFonts[0].unitsPerEm) * fontScale;
    let ellipsisIndex = lines[lines.length - 1].endIndex;
    for (let i = 0; i < lines[lines.length - 1].endIndex - lines[lines.length - 1].startIndex + 1; i++) {
      const charWidth = i == 0 ? 0 : chars[ellipsisIndex].width;
      lines[lines.length - 1].width -= charWidth;
      if (width >= lines[lines.length - 1].width + ellipsisWidth) {
        chars.length = ellipsisIndex;
        chars.push({
          type: "glyph",
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
  const svgs = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let lineOffsetX = 0;
    let charOffsetX = 0;
    if (align === "right") {
      lineOffsetX = width - lines[lineIndex].width;
    } else if (align === "center") {
      lineOffsetX = (width - lines[lineIndex].width) / 2;
    }
    for (let charIndex = 0; charIndex < lines[lineIndex].endIndex - lines[lineIndex].startIndex; charIndex++) {
      const char = chars[lines[lineIndex].startIndex + charIndex];
      if (char.type == "glyph") {
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
        const base64 = Buffer.from(buffer).toString("base64");
        svgs.push(
          `<image x="${x}" y="${y}" width="${fontSize}" height="${fontSize}" href="data:image/png;base64,${base64}" ></image>`
        );
      }
      charOffsetX += char.width;
    }
  }
  return svgs.join();
}

async function generate(elements, options) {
  const elementSvgs = await Promise.all(
    elements.map(async (element) => {
      if (element.type == "textBox") {
        const fonts = [];
        for (const fontName of element.fontFamily) {
          const font = options.fonts.find((font2) => font2.name == fontName);
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
        let url = "data:image/png;base64,";
        if (element.buffer instanceof Buffer) {
          url += element.buffer.toString("base64");
        } else {
          url += Buffer.from(element.buffer).toString("base64");
        }
        return `<image x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" href="${url}" />`;
      }
    })
  );
  const svg = `
        <svg width="${options.width}" height="${options.height}">
            ${options.background !== void 0 ? `<rect x="0" y="0" width="${options.width}" height="${options.height}" fill="${options.background}" />` : ""}
            ${elementSvgs.join("")}
        </svg>
    `;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

exports.defaultFonts = defaultFonts;
exports.generate = generate;
//# sourceMappingURL=index.js.map
