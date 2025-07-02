import { PixiUtil } from "./pixi-util";

export class ImageSource
{
    private static imageSourcesMapPixi: Map<string, ImageSource> = new Map();
    private static imageMap: Map<string, string> = new Map();
    private static baseTextureMap: Map<string, any> = new Map();
    private baseTexture: any; // PIXI.BaseTexture | undefined;

    constructor(public imageId: string, public imageUrl: string)
    {
        this.imageId = imageId;
        this.imageUrl = imageUrl;
    }

    // PIXI stuff
    public static get keys() { return Array.from(ImageSource.imageSourcesMapPixi.keys()); }
    public static init()
    { 
      ImageSource.imageSourcesMapPixi = new Map();
      ImageSource.imageMap = new Map();
      ImageSource.baseTextureMap = new Map();
    }

    public static AddImagePixi(id: string, url: string)
    {
      const newImageSource = new ImageSource(id, url);
      ImageSource.imageSourcesMapPixi.set(id, newImageSource);
      ImageSource.imageMap.set(id, url);
    }

    public static isTextureLoaded(imageId: string): boolean {
      const imageSource = ImageSource.imageSourcesMapPixi.get(imageId);
      if (!imageSource) return false;
      return imageSource.baseTexture != null;
    }

    public static getBaseTexture(id: string, pixiUtil: PixiUtil): any
    {
      // First try to get preloaded base texture
      const baseTexture = ImageSource.baseTextureMap.get(id);
      if (baseTexture) {
        return baseTexture;
      }

      // Fall back to creating new base texture
      const imageUrl = ImageSource.imageMap.get(id);
      if (!imageUrl) {
        console.warn(`[ImageSource] No image URL found for ID: "${id || 'UNDEFINED'}" (type: ${typeof id})`);
        return null;
      }
      
      const newBaseTexture = pixiUtil.getNewBaseTexture(imageUrl);
      ImageSource.baseTextureMap.set(id, newBaseTexture);
      return newBaseTexture;
    }

    public static setBaseTexture(id: string, baseTexture: any)
    {
      ImageSource.baseTextureMap.set(id, baseTexture);
    }

    public static getUrl(imageId: string): string {
      const imageSource = ImageSource.imageSourcesMapPixi.get(imageId);
      if (!imageSource) {
        console.warn(`[ImageSource] Image ID not found: ${imageId}, returning empty string`);
        return '';
      }
      return imageSource.imageUrl;
    }

    public static setUrl(imageId: string, imageUrl: string) {
      const imageSource = ImageSource.imageSourcesMapPixi.get(imageId);
      if (imageSource) {
        imageSource.imageUrl = imageUrl;
      }
    }
}
