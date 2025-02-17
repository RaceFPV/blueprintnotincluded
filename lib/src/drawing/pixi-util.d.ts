import * as PIXI from 'pixi.js-legacy';
declare global {
    interface Window {
        PIXI: typeof PIXI;
    }
}
export interface IPixiUtil {
    getNewContainer(): PIXI.Container;
    getNewGraphics(): PIXI.Graphics;
    getSpriteFrom(ressource: any): PIXI.Sprite;
    getNewBaseTexture(url: string): PIXI.BaseTexture;
    getNewTexture(baseTex: PIXI.BaseTexture, rectangle: PIXI.Rectangle): PIXI.Texture;
    getNewTextureWhole(baseTex: PIXI.BaseTexture): PIXI.Texture;
    getNewRectangle(x1: number, y1: number, x2: number, y2: number): PIXI.Rectangle;
    getNewBaseRenderTexture(options: any): PIXI.BaseRenderTexture;
    getNewRenderTexture(brt: PIXI.BaseRenderTexture): PIXI.RenderTexture;
    getNewPixiApp(options: any): PIXI.Application;
    getUtilityGraphicsBack(): PIXI.Graphics;
    getUtilityGraphicsFront(): PIXI.Graphics;
    initTextures(): Promise<void>;
}
export declare class PixiUtil implements IPixiUtil {
    pixiApp: PIXI.Application;
    constructor(options?: any);
    getNewContainer(): PIXI.Container;
    getNewGraphics(): PIXI.Graphics;
    getSpriteFrom(ressource: any): PIXI.Sprite;
    getNewBaseTexture(url: string): PIXI.BaseTexture;
    getNewTexture(baseTex: PIXI.BaseTexture, rectangle: PIXI.Rectangle): PIXI.Texture;
    getNewTextureWhole(baseTex: PIXI.BaseTexture): PIXI.Texture;
    getNewRectangle(x1: number, y1: number, x2: number, y2: number): PIXI.Rectangle;
    getNewBaseRenderTexture(options: any): PIXI.BaseRenderTexture;
    getNewRenderTexture(brt: PIXI.BaseRenderTexture): PIXI.RenderTexture;
    getNewPixiApp(options: any): PIXI.Application;
    getUtilityGraphicsBack(): PIXI.Graphics;
    getUtilityGraphicsFront(): PIXI.Graphics;
    initTextures(): Promise<void>;
}
//# sourceMappingURL=pixi-util.d.ts.map