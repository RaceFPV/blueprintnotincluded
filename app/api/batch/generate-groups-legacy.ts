import dotenv from 'dotenv';
import { Database } from '../db';
import { BlueprintModel, Blueprint } from '../models/blueprint';
import * as fs from 'fs';
import * as jimp from 'jimp';
import { BatchUtils } from './batch-utils';
import { BExport, SpriteTag, Vector2 } from "../../../lib/index";
import { ImageSource, BuildableElement, BuildMenuCategory, BuildMenuItem, BSpriteInfo, SpriteInfo, BSpriteModifier, SpriteModifier, BBuilding, OniItem, MdbBlueprint } from '../../../lib';
import { PixiNodeUtil } from '../pixi-node-util';
import { Canvas } from 'canvas';

// Add browser API shims
global.cancelAnimationFrame = () => {};
global.requestAnimationFrame = () => 0;

export class GenerateGroupsLegacy {
  constructor(databasePath: string) {
    console.log('Running batch GenerateGroups')

    // initialize configuration
    dotenv.config();
    
    // Read database
    let rawdata = fs.readFileSync(databasePath).toString();
    let json = JSON.parse(rawdata);

    ImageSource.init();

    let elements: BuildableElement[] = json.elements;
    BuildableElement.init();
    BuildableElement.load(elements);

    let buildMenuCategories: BuildMenuCategory[] = json.buildMenuCategories;
    BuildMenuCategory.init();
    BuildMenuCategory.load(buildMenuCategories);

    let buildMenuItems: BuildMenuItem[] = json.buildMenuItems;
    BuildMenuItem.init();
    BuildMenuItem.load(buildMenuItems);

    let uiSprites: BSpriteInfo[] = json.uiSprites;
    SpriteInfo.init();
    SpriteInfo.load(uiSprites)

    let spriteModifiers: BSpriteModifier[] = json.spriteModifiers;
    SpriteModifier.init();
    SpriteModifier.load(spriteModifiers);

    let buildings: BBuilding[] = json.buildings;
    OniItem.init();
    OniItem.load(buildings);

    this.generateGroupsLegacy(json);
  }

