export type TextBoxElement = {
    type: 'textBox';
    text: string;
    x: number;
    y: number;
    width: number;
    fontFamily: string[];
    fontSize: number;
    lineHeight: number;
    lineClamp?: number;
    align?: 'left' | 'right' | 'center';
    color?: string;
};

export type ImageElement = {
    type: 'image';
    buffer: Buffer | ArrayBuffer;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type EzogElement = TextBoxElement | ImageElement;

export type EzogNormalFont = {
    type: 'normalFont';
    name: string;
    data: Buffer | ArrayBuffer;
};

export type EzogGoogleFont = {
    type: 'googleFont';
    name: string;
    googleFontName: string;
    weight: number;
};

export type EzogFont = EzogNormalFont | EzogGoogleFont;

export type EzogOptions = {
    width: number;
    height: number;
    fonts: EzogFont[];
    background?: string;
    fetch?: typeof globalThis.fetch;
};
