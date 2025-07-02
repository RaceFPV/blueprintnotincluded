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
      
      // Process category icons using the working old approach
      let processed = 0;
      const uiDir = './assets/images/ui';
      const frontendUiDir = './frontend/src/assets/images/ui';
      fs.mkdirSync(uiDir, { recursive: true });
      fs.mkdirSync(frontendUiDir, { recursive: true });

      for (let k of SpriteInfo.keys.filter(s => {
        const sprite = SpriteInfo.getSpriteInfo(s);
        return sprite.isIcon && !sprite.isInputOutput && s.includes('icon_category');
      })) {
        try {
          let uiSpriteInfo = SpriteInfo.getSpriteInfo(k);
          console.log(`Extracting ${k}:`, {
            uvMin: uiSpriteInfo.uvMin,
            uvSize: uiSpriteInfo.uvSize
          });

          let texture = uiSpriteInfo.getTexture(pixiNodeUtil);
          if (!texture) {
            console.log(`No texture found for ${k}`);
            continue;
          }

          let uiSprite = pixiNodeUtil.getSpriteFrom(texture);
          let size = Math.max(texture.width, texture.height);

          let container = pixiNodeUtil.getNewContainer();
          container.addChild(uiSprite);

          uiSprite.x = 0;
          uiSprite.y = 0;

          if (texture.width > texture.height) uiSprite.y += (texture.width / 2 - texture.height / 2);
          if (texture.height > texture.width) uiSprite.x += (texture.height / 2 - texture.width / 2);

          let brt = pixiNodeUtil.getNewBaseRenderTexture({ width: size, height: size, resolution: 1 });
          let rt = pixiNodeUtil.getNewRenderTexture(brt);

          pixiNodeUtil.pixiApp.renderer.render(container, rt, true);
          let base64 = pixiNodeUtil.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

          let icon = await jimp.read(Buffer.from(base64.replace(/^data:image\/png;base64,/, ""), 'base64'));
          icon.write(`${uiDir}/${k}.png`);
          icon.write(`${frontendUiDir}/${k}.png`);

          processed++;
          console.log(`Processed ${k} (${processed})`);

          // Cleanup
          brt.destroy();
          rt.destroy();
          container.destroy({ children: true });
          global.gc && global.gc();
        } catch (error) {
          console.warn(`Failed to process icon ${k}:`, error);
        }
      }

      console.log(`Category icon generation complete. Processed ${processed} icons`);
    } catch (error) {
      console.error('Error generating icons:', error);
      throw error;
    }
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