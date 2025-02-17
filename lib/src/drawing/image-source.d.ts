import { PixiUtil } from "./pixi-util";
export declare class ImageSource {
    imageId: string;
    imageUrl: string;
    private static imageSourcesMapPixi;
    private static imageMap;
    private static baseTextureMap;
    private baseTexture;
    constructor(imageId: string, imageUrl: string);
    static get keys(): string[];
    static init(): void;
    static AddImagePixi(id: string, url: string): void;
    static isTextureLoaded(imageId: string): boolean;
    static getBaseTexture(id: string, pixiUtil: PixiUtil): any;
    static setBaseTexture(id: string, baseTexture: any): void;
    static getUrl(imageId: string): string;
    static setUrl(imageId: string, imageUrl: string): void;
}
//# sourceMappingURL=image-source.d.ts.map