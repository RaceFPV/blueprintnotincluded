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
    private textureCache: Map<string, PIXI.BaseTexture> = new Map();

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

            // Note: Global BaseTexture error handling is not available in newer PIXI versions
            // Individual texture error handling is done in getNewBaseTexture method

        } catch (error) {
            console.error('Error initializing PIXI:', error);
            throw error;
        }
    }

    // Implement interface methods with proper return types
    getNewContainer(): PIXI.Container { return new PIXI.Container(); }
    getNewGraphics(): PIXI.Graphics { return new PIXI.Graphics(); }
    getSpriteFrom(ressource: any): PIXI.Sprite { return PIXI.Sprite.from(ressource); }
    
    getNewBaseTexture(url: string): PIXI.BaseTexture {
        try {
            if (!url) {
                console.warn('[PixiUtil] No URL provided for texture, returning empty texture');
                console.warn('[PixiUtil] Call stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
                // Create a minimal 1x1 transparent texture
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                return PIXI.BaseTexture.from(canvas);
            }

            // Ensure URL is absolute
            if (!url.startsWith('http') && !url.startsWith('/')) {
                url = '/' + url;
            }

            console.debug(`[PixiUtil] Loading texture from URL: "${url}"`);
            
            const baseTexture = PIXI.BaseTexture.from(url);
            
            // Set up comprehensive error handling for async loading
            baseTexture.on('error', (error: Error) => {
                console.warn(`[PixiUtil] BaseTexture error loading URL: "${url}":`, error);
                console.warn('[PixiUtil] Error occurred in texture loading pipeline');
            });

            baseTexture.on('loaded', () => {
                console.debug(`[PixiUtil] Successfully loaded texture: "${url}"`);
            });

            // Handle the underlying resource errors if it exists
            if (baseTexture.resource) {
                const resource = baseTexture.resource as any;
                if (resource.source && resource.source instanceof HTMLImageElement) {
                    const imageElement = resource.source as HTMLImageElement;
                    // Add error handler to prevent unhandled promise rejections
                    imageElement.addEventListener('error', (event) => {
                        console.warn(`[PixiUtil] Image element failed to load: ${url}`, event);
                        // Prevent the error from bubbling up as an unhandled promise rejection
                        event.preventDefault();
                        event.stopPropagation();
                    });
                    
                    imageElement.addEventListener('load', () => {
                        console.debug(`[PixiUtil] Image element loaded: ${url}`);
                    });
                }
            }

            return baseTexture;
        } catch (error) {
            console.warn(`[PixiUtil] Failed to create base texture from ${url}:`, error, 'returning fallback');
            // Create a minimal fallback texture
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            return PIXI.BaseTexture.from(canvas);
        }
    }

    getNewTexture(baseTex: PIXI.BaseTexture, rectangle: PIXI.Rectangle): PIXI.Texture {
        try {
            if (!baseTex) {
                console.warn('[PixiUtil] No base texture provided, creating fallback');
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                baseTex = PIXI.BaseTexture.from(canvas);
            }
            return new PIXI.Texture(baseTex, rectangle);
        } catch (error) {
            console.warn('[PixiUtil] Failed to create texture, returning fallback texture:', error);
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const fallbackBaseTex = PIXI.BaseTexture.from(canvas);
            return new PIXI.Texture(fallbackBaseTex, rectangle);
        }
    }

    getNewTextureWhole(baseTex: PIXI.BaseTexture): PIXI.Texture {
        try {
            if (!baseTex) {
                console.warn('[PixiUtil] No base texture provided, creating fallback');
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                baseTex = PIXI.BaseTexture.from(canvas);
            }
            return new PIXI.Texture(baseTex);
        } catch (error) {
            console.warn('[PixiUtil] Failed to create whole texture, returning fallback texture:', error);
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const fallbackBaseTex = PIXI.BaseTexture.from(canvas);
            return new PIXI.Texture(fallbackBaseTex);
        }
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
        // Clear texture cache
        this.textureCache.clear();
        PIXI.utils.clearTextureCache();
    }
}
