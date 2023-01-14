import { fetch } from 'undici';
import { EzogGoogleFont } from './type';

export async function loadGoogleFont(font: string, text: string) {
    const API = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`;

    const css = await (
        await fetch(API, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'
            }
        })
    ).text();

    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

    if (resource) {
        const res = await fetch(resource[1]);
        if (res.status == 200) {
            return await res.arrayBuffer();
        }
    }
}

const googleFonts = [
    'Noto+Sans',
    'Noto+Sans+JP',
    'Noto+Sans+SC',
    'Noto+Sans+KR',
    'Noto+Sans+Thai',
    'Noto+Sans+Hebrew',
    'Noto+Sans+Arabic',
    'Noto+Sans+Bengali',
    'Noto+Sans+Tamil',
    'Noto+Sans+Telugu',
    'Noto+Sans+Malayalam',
    'Noto+Sans+Devanagari'
];

export function defaultFonts(weight = 400): EzogGoogleFont[] {
    return googleFonts.map((font) => ({
        type: 'googleFont',
        name: `${font.split('+').join(' ')} ${weight}`,
        googleFontName: font,
        weight: weight
    }));
}
