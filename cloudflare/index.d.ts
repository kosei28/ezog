type TextBoxElement = {
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
type ImageElement = {
    type: 'image';
    buffer: Buffer | ArrayBuffer;
    x: number;
    y: number;
    width: number;
    height: number;
};
type EzogElement = TextBoxElement | ImageElement;
type EzogNormalFont = {
    type: 'normalFont';
    name: string;
    data: Buffer | ArrayBuffer;
};
type EzogGoogleFont = {
    type: 'googleFont';
    name: string;
    googleFontName: string;
    weight: number;
};
type EzogFont = EzogNormalFont | EzogGoogleFont;
type EzogOptions = {
    width: number;
    height: number;
    fonts: EzogFont[];
    background?: string;
    fetch?: typeof globalThis.fetch;
};

declare function generate(elements: EzogElement[], options: EzogOptions): Promise<Uint8Array>;

export { generate };
