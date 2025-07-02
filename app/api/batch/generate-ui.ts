import dotenv from 'dotenv';
import * as fs from 'fs';
import * as jimp from 'jimp';
import { ImageSource, BuildableElement, BuildMenuCategory, BuildMenuItem, BSpriteInfo, SpriteInfo, BSpriteModifier, SpriteModifier, BBuilding, OniItem } from '../../../lib';
import { PixiNodeUtil } from '../pixi-node-util';

export class GenerateUI {
  private json: any;

  constructor(databasePath: string) {
    console.log('Running batch GenerateUI')
    dotenv.config();

    let rawdata = fs.readFileSync(databasePath).toString();
    this.json = JSON.parse(rawdata);

    // Initialize all required data
    ImageSource.init();

    let elements: BuildableElement[] = this.json.elements;
    BuildableElement.init();
    BuildableElement.load(elements);

    let buildMenuCategories: BuildMenuCategory[] = this.json.buildMenuCategories;
    BuildMenuCategory.init();
    BuildMenuCategory.load(buildMenuCategories);

    let buildMenuItems: BuildMenuItem[] = this.json.buildMenuItems;
    BuildMenuItem.init();
    BuildMenuItem.load(buildMenuItems);

    let uiSprites: BSpriteInfo[] = this.json.uiSprites;
    SpriteInfo.init();
    SpriteInfo.load(uiSprites);

    let spriteModifiers: BSpriteModifier[] = this.json.spriteModifiers;
    SpriteModifier.init();
    SpriteModifier.load(spriteModifiers);

    let buildings: BBuilding[] = this.json.buildings;
    OniItem.init();
    OniItem.load(buildings);
  }

  async generateUI() {
    try {
      let pixiNodeUtil = new PixiNodeUtil({ forceCanvas: true, preserveDrawingBuffer: true });
      await pixiNodeUtil.initTextures();

      console.log('Generating UI sprites...');
      
      // Only process UI sprites
      const uiSprites = this.json.uiSprites.filter(sprite => {
        if (!sprite.textureName || !sprite.name) return false;
        
        const uvSizeX = parseFloat(sprite.uvSize.x);
        const uvSizeY = parseFloat(sprite.uvSize.y);
        if (uvSizeX <= 0 || uvSizeY === 0) return false;

        return sprite.isIcon === true && 
               sprite.name.includes('_ui') &&
               !sprite.name.endsWith('_ui') &&
               !sprite.textureName.includes('icon_category'); // Exclude category icons
      });

      console.log(`Found ${uiSprites.length} UI sprites to process`);
      
      // Preload all unique textures needed for UI sprite extraction
      console.log('Preloading main building textures...');
      const uniqueTextures = Array.from(new Set(uiSprites.map(sprite => sprite.textureName as string)));
      console.log(`Found ${uniqueTextures.length} unique textures to preload`);
      
      for (const textureName of uniqueTextures) {
        const textureNameStr = textureName as string;
        try {
          const imagePath = `assets/images/${textureNameStr}.png`;
          const baseTexture = await pixiNodeUtil.getImageFromCanvas(imagePath);
          ImageSource.setBaseTexture(textureNameStr, baseTexture);
          
        } catch (error: any) {
          console.warn(`Failed to preload texture ${textureNameStr}:`, error.message);
        }
      }
      
      console.log('Texture preloading complete. Starting UI sprite extraction...');
      let processed = 0;

      for (let sprite of uiSprites) {
        try {
          // Create output directories
          const uiDir = './assets/images/ui';
          const frontendUiDir = './frontend/src/assets/images/ui';
          fs.mkdirSync(uiDir, { recursive: true });
          fs.mkdirSync(frontendUiDir, { recursive: true });

          let texture = await this.extractSprite(sprite, pixiNodeUtil);
          if (!texture) continue;

          let uiSprite = pixiNodeUtil.getSpriteFrom(texture);
          let container = pixiNodeUtil.getNewContainer();
          container.addChild(uiSprite);

          let brt = pixiNodeUtil.getNewBaseRenderTexture({ 
            width: texture.width, 
            height: texture.height,
            resolution: 1
          });
          let rt = pixiNodeUtil.getNewRenderTexture(brt);

          pixiNodeUtil.pixiApp.renderer.render(container, rt, true);
          let base64 = pixiNodeUtil.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

          let icon = await jimp.read(Buffer.from(base64.replace(/^data:image\/png;base64,/, ""), 'base64'));
          icon.write(`./assets/images/ui/${sprite.name}.png`);
          icon.write(`./frontend/src/assets/images/ui/${sprite.name}.png`);

          processed++;
          if (processed % 10 === 0) {
            console.log(`Processed ${processed}/${uiSprites.length} UI sprites`);
          }

          // Cleanup
          brt.destroy();
          rt.destroy();
          container.destroy({ children: true });
          global.gc && global.gc();
        } catch (error) {
          console.warn(`Failed to process UI sprite ${sprite.name}:`, error);
        }
      }

      console.log(`UI sprite generation complete. Processed ${processed}/${uiSprites.length}`);
    } catch (error) {
      console.error('Error generating UI sprites:', error);
      throw error;
    }
  }

  private async extractSprite(sprite: any, pixiNodeUtil: PixiNodeUtil) {
    const baseTex = await ImageSource.getBaseTexture(sprite.textureName, pixiNodeUtil);
    if (!baseTex) {
      console.log(`No texture found for ${sprite.textureName}`);
      return null;
    }

    let x = parseInt(sprite.uvMin.x);
    let y = parseInt(sprite.uvMin.y);
    let width = parseInt(sprite.uvSize.x);
    let height = Math.abs(parseInt(sprite.uvSize.y));

    if (parseInt(sprite.uvSize.y) < 0) {
      y += parseInt(sprite.uvSize.y);
    }

    const rectangle = pixiNodeUtil.getNewRectangle(x, y, width, height);
    return pixiNodeUtil.getNewTexture(baseTex, rectangle);
  }
}

if (require.main === module) {
  new GenerateUI('./assets/database/database.json').generateUI()
    .then(() => console.log('UI generation complete'))
    .catch(error => {
      console.error('Failed to generate UI:', error);
      process.exit(1);
    });
}