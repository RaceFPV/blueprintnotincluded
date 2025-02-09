import { Vector2 } from "../vector2";
import { BSpriteInfo } from "../b-export/b-sprite-info";
import { DrawHelpers } from "./draw-helpers";
import { ImageSource } from "./image-source";
import { PixiUtil } from "./pixi-util";

export class SpriteInfo {
  public spriteInfoId: string;
  public imageId: string = '';

  // New stuff
  public uvMin: Vector2 = new Vector2();
  public uvSize: Vector2 = new Vector2();
  public realSize: Vector2 = new Vector2();
  public pivot: Vector2 = new Vector2();
  public isIcon: boolean = false;
  public isInputOutput: boolean = false;

  constructor(spriteInfoId: string) {
    this.spriteInfoId = spriteInfoId;
    this.cleanUp();
  }

  public cleanUp() {
  }

  private static spriteInfosMap: Map<string, SpriteInfo>;

  // Keys is used for some repack stuff
  public static get keys() { return Array.from(SpriteInfo.spriteInfosMap.keys()); }
  public static get spriteInfos() { return Array.from(SpriteInfo.spriteInfosMap.values()); }
  public static init() {
    SpriteInfo.spriteInfosMap = new Map<string, SpriteInfo>();
    // Add default sprite infos
    const defaultSprites = [
      'element_tile_back',
      'gas_tile_front',
      'liquid_tile_front',
      'vacuum_tile_front',
      'info_back'
    ];
    
    defaultSprites.forEach(name => {
      const spriteInfo = new SpriteInfo(name);
      spriteInfo.imageId = name;
      SpriteInfo.addSpriteInfo(spriteInfo);
    });
    
    // Add info front sprites
    for (let i = 0; i < 12; i++) {
      const name = `info_front_${i}`;
      const spriteInfo = new SpriteInfo(name);
      spriteInfo.imageId = name;
      SpriteInfo.addSpriteInfo(spriteInfo);
    }
  }

  public static load(uiSprites: BSpriteInfo[]) {
    for (let uiSprite of uiSprites) {
        if (!uiSprite || !uiSprite.name) {
            console.warn('Invalid sprite info:', uiSprite);
            continue;
        }

        let newUiSpriteInfo = new SpriteInfo(uiSprite.name);
        try {
            newUiSpriteInfo.copyFrom(uiSprite);

            let imageUrl: string = DrawHelpers.createUrl(newUiSpriteInfo.imageId, true);
            imageUrl = imageUrl.replace('0_solid.png', '0.png')
            
            // Verify image exists before adding
            const img = new Image();
            img.onerror = () => {
                // Try alternate path if first one fails
                const altImageUrl = `assets/images/${newUiSpriteInfo.imageId}.png`;
                img.src = altImageUrl;
            };
            img.onload = () => {
                ImageSource.AddImagePixi(newUiSpriteInfo.imageId, img.src);
                SpriteInfo.addSpriteInfo(newUiSpriteInfo);
            };
            img.src = imageUrl;

        } catch (error) {
            // Silently continue - missing sprites are expected during development
        }
    }
  }

  // TODO should this be here?
  public static addSpriteInfoArray(sourceArray: BSpriteInfo[]) {
    for (let sOriginal of sourceArray) {
      let spriteInfo = new SpriteInfo(sOriginal.name);
      spriteInfo.copyFrom(sOriginal);
      SpriteInfo.addSpriteInfo(spriteInfo);
    }
  }

  public static addSpriteInfo(spriteInfo: SpriteInfo) {
    SpriteInfo.spriteInfosMap.set(spriteInfo.spriteInfoId, spriteInfo);
  }

