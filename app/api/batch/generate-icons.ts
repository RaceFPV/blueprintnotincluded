import dotenv from 'dotenv';
import * as fs from 'fs';
import * as jimp from 'jimp';
import { ImageSource, BuildableElement, BuildMenuCategory, BuildMenuItem, BSpriteInfo, SpriteInfo, BSpriteModifier, SpriteModifier, BBuilding, OniItem } from '../../../lib';
import { PixiNodeUtil } from '../pixi-node-util';

export class GenerateIcons {
  private json: any;

  constructor(databasePath: string) {
    console.log('Running batch GenerateIcons')

    // initialize configuration
    dotenv.config();
    console.log(process.env.ENV_NAME);

    // Read database
    let rawdata = fs.readFileSync(databasePath).toString();
    this.json = JSON.parse(rawdata);

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
    SpriteInfo.load(uiSprites)

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

      console.log('start generating icons');
      // Get all sprites that are either icons or UI-related
      for (let k of SpriteInfo.keys.filter(s => {
        const sprite = SpriteInfo.getSpriteInfo(s);
        return sprite.isIcon || // Include all icons
               sprite.isInputOutput || // Include input/output sprites
               s.includes('_ui_'); // Include anything with _ui_ in the name
      })) {
        let uiSpriteInfo = SpriteInfo.getSpriteInfo(k);
        console.log('generating icon/ui for ' + k);

        let texture = uiSpriteInfo.getTexture(pixiNodeUtil);
        let uiSprite = pixiNodeUtil.getSpriteFrom(texture);

        let size = Math.max(texture.width, texture.height)

        let container = pixiNodeUtil.getNewContainer();
        container.addChild(uiSprite);

        uiSprite.x = 0;
        uiSprite.y = 0;

        if (texture.width > texture.height) uiSprite.y += (texture.width / 2 - texture.height / 2);
        if (texture.height > texture.width) uiSprite.x += (texture.height / 2 - texture.width / 2);

        let brt = pixiNodeUtil.getNewBaseRenderTexture({ width: size, height: size });
        let rt = pixiNodeUtil.getNewRenderTexture(brt);

        pixiNodeUtil.pixiApp.renderer.render(container, rt, true);
        let base64: string = pixiNodeUtil.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

        let icon = await jimp.read(Buffer.from(base64.replace(/^data:image\/png;base64,/, ""), 'base64'));
        let iconPath = './assets/images/ui/' + k + '.png';
        console.log('saving icon to ' + iconPath);
        icon.write(iconPath);
        let frontendIconPath = './frontend/src/assets/images/ui/' + k + '.png';
        console.log('saving icon to ' + frontendIconPath);
        icon.write(frontendIconPath);

        // Free memory
        brt.destroy();
        brt = null;
        rt.destroy();
        rt = null;
        container.destroy({ children: true });
        container = null;
        global.gc && global.gc();
      }
      console.log('done generating icons');
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