  async generateGroupsLegacy(database: BExport) {
    // Initialize with proper type
    const pixiNodeUtil = new PixiNodeUtil({ forceCanvas: true, preserveDrawingBuffer: true });
    await pixiNodeUtil.initTextures();

    let totalItems = OniItem.oniItems.length;
    let processed = 0;

    for (let oniItem of OniItem.oniItems) {
      processed++;
      if (processed % 10 === 0) {
        console.log(`Processing buildings: ${processed}/${totalItems}`);
      }

      if (oniItem.id == OniItem.elementId || oniItem.id == OniItem.infoId) continue;

      let buildingInDatabase = database.buildings.find((building) => { return building.prefabId == oniItem.id });
      if (!buildingInDatabase) throw new Error('GenerateGroups.generateGroups : building not found : ' + oniItem.id);

      // Group sprites by animation state
      let spritesToGroup: SpriteModifier[] = [];
      for (let spriteModifier of oniItem.spriteGroup.spriteModifiers) {
        if (!spriteModifier) continue;

        // Skip UI and placement sprites
        if (spriteModifier.spriteModifierId.includes('_ui') || 
            spriteModifier.spriteModifierId.includes('_place')) continue;

        // Skip working/special effect states
        if (spriteModifier.spriteModifierId.includes('_working') || 
            spriteModifier.spriteModifierId.includes('_pst') || 
            spriteModifier.spriteModifierId.includes('_bloom') ||
            spriteModifier.spriteModifierId.includes('_glow')) continue;

        // Add base sprites to group
        spritesToGroup.push(spriteModifier);
      }

      if (spritesToGroup.length > 1) {
        try {
          // Create container for grouped sprites
          const container = pixiNodeUtil.getNewContainer();
          if (!container) throw new Error('Failed to create container');
          container.sortableChildren = true;

          let baseRenderTexture: any = null;
          let renderTexture: any = null;

          try {
            let modifierId = oniItem.id + '_group_modifier';
            let spriteInfoId = oniItem.id + '_group_sprite';
            let textureName = oniItem.id + '_group_sprite';

            // Draw sprites into container
            let indexDrawPart = 0;
            for (let spriteModifier of spritesToGroup) {
              // Get sprite info and create sprite
              let spriteInfo = SpriteInfo.getSpriteInfo(spriteModifier.spriteModifierId);
              let texture = spriteInfo.getTexture(pixiNodeUtil);
              if (!texture) continue;

              let sprite = pixiNodeUtil.getSpriteFrom(texture);
              if (!sprite) continue;

              // Set sprite properties
              sprite.position.set(
                spriteModifier.translation.x,
                spriteModifier.translation.y
              );
              sprite.scale.set(
                spriteModifier.scale.x,
                spriteModifier.scale.y
              );
              sprite.rotation = spriteModifier.rotation;
              sprite.zIndex = indexDrawPart++;
              container.addChild(sprite);

              // Remove from database entries
              let indexToRemove = buildingInDatabase.sprites.spriteNames.indexOf(spriteModifier.spriteModifierId);
              buildingInDatabase.sprites.spriteNames.splice(indexToRemove, 1);

              let spriteModifierToRemove = database.spriteModifiers.find(s => s.name == spriteModifier.spriteModifierId);
              if (spriteModifierToRemove) {
                indexToRemove = database.spriteModifiers.indexOf(spriteModifierToRemove);
                database.spriteModifiers.splice(indexToRemove, 1);
              }
            }

            // Save the grouped sprite
            const bounds = container.getBounds();
            baseRenderTexture = pixiNodeUtil.getNewBaseRenderTexture({
              width: Math.ceil(bounds.width),
              height: Math.ceil(bounds.height)
            });
            if (!baseRenderTexture) throw new Error('Failed to create base render texture');

            renderTexture = pixiNodeUtil.getNewRenderTexture(baseRenderTexture);
            if (!renderTexture) throw new Error('Failed to create render texture');

            // Position container
            container.position.x = -bounds.x;
            container.position.y = -bounds.y;

            // Render to texture
            pixiNodeUtil.pixiApp.renderer.render(container, renderTexture);

            try {
              // Create a new node-canvas with the same dimensions
              const nodeCanvas = new Canvas(Math.ceil(bounds.width), Math.ceil(bounds.height));
              const ctx = nodeCanvas.getContext('2d');

              // Get the pixel data from the PIXI renderer
              const pixels = pixiNodeUtil.pixiApp.renderer.plugins.extract.pixels(renderTexture);
              const imageData = ctx.createImageData(Math.ceil(bounds.width), Math.ceil(bounds.height));
              
              // Copy pixel data
              for (let i = 0; i < pixels.length; i++) {
                imageData.data[i] = pixels[i];
              }
              
              // Put the image data on the canvas
              ctx.putImageData(imageData, 0, 0);
              
              // Save to file
              const buffer = nodeCanvas.toBuffer('image/png');
              fs.writeFileSync(`./assets/images/${textureName}.png`, buffer);
            } catch (error) {
              console.error('Error saving grouped sprite:', error);
              // Continue with database updates even if image save fails
            }

            // Add group entries to database
            buildingInDatabase.sprites.spriteNames.push(modifierId);

            let newSpriteModifier = new BSpriteModifier();
            newSpriteModifier.name = modifierId;
            newSpriteModifier.tags = [SpriteTag.solid];
            database.spriteModifiers.push(newSpriteModifier);

          } finally {
            // Cleanup resources
            if (container) {
              container.destroy?.({ children: true });
            }
            if (renderTexture) {
              renderTexture.destroy?.();
            }
            if (baseRenderTexture) {
              baseRenderTexture.destroy?.();
            }
          }
        } catch (error) {
          console.error(`Error processing ${oniItem.id}:`, error);
          continue;
        }
      }
    }

    try {
      // Final cleanup
      if (pixiNodeUtil.pixiApp?.ticker) {
        pixiNodeUtil.pixiApp.ticker.stop();
      }
      pixiNodeUtil.pixiApp?.destroy?.(true, { children: true });
    } catch (e) {
      console.warn('Error during final cleanup:', e);
    }

    // Write updated database
    fs.writeFileSync('./assets/database/database-groups.json', JSON.stringify(database, null, 2));
    console.log('done generating groups');
  }
}

// Only execute this script if loaded directly with node
if (require.main === module) {
    // Run with garbage collection enabled
    if (!global.gc) {
        console.log('Garbage collection is not exposed. Run with --expose-gc flag');
        process.exit(1);
    }
    
    try {
        new GenerateGroupsLegacy('./assets/database/database.json');
    } catch (error) {
        console.error('Failed to generate groups:', error);
        process.exit(1);
    }
}