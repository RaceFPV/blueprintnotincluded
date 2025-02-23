import dotenv from 'dotenv';
import * as fs from 'fs';
import * as jimp from 'jimp';
import { ImageSource, BuildableElement, BuildMenuCategory, BuildMenuItem, BSpriteInfo, SpriteInfo, BSpriteModifier, SpriteModifier, BBuilding, OniItem } from '../../../lib';
import { PixiNodeUtil } from '../pixi-node-util';

export class GenerateIcons {
  private json: any;

  constructor(databasePath: string) {
    console.log('Running batch GenerateIcons')
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

  async generateIcons() {
    try {
      let pixiNodeUtil = new PixiNodeUtil({ forceCanvas: true, preserveDrawingBuffer: true });
      await pixiNodeUtil.initTextures();

      console.log('Generating category icons...');
      
      // Only process category icons
      const categoryIcons = this.json.buildMenuCategories
        .filter(cat => cat.categoryIcon && cat.categoryIcon.includes('icon_category'));

      console.log(`Found ${categoryIcons.length} category icons to process`);
      let processed = 0;

      for (let category of categoryIcons) {
        try {
          // Create output directories
          const uiDir = './assets/images/ui';
          const frontendUiDir = './frontend/src/assets/images/ui';
          fs.mkdirSync(uiDir, { recursive: true });
          fs.mkdirSync(frontendUiDir, { recursive: true });

          // Find sprite info for this category
          const sprite = this.json.uiSprites.find(s => 
            s.textureName === category.categoryIcon && s.isIcon
          );

          if (!sprite) {
            console.log(`No sprite found for category ${category.categoryName}`);
            continue;
          }

          let texture = await this.extractCategoryIcon(sprite, pixiNodeUtil);
          if (!texture) continue;

          let uiSprite = pixiNodeUtil.getSpriteFrom(texture);
          let container = pixiNodeUtil.getNewContainer();
          container.addChild(uiSprite);

          let brt = pixiNodeUtil.getNewBaseRenderTexture({ 
            width: sprite.uvSize.x, 
            height: Math.abs(sprite.uvSize.y),
            resolution: 1
          });
          let rt = pixiNodeUtil.getNewRenderTexture(brt);

          pixiNodeUtil.pixiApp.renderer.render(container, rt, true);
          let base64 = pixiNodeUtil.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

          let icon = await jimp.read(Buffer.from(base64.replace(/^data:image\/png;base64,/, ""), 'base64'));
          icon.write(`./assets/images/ui/${category.categoryIcon}.png`);
          icon.write(`./frontend/src/assets/images/ui/${category.categoryIcon}.png`);

          processed++;
          console.log(`Processed ${category.categoryIcon} (${processed}/${categoryIcons.length})`);

          // Cleanup
          brt.destroy();
          rt.destroy();
          container.destroy({ children: true });
          global.gc && global.gc();
        } catch (error) {
          console.warn(`Failed to process category ${category.categoryName}:`, error);
        }
      }

      console.log(`Category icon generation complete. Processed ${processed}/${categoryIcons.length}`);
    } catch (error) {
      console.error('Error generating icons:', error);
      throw error;
    }
  }

  private async extractCategoryIcon(sprite: any, pixiNodeUtil: PixiNodeUtil) {
    const baseTex = await ImageSource.getBaseTexture(sprite.textureName, pixiNodeUtil);
    if (!baseTex) {
      console.log(`No texture found for ${sprite.textureName}`);
      return null;
    }

    console.log(`Extracting ${sprite.textureName}:`, {
      uvMin: sprite.uvMin,
      uvSize: sprite.uvSize,
      textureSize: {
        width: baseTex.width,
        height: baseTex.height
      }
    });

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

// Only execute this script if loaded directly with node
if (require.main === module) {
  new GenerateIcons('./assets/database/database.json').generateIcons()
    .then(() => console.log('Icons generation complete'))
    .catch(error => {
      console.error('Failed to generate icons:', error);
      process.exit(1);
    });
}