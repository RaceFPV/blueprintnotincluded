import { Vector2 } from "../vector2";
import { BSpriteInfo } from "../b-export/b-sprite-info";
import { DrawHelpers } from "./draw-helpers";
import { ImageSource } from "./image-source";
import { PixiUtil } from "./pixi-util";
import { BExport } from "../b-export/b-export";

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

  public static load(spriteInfos: BSpriteInfo[]) {
    // Use existing method that properly converts BSpriteInfo to SpriteInfo
    SpriteInfo.addSpriteInfoArray(spriteInfos);
  }

  // This method already exists and handles the conversion correctly
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
    // Handle grouped sprites correctly - they're in root images folder, not ui folder
    const isGroupSprite = original.textureName.includes('_group_sprite');
    let imageUrl: string = DrawHelpers.createUrl(original.textureName, !isGroupSprite);
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
    console.log(`[SpriteInfo] getSpriteInfo called with: "${spriteInfoId || 'UNDEFINED'}" (type: ${typeof spriteInfoId})`);
    
    if (!spriteInfoId) {
      console.error('[SpriteInfo] Attempted to get sprite info with null/undefined id');
      console.error('[SpriteInfo] Call stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
      const defaultSprite = new SpriteInfo('default');
      console.log('[SpriteInfo] Created default sprite info:', {
        spriteInfoId: defaultSprite.spriteInfoId,
        imageId: defaultSprite.imageId,
        uvMin: defaultSprite.uvMin,
        uvSize: defaultSprite.uvSize
      });
      return defaultSprite;
    }

    const spriteInfo = SpriteInfo.spriteInfosMap.get(spriteInfoId);
    if (!spriteInfo) {
      console.warn(`[SpriteInfo] No sprite info found for: "${spriteInfoId}"`);
      console.warn(`[SpriteInfo] Static map has ${SpriteInfo.spriteInfosMap.size} entries`);
      
      // Check if it might be a grouped sprite that should exist
      if (spriteInfoId.includes('_')) {
        const buildingName = spriteInfoId.split('_')[0];
        const groupedSpriteName = `${buildingName}_group_sprite`;
        const hasGroupedSprite = SpriteInfo.spriteInfosMap.has(groupedSpriteName);
        console.warn(`[SpriteInfo] Expected grouped sprite "${groupedSpriteName}": ${hasGroupedSprite ? '✅ EXISTS' : '❌ MISSING'}`);
      }
      
      // Instead of reading from filesystem, return default
      if (process.env.DEBUG) {
        console.warn(`[SpriteInfo] Returning default sprite info for missing: ${spriteInfoId}`);
      }
      
      const defaultSprite = new SpriteInfo('default');
      console.log('[SpriteInfo] Created default sprite info:', {
        spriteInfoId: defaultSprite.spriteInfoId,
        imageId: defaultSprite.imageId,
        uvMin: defaultSprite.uvMin,
        uvSize: defaultSprite.uvSize
      });
      return defaultSprite;
    }

    console.log(`[SpriteInfo] Found sprite info: "${spriteInfoId}"`);
    console.log(`[SpriteInfo] Sprite info details:`, {
      spriteInfoId: spriteInfo.spriteInfoId,
      imageId: spriteInfo.imageId,
      uvMin: spriteInfo.uvMin,
      uvSize: spriteInfo.uvSize,
      realSize: spriteInfo.realSize,
      pivot: spriteInfo.pivot
    });
    
    return spriteInfo;
  }

  // Pixi stuff
  texture: any; // PIXI.Texture;
  public getTexture(pixiUtil: PixiUtil): any {
    if (this.texture == null) {
      let baseTex = ImageSource.getBaseTexture(this.imageId, pixiUtil);
      if (baseTex == null) {
        console.warn(`[SpriteInfo] Failed to get base texture for imageId: "${this.imageId || 'UNDEFINED'}" (type: ${typeof this.imageId})`);
        console.warn(`[SpriteInfo] SpriteInfo details:`, {
          spriteInfoId: this.spriteInfoId,
          imageId: this.imageId,
          uvMin: this.uvMin,
          uvSize: this.uvSize
        });
        return null;
      }

      try {
        let rectangle = pixiUtil.getNewRectangle(
          this.uvMin.x,
          this.uvMin.y,
          this.uvSize.x,
          this.uvSize.y
        );
        this.texture = pixiUtil.getNewTexture(baseTex, rectangle);
      } catch (error) {
        console.debug(`[SpriteInfo] Error creating texture for ${this.imageId}:`, error);
        return null;
      }
    }
    return this.texture;
  }

  public getTextureWithBleed(bleed: number, realBleed: Vector2 = new Vector2(), pixiUtil: PixiUtil): any {
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

  public getTextureFromMainTexture(pixiUtil: PixiUtil, mainTextureName: string): any {
    if (this.texture == null) {
      // Validate sprite info
      if (!this.uvSize || this.uvSize.x <= 0 || this.uvSize.y <= 0) {
        if (process.env.DEBUG) {
          console.warn(`[SpriteInfo] Invalid UV size for imageId: "${this.imageId || 'UNDEFINED'}"`, {
            spriteInfoId: this.spriteInfoId,
            imageId: this.imageId,
            uvSize: this.uvSize
          });
        }
        return null;
      }

      let baseTex = ImageSource.getBaseTexture(mainTextureName, pixiUtil);
      if (baseTex == null) {
        console.warn(`[SpriteInfo] Failed to get main texture: "${mainTextureName || 'UNDEFINED'}" for sprite: "${this.imageId || 'UNDEFINED'}"`);
        return null;
      }

      try {
        let rectangle = pixiUtil.getNewRectangle(
          this.uvMin.x,
          this.uvMin.y,
          this.uvSize.x,
          this.uvSize.y
        );
        this.texture = pixiUtil.getNewTexture(baseTex, rectangle);
      } catch (error) {
        if (process.env.DEBUG) {
          console.debug(`[SpriteInfo] Error creating texture for imageId: "${this.imageId || 'UNDEFINED'}" from main texture: "${mainTextureName}":`, error);
        }
        return null;
      }
    }
    return this.texture;
  }
}