  public copyFrom(original: BSpriteInfo) {
    // TODO refactor
    // DO NOT FORGET : if you add something here, you must add it to the texture repacker also
    let imageUrl: string = DrawHelpers.createUrl(original.textureName, true);
    imageUrl = imageUrl.replace('0_solid.png', '0.png')
    ImageSource.AddImagePixi(original.textureName, imageUrl);
    this.imageId = original.textureName;
    let uvMin = Vector2.clone(original.uvMin); if (uvMin == null) uvMin = new Vector2();
    this.uvMin = uvMin;
    let uvSize = Vector2.clone(original.uvSize); if (uvSize == null) uvSize = new Vector2();
    this.uvSize = uvSize;
    let realSize = Vector2.clone(original.realSize); if (realSize == null) realSize = new Vector2();
    this.realSize = realSize;
    let pivot = Vector2.clone(original.pivot); if (pivot == null) pivot = new Vector2();
    this.pivot = pivot;
    this.isIcon = original.isIcon;
    this.isInputOutput = original.isInputOutput;
  }

  public static getSpriteInfo(spriteInfoId: string): SpriteInfo {
    if (!spriteInfoId) {
      console.error('Attempted to get sprite info with null/undefined id');
      // Return a default sprite info instead of throwing
      return new SpriteInfo('default');
    }

    const spriteInfo = SpriteInfo.spriteInfosMap.get(spriteInfoId);
    if (!spriteInfo) {
      console.warn(`Creating missing sprite info: ${spriteInfoId}`);
      // Create sprite info on demand
      const newSpriteInfo = new SpriteInfo(spriteInfoId);
      newSpriteInfo.imageId = spriteInfoId;
      SpriteInfo.addSpriteInfo(newSpriteInfo);
      return newSpriteInfo;
    }

    return spriteInfo;
  }


  // Pixi stuf
  texture: any; // PIXI.Texture;
  public getTexture(pixiUtil: PixiUtil): any {
    if (this.texture == null) {
      let baseTex = ImageSource.getBaseTexture(this.imageId, pixiUtil);
      if (baseTex == null) {
        console.warn(`Failed to get base texture for ${this.imageId}`);
        return null;
      }

      try {
        // Clamp UV coordinates to texture bounds
        const clampedUvSize = {
          x: Math.min(this.uvSize.x, baseTex.width - this.uvMin.x),
          y: Math.min(this.uvSize.y, baseTex.height - this.uvMin.y)
        };

        let rectangle = pixiUtil.getNewRectangle(
          this.uvMin.x,
          this.uvMin.y,
          clampedUvSize.x,
          clampedUvSize.y
        );

        // Only warn if we had to clamp
        if (clampedUvSize.x !== this.uvSize.x || clampedUvSize.y !== this.uvSize.y) {
          console.debug(`Clamped UV coordinates for ${this.imageId}`);
        }

        this.texture = pixiUtil.getNewTexture(baseTex, rectangle);
      } catch (error) {
        console.debug(`Error creating texture for ${this.imageId}:`, error);
        return null;
      }
    }

    return this.texture;
  }

  public getTextureWithBleed(bleed: number, realBleed: Vector2 = new Vector2(), pixiUtil: PixiUtil): any // PIXI.Texture
  {
    let baseTex = ImageSource.getBaseTexture(this.imageId, pixiUtil);
    if (baseTex == null) return null;

    let rectangle: any = pixiUtil.getNewRectangle(
      this.uvMin.x - bleed,
      this.uvMin.y - bleed,
      this.uvSize.x + bleed * 2,
      this.uvSize.y + bleed * 2
    );

    if (rectangle.x < 0) rectangle.x = 0;
    if (rectangle.y < 0) rectangle.y = 0;
    if (rectangle.x + rectangle.width > baseTex.width) rectangle.width = baseTex.width - rectangle.x;
    if (rectangle.y + rectangle.height > baseTex.height) rectangle.height = baseTex.height - rectangle.y;

    realBleed.x = this.uvMin.x - rectangle.x;
    realBleed.y = this.uvMin.y - rectangle.y;

    return pixiUtil.getNewTexture(baseTex, rectangle);
  }
}
