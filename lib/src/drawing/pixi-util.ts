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

export class PixiUtil implements IPixiUtil {
    pixiApp: PIXI.Application;

    constructor(options: any = {}) {
        try {
            if (!window.PIXI) {
                console.error('PIXI is not loaded');
                throw new Error('PIXI is not loaded');
            }

            this.pixiApp = new window.PIXI.Application({
                width: window.innerWidth,
                height: window.innerHeight,
                ...options
            });
            
            if (!this.pixiApp) {
                throw new Error('Failed to initialize PIXI application');
            }

            this.pixiApp.renderer.on('error', (error: any) => {
                console.error('PIXI renderer error:', error);
            });

        } catch (error) {
            console.error('Error initializing PIXI:', error);
            throw error;
        }
    }

    // Implement interface methods with proper return types
    getNewContainer(): PIXI.Container { return new PIXI.Container(); }
    getNewGraphics(): PIXI.Graphics { return new PIXI.Graphics(); }
    getSpriteFrom(ressource: any): PIXI.Sprite { return PIXI.Sprite.from(ressource); }
    getNewBaseTexture(url: string): PIXI.BaseTexture { return PIXI.BaseTexture.from(url); }
    getNewTexture(baseTex: PIXI.BaseTexture, rectangle: PIXI.Rectangle): PIXI.Texture {
        return new PIXI.Texture(baseTex, rectangle);
    }
    getNewTextureWhole(baseTex: PIXI.BaseTexture): PIXI.Texture {
        return new PIXI.Texture(baseTex);
    }
    getNewRectangle(x1: number, y1: number, x2: number, y2: number): PIXI.Rectangle {
        return new PIXI.Rectangle(x1, y1, x2, y2);
    }
    getNewBaseRenderTexture(options: any): PIXI.BaseRenderTexture {
        return new PIXI.BaseRenderTexture(options);
    }
    getNewRenderTexture(brt: PIXI.BaseRenderTexture): PIXI.RenderTexture {
        return new PIXI.RenderTexture(brt);
    }
    getNewPixiApp(options: any): PIXI.Application { return this.pixiApp; }
    getUtilityGraphicsBack(): PIXI.Graphics { return new PIXI.Graphics(); }
    getUtilityGraphicsFront(): PIXI.Graphics { return new PIXI.Graphics(); }

    async initTextures(): Promise<void> {
        // Initialize textures here
    }
}