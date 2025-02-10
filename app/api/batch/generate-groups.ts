import dotenv from 'dotenv';
import { Database } from '../db';
import { BlueprintModel, Blueprint } from '../models/blueprint';
import * as fs from 'fs';
import Jimp from 'jimp';
import { BatchUtils } from './batch-utils';
import { BExport, SpriteTag, Vector2 } from "../../../lib/index";
import { ImageSource, BuildableElement, BuildMenuCategory, BuildMenuItem, BSpriteInfo, SpriteInfo, BSpriteModifier, SpriteModifier, BBuilding, OniItem, MdbBlueprint } from '../../../lib';
import { PixiNodeUtil } from '../pixi-node-util';
import * as path from 'path';


export class GenerateGroups {
  private assetsImagesDir: string;

  constructor(databasePath: string, assetsImagesDir: string) {
    console.log('Running batch GenerateGroups')
    this.assetsImagesDir = assetsImagesDir;

    // initialize configuration
    dotenv.config();
    console.log(process.env.ENV_NAME);

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

    this.generateGroups(json);
  }

  async generateGroups(database: BExport) {
    try {
      // First copy manual images to UI folder
      console.log('Copying manual images to UI folder...');
      const manualDir = path.join(this.assetsImagesDir, '../manual');
      const uiDir = path.join(this.assetsImagesDir, 'ui');

      // Ensure UI directory exists
      if (!fs.existsSync(uiDir)) {
        fs.mkdirSync(uiDir, { recursive: true });
      }

      if (fs.existsSync(manualDir)) {
        const manualFiles = fs.readdirSync(manualDir);
        for (const file of manualFiles) {
          if (file.endsWith('.png')) {
            const sourcePath = path.join(manualDir, file);
            const destPath = path.join(uiDir, file);
            try {
              fs.copyFileSync(sourcePath, destPath);
              console.log(`Copied ${file} to UI folder`);
            } catch (error) {
              console.warn(`Failed to copy ${file}:`, error);
            }
          }
        }
      } else {
        console.warn('Manual images directory not found:', manualDir);
      }

      let pixiNodeUtil = new PixiNodeUtil({ forceCanvas: true, preserveDrawingBuffer: true });

      // First initialize PIXI and load all textures
      console.log('Initializing PIXI and loading textures...');
      await pixiNodeUtil.initTextures();
      
      // Create a map of all textures we need to process
      const textureMap = new Map<string, {
        baseTexture: any,
        width: number,
        height: number,
        image: any
      }>();

      // Load all textures first
      const totalBuildings = database.buildings.length;
      console.log(`Starting building texture loading (0/${totalBuildings})...`);
      let processedBuildings = 0;
      let successfullyLoaded = 0;
      let failedToLoad = 0;

      // Process buildings in smaller batches
      const batchSize = 5; // Reduced batch size
      const TIMEOUT = 30000; // 30 second timeout

      for (let i = 0; i < totalBuildings; i += batchSize) {
        const batch = database.buildings.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalBuildings/batchSize)}...`);
        
        try {
          // Process one building at a time to avoid memory issues
          for (const building of batch) {
            const texturePath = path.join(this.assetsImagesDir, building.textureName + '.png');
            
            if (!fs.existsSync(texturePath)) {
              console.log(`Skipping missing texture: ${building.textureName}`);
              failedToLoad++;
              continue;
            }

            try {
              console.log(`Starting to load ${building.textureName}...`);
              
              // Read image data
              const imageData = fs.readFileSync(texturePath);
              console.log(`Read file data for ${building.textureName}`);
              
              const base64Image = `data:image/png;base64,${imageData.toString('base64')}`;
              
              // Create PIXI texture
              const baseTexture = await pixiNodeUtil.createBaseTexture(base64Image);
              console.log(`Created base texture for ${building.textureName}`);
              
              // Read with Jimp
              const image = await Jimp.read(imageData);
              console.log(`Read image with jimp for ${building.textureName}`);

              // Store everything we need
              textureMap.set(building.textureName, {
                baseTexture,
                width: baseTexture.width,
                height: baseTexture.height,
                image
              });

              // Register with ImageSource
              ImageSource.AddImagePixi(building.textureName, base64Image);
              ImageSource.setBaseTexture(building.textureName, baseTexture);

              successfullyLoaded++;
              console.log(`✓ Successfully loaded ${building.textureName}`);

              // Add a small delay between each texture
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
              console.error(`Failed to process ${building.textureName}:`, error);
              failedToLoad++;
              
              // Try to clean up any partial resources
              try {
                const existingTexture = textureMap.get(building.textureName);
                if (existingTexture) {
                  if (existingTexture.baseTexture) {
                    existingTexture.baseTexture.destroy();
                  }
                  if (existingTexture.image?.bitmap) {
                    existingTexture.image.bitmap.data = null;
                  }
                  textureMap.delete(building.textureName);
                }
              } catch (cleanupError) {
                console.error(`Cleanup error for ${building.textureName}:`, cleanupError);
              }
            }
          }

          processedBuildings += batch.length;
          console.log(`\nBatch complete:`);
          console.log(`Progress: ${processedBuildings}/${totalBuildings} buildings processed`);
          console.log(`Status: ${successfullyLoaded} loaded, ${failedToLoad} failed`);
          
          // Force garbage collection between batches
          if (global.gc) {
            console.log('Running garbage collection...');
            global.gc();
          }
          
          // Add a delay between batches
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error('Batch processing error:', error);
        }
      }

      console.log('\nBuilding texture loading summary:');
      console.log(`Total processed: ${processedBuildings}/${totalBuildings}`);
      console.log(`Successfully loaded: ${successfullyLoaded}`);
      console.log(`Failed to load: ${failedToLoad}`);

      // First scan all textures to build a UV coordinate map
      console.log('Scanning textures for UV coordinates...');
      const uvCoordinateMap = new Map<string, Map<string, {
        uvMin: Vector2,
        uvSize: Vector2,
        realSize: Vector2
      }>>();

      for (const building of database.buildings) {
        const texturePath = path.join(this.assetsImagesDir, building.textureName + '.png');
        if (!fs.existsSync(texturePath)) continue;

        try {
          const image = await Jimp.read(texturePath);
          const textureWidth = image.getWidth();
          const textureHeight = image.getHeight();
          
          // Create map for this texture if it doesn't exist
          if (!uvCoordinateMap.has(building.textureName)) {
            uvCoordinateMap.set(building.textureName, new Map());
          }
          
          // Find all sprites that use this texture
          const relatedSprites = database.uiSprites.filter(s => s.textureName === building.textureName);
          
          for (const sprite of relatedSprites) {
            // Skip if already processed
            if (uvCoordinateMap.get(building.textureName)?.has(sprite.name)) continue;

            // Scan the texture to find the actual sprite boundaries
            let minX = textureWidth, minY = textureHeight;
            let maxX = 0, maxY = 0;
            let found = false;

            // Scan in chunks for better performance
            const chunkSize = 100;
            for (let y = 0; y < textureHeight; y += chunkSize) {
              for (let x = 0; x < textureWidth; x += chunkSize) {
                const w = Math.min(chunkSize, textureWidth - x);
                const h = Math.min(chunkSize, textureHeight - y);

                for (let dy = 0; dy < h; dy++) {
                  for (let dx = 0; dx < w; dx++) {
                    const px = x + dx;
                    const py = y + dy;
                    const idx = image.getPixelColor(px, py);
                    const alpha = ((idx >> 24) & 0xff);
                    
                    if (alpha > 0) {
                      minX = Math.min(minX, px);
                      minY = Math.min(minY, py);
                      maxX = Math.max(maxX, px);
                      maxY = Math.max(maxY, py);
                      found = true;
                    }
                  }
                }
              }
            }

            if (found) {
              uvCoordinateMap.get(building.textureName)?.set(sprite.name, {
                uvMin: new Vector2(minX, minY),
                uvSize: new Vector2(maxX - minX + 1, maxY - minY + 1),
                realSize: new Vector2(maxX - minX + 1, maxY - minY + 1)
              });
            }
          }

          console.log(`Scanned ${building.textureName}: found ${uvCoordinateMap.get(building.textureName)?.size || 0} sprites`);
          
        } catch (error) {
          console.error(`Failed to scan texture ${building.textureName}:`, error);
        }
      }

      // Now update the database with correct UV coordinates
      console.log('Updating database with correct UV coordinates...');
      for (const sprite of database.uiSprites) {
        const coordinates = uvCoordinateMap.get(sprite.textureName)?.get(sprite.name);
        if (coordinates) {
          sprite.uvMin = coordinates.uvMin;
          sprite.uvSize = coordinates.uvSize;
          sprite.realSize = coordinates.realSize;
          sprite.pivot = new Vector2(0.5, 0.5); // Default pivot point
        }
      }

      // NOW extract UI icons with the corrected UV coordinates
      console.log('\nExtracting UI icons...');
      let extractedIcons = 0;
      let failedIcons = 0;

      for (const sprite of database.uiSprites) {
        if (!sprite.isIcon) continue;

        // Skip sprites with invalid UV coordinates
        if (!sprite.uvSize || sprite.uvSize.x <= 0 || sprite.uvSize.y <= 0) {
          console.warn(`Skipping icon with invalid UV coordinates: ${sprite.name}`);
          failedIcons++;
          continue;
        }

        const texturePath = path.join(this.assetsImagesDir, sprite.textureName + '.png');
        if (!fs.existsSync(texturePath)) {
          console.warn(`Source texture not found for icon: ${sprite.name}`);
          failedIcons++;
          continue;
        }

        try {
          // Read the source texture
          const sourceImage = await Jimp.read(texturePath);
          
          // Create a new image for the icon
          const iconSize = 64;
          const iconImage = new Jimp(iconSize, iconSize, 0x00000000);
          
          // Clone the source image before modifying it
          const workingImage = sourceImage.clone();
          
          // Extract the icon portion
          workingImage.crop(
            Math.floor(sprite.uvMin.x),
            Math.floor(sprite.uvMin.y),
            Math.ceil(sprite.uvSize.x),
            Math.ceil(sprite.uvSize.y)
          );
          
          // Scale to fit icon size while maintaining aspect ratio
          workingImage.scaleToFit(iconSize, iconSize);
          
          // Center the scaled image
          const x = Math.floor((iconSize - workingImage.getWidth()) / 2);
          const y = Math.floor((iconSize - workingImage.getHeight()) / 2);
          
          // Composite the scaled image onto the icon canvas
          iconImage.composite(workingImage, x, y);
          
          // Save the icon
          const iconPath = path.join(this.assetsImagesDir, 'ui', `${sprite.name}.png`);
          await iconImage.writeAsync(iconPath);
          
          console.log(`Extracted icon: ${sprite.name} (${Math.ceil(sprite.uvSize.x)}x${Math.ceil(sprite.uvSize.y)})`);
          extractedIcons++;

        } catch (error) {
          console.error(`Failed to extract icon for ${sprite.name}:`, error);
          failedIcons++;
        }
      }

      console.log(`\nIcon extraction complete:`);
      console.log(`Successfully extracted: ${extractedIcons}`);
      console.log(`Failed to extract: ${failedIcons}`);

      // Now process each building
      for (let oniItem of OniItem.oniItems) {
        if (oniItem.id == OniItem.elementId || oniItem.id == OniItem.infoId) continue;

        const buildingInDatabase = database.buildings.find(b => b.prefabId == oniItem.id);
        if (!buildingInDatabase) continue;

        const textureData = textureMap.get(buildingInDatabase.textureName);
        if (!textureData) continue;

        // Collect sprites to group
        let spritesToGroup: SpriteModifier[] = [];
        for (const spriteModifier of oniItem.spriteGroup.spriteModifiers) {
          if (!spriteModifier) continue;

          try {
            const spriteInfo = SpriteInfo.getSpriteInfo(spriteModifier.spriteInfoName);
            if (spriteInfo.spriteInfoId === 'default') continue;

            // Less restrictive filtering - only exclude connection sprites
            if (spriteModifier.tags.indexOf(SpriteTag.connection) === -1) {
              spritesToGroup.push(spriteModifier);
            }
          } catch (error) {
            if (process.env.DEBUG) {
              console.warn(`Error processing sprite modifier in ${oniItem.id}:`, error);
            }
          }
        }

        // Only skip if we have 1 or fewer sprites
        if (spritesToGroup.length <= 1) {
          if (process.env.DEBUG) {
            console.log(`${oniItem.id} has too few sprites to group (${spritesToGroup.length})`);
          }
          continue;
        }

        try {
          let container = pixiNodeUtil.getNewContainer();
          container.sortableChildren = true;

          let modifierId = oniItem.id + '_group_modifier';
          let spriteInfoId = oniItem.id + '_group_sprite';
          let textureName = oniItem.id + '_group_sprite'

          let indexDrawPart = 0;
          for (let spriteModifier of oniItem.spriteGroup.spriteModifiers) {
            if (spriteModifier.tags.indexOf(SpriteTag.solid) == -1 ||
              spriteModifier.tags.indexOf(SpriteTag.tileable) != -1 ||
              spriteModifier.tags.indexOf(SpriteTag.connection) != -1) continue;

            let spriteInfo = SpriteInfo.getSpriteInfo(spriteModifier.spriteInfoName);
            
            // Use the main texture instead of individual sprite
            let texture = spriteInfo.getTextureFromMainTexture(pixiNodeUtil, buildingInDatabase.textureName);
            if (!texture) {
              if (process.env.DEBUG) {
                console.warn(`Failed to get texture for ${spriteModifier.spriteInfoName} from ${buildingInDatabase.textureName}`);
              }
              continue;
            }

            let sprite = pixiNodeUtil.getSpriteFrom(texture);
            
            // Set sprite properties
            sprite.anchor.set(spriteInfo.pivot.x, 1 - spriteInfo.pivot.y);
            sprite.x = 0 + (spriteModifier.translation.x);
            sprite.y = 0 - (spriteModifier.translation.y);
            sprite.width = spriteInfo.realSize.x;
            sprite.height = spriteInfo.realSize.y;
            sprite.scale.x = spriteModifier.scale.x;
            sprite.scale.y = spriteModifier.scale.y;
            sprite.angle = -spriteModifier.rotation;
            sprite.zIndex -= (indexDrawPart / 50);

            // Add debug info
            if (process.env.DEBUG) {
              console.log(`Drawing sprite ${spriteModifier.spriteInfoName}:`, {
                uvMin: spriteInfo.uvMin,
                uvSize: spriteInfo.uvSize,
                realSize: spriteInfo.realSize,
                pivot: spriteInfo.pivot,
                translation: spriteModifier.translation,
                scale: spriteModifier.scale,
                rotation: spriteModifier.rotation
              });
            }

            container.addChild(sprite);
            indexDrawPart++;
          }

          buildingInDatabase.sprites.spriteNames.push(modifierId);

          container.calculateBounds();
          let bounds = container.getBounds();
          console.log(`Container bounds for ${oniItem.id}:`, bounds);

          // Make sure the bounds are valid
          if (bounds.width <= 0 || bounds.height <= 0) {
            console.warn(`Invalid bounds for ${oniItem.id}: ${JSON.stringify(bounds)}`);
            continue;
          }

          let diff = new Vector2(bounds.x, bounds.y);
          for (let child of container.children) {
            child.x -= diff.x;
            child.y -= diff.y
          }

          let pivot = new Vector2(1 - ((bounds.width + bounds.x) / bounds.width), ((bounds.height + bounds.y) / bounds.height));
          //console.log(pivot);

          // Create and add the new sprite modifier to replace the group
          let newSpriteModifier = new BSpriteModifier();
          newSpriteModifier.name = modifierId;
          newSpriteModifier.spriteInfoName = spriteInfoId;
          newSpriteModifier.rotation = 0;
          newSpriteModifier.scale = new Vector2(1, 1);
          newSpriteModifier.translation = new Vector2(0, 0);
          newSpriteModifier.tags = [SpriteTag.solid];
          database.spriteModifiers.push(newSpriteModifier);

          // Create and add the new spriteInfo
          let newSpriteInfo = new BSpriteInfo();
          newSpriteInfo.name = spriteInfoId;
          newSpriteInfo.textureName = textureName;
          newSpriteInfo.pivot = pivot;
          newSpriteInfo.uvMin = new Vector2(0, 0);
          newSpriteInfo.realSize = new Vector2(bounds.width, bounds.height);
          newSpriteInfo.uvSize = new Vector2(bounds.width, bounds.height);
          database.uiSprites.push(newSpriteInfo);

          let brt = pixiNodeUtil.getNewBaseRenderTexture({ width: bounds.width, height: bounds.height });
          let rt = pixiNodeUtil.getNewRenderTexture(brt);

          pixiNodeUtil.pixiApp.renderer.render(container, rt);
          let base64: string = pixiNodeUtil.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

          let group = await Jimp.read(Buffer.from(base64.replace(/^data:image\/png;base64,/, ""), 'base64'));
          let groupePath = './assets/images/' + textureName + '.png';
          console.log('saving group to ' + groupePath);
          group.write(groupePath);

          // Free memory
          brt.destroy();
          brt = null;
          rt.destroy();
          rt = null;
          container.destroy({ children: true });
          container = null;
          global.gc && global.gc();
        } catch (error) {
          console.error(`Error processing sprite group for ${oniItem.id}:`, error);
          continue;  // Skip this item but continue with others
        }
      }

      let data = JSON.stringify(database, null, 2);
      fs.writeFileSync('./assets/database/database-groups.json', data);
      console.log('done generating groups');
    } catch (error) {
      console.error('Error in generateGroups:', error);
      throw error;
    }
  }

}

// Only execute this script if loaded directly with node
if (require.main === module) {
  const projectRoot = path.join(__dirname, '../../../../');
  const assetsImagesDir = path.join(projectRoot, 'assets/images');
  new GenerateGroups('./assets/database/database.json', assetsImagesDir);
}
