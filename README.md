# EZOG

EZOG is a JavaScript generator that can easily generate OG images without using a browser.

# Features

-   Support for custom fonts.
-   Support for font size and line height.
-   Support for ellipsis.
-   Support for word breaking.
-   Support for specifying number of lines.
-   Support for Twemoji.
-   Support for embedding images.

# Installation

```sh
npm install ezog
```

# Example

```js
import { generate, defaultFonts } from 'ezog';

const png = await generate(
    [
        {
            type: 'image',
            buffer: baseImageBuffer, // Buffer / ArrayBuffer
            x: 0,
            y: 0,
            width: 1200,
            height: 630
        },
        {
            type: 'textBox',
            text: 'Hello, World',
            x: 0,
            y: 275,
            width: 1200,
            fontFamily: ['Sans', 'Noto Sans 700'],
            fontSize: 60,
            lineHeight: 80,
            lineClamp: 1, // optional
            align: 'center', // optional 'left' / 'right' / 'center'
            color: '#000' // optional
        }
    ],
    {
        width: 1200,
        height: 630,
        fonts: [
            {
                type: 'normalFont',
                name: 'Sans',
                data: fontSansBuffer // Buffer / ArrayBuffer
            },
            {
                type: 'googleFont',
                name: 'Noto Sans 700',
                googleFontName: 'Noto+Sans',
                weight: 700
            },
            ...defaultFonts(700 /* weight: optional */) // load multilingual Noto Sans from google fonts
        ],
        background: '#fff' // optional
    }
);
```
