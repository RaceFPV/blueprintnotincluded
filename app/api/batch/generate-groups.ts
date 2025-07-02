import dotenv from 'dotenv';
import { Database } from '../db';
import { BlueprintModel, Blueprint } from '../models/blueprint';
import * as fs from 'fs';
import * as jimp from 'jimp';
import { BatchUtils } from './batch-utils';
import { BExport, SpriteTag, Vector2 } from "../../../lib/index";
import { ImageSource, BuildableElement, BuildMenuCategory, BuildMenuItem, BSpriteInfo, SpriteInfo, BSpriteModifier, SpriteModifier, BBuilding, OniItem, MdbBlueprint } from '../../../lib';
import { PixiNodeUtil } from '../pixi-node-util';
import * as path from 'path';


export class GenerateGroups {
  private assetsImagesDir: string;
  private frontendImagesDir: string;

  constructor(databasePath: string, assetsImagesDir: string) {
    console.log('Running batch GenerateGroups')
    this.assetsImagesDir = assetsImagesDir;
    this.frontendImagesDir = path.join(assetsImagesDir, '../../frontend/src/assets/images');

    // initialize configuration
    dotenv.config();
    console.log(process.env.ENV_NAME);

    // Always load from original database for core data (to avoid missing sprite modifier references)
    console.log(`Loading core database from: ${databasePath}`);
    let rawdata = fs.readFileSync(databasePath).toString();
    let json = JSON.parse(rawdata);
    
    // Load grouped database separately for sprite info checking (if it exists)
    const groupedDatabasePath = './assets/database/database-groups.json';
    let groupedDatabase = null;
    if (fs.existsSync(groupedDatabasePath)) {
      console.log(`Loading grouped database for cache checking from: ${groupedDatabasePath}`);
      const groupedRawdata = fs.readFileSync(groupedDatabasePath).toString();
      groupedDatabase = JSON.parse(groupedRawdata);
    }

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

    this.generateGroups(json, groupedDatabase);
  }

  async generateGroups(database: BExport, groupedDatabase: BExport | null = null) {
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

      // Initialize PIXI for on-demand texture loading
      console.log('Initializing PIXI...');
      await pixiNodeUtil.initTextures();
      
      // Skip expensive batch pre-loading - load textures on-demand only when needed
      console.log('Using on-demand texture loading and UV coordinates from database...');

      // Process buildings for grouping (UI icons already handled by GenerateUI)
      console.log('\nProcessing buildings for sprite grouping...');
      
      let totalItems = OniItem.oniItems.length;
      let processedItems = 0;
      let groupedItems = 0;
      
      // Now process each building
      for (let oniItem of OniItem.oniItems) {
        processedItems++;
        if (processedItems % 50 === 0) {
          console.log(`Progress: ${processedItems}/${totalItems} buildings processed, ${groupedItems} grouped`);
        }
        if (oniItem.id == OniItem.elementId || oniItem.id == OniItem.infoId) continue;

        const buildingInDatabase = database.buildings.find(b => b.prefabId == oniItem.id);
        if (!buildingInDatabase) continue;

        // Legacy approach: individual sprite files should already exist from previous steps

        // Updated filtering: include all sprites except UI sprites
        let spritesToGroup: SpriteModifier[] = [];
        let uiSprites: SpriteModifier[] = [];
        
        for (const spriteModifier of oniItem.spriteGroup.spriteModifiers) {
          if (!spriteModifier) continue;

          // Collect UI sprites separately for fallback
          if (spriteModifier.tags.indexOf(SpriteTag.ui) !== -1) {
            uiSprites.push(spriteModifier);
            continue;
          }

          spritesToGroup.push(spriteModifier);
        }

        // If no solid sprites to group, skip entirely (let user copy raw images manually)
        if (spritesToGroup.length <= 1) {
          if (uiSprites.length > 0) {
            console.log(`${oniItem.id}: SKIPPING - Too few sprites to group (${spritesToGroup.length} solid sprites, ${uiSprites.length} UI sprites). Copy raw images manually.`);
            continue; // Skip this building entirely
          } else {
            console.log(`${oniItem.id} should not be grouped (${spritesToGroup.length} solid sprites, ${uiSprites.length} UI sprites)`);
            continue;
          }
        }

        console.log(`${oniItem.id}: ${spritesToGroup.length} sprites to group`);
        
        // Skip tiles and conduits (they have too many connection sprites)
        if (oniItem.id.includes('Tile') || oniItem.id.includes('Conduit') || oniItem.id.includes('Wire')) {
          console.log(`${oniItem.id} skipped (tile/conduit type)`);
          continue;
        }

        try {
          console.log(`\n=== Processing ${oniItem.id} ===`);
          console.log(`Building texture: ${buildingInDatabase.textureName}`);
          console.log(`Sprites to group: ${spritesToGroup.length}`);
          
          let modifierId = oniItem.id + '_group_modifier';
          let spriteInfoId = oniItem.id + '_group_sprite';
          let textureName = oniItem.id + '_group_sprite';
          
          // Check if grouped sprite already exists
          const frontendImagesDir = './frontend/src/assets/images/';
          const frontendGroupPath = frontendImagesDir + textureName + '.png';
          const backendGroupPath = './assets/images/' + textureName + '.png';
          
          // Skip if both files exist and sprite info exists in database
          const frontendExists = fs.existsSync(frontendGroupPath);
          const backendExists = fs.existsSync(backendGroupPath);
          const spriteExists = frontendExists && backendExists;
          
          // Check sprite info existence in grouped database (if available)
          const spriteInfoExists = groupedDatabase ? 
            groupedDatabase.uiSprites.some(s => s.name === spriteInfoId) : false;
          
          console.log(`📋 Cache check for ${oniItem.id}:`);
          console.log(`   Frontend file: ${frontendExists ? '✅' : '❌'} ${frontendGroupPath}`);
          console.log(`   Backend file: ${backendExists ? '✅' : '❌'} ${backendGroupPath}`);
          console.log(`   Sprite info in DB: ${spriteInfoExists ? '✅' : '❌'} ${spriteInfoId}`);
          console.log(`   Grouped DB available: ${groupedDatabase ? '✅' : '❌'}`);
          
          if (spriteExists && spriteInfoExists && groupedDatabase) {
            console.log(`⏭️ SKIPPING ${oniItem.id} - grouped sprite already exists`);
            
            // Still need to update the building's sprite group to use the existing grouped sprite
            const existingSpriteInfo = groupedDatabase.uiSprites.find(s => s.name === spriteInfoId);
            const existingSpriteModifier = groupedDatabase.spriteModifiers.find(s => s.name === modifierId);
            
            if (existingSpriteInfo && existingSpriteModifier) {
              // Create runtime SpriteModifier
              let runtimeSpriteModifier = new SpriteModifier(modifierId);
              runtimeSpriteModifier.spriteInfoName = spriteInfoId;
              runtimeSpriteModifier.rotation = 0;
              runtimeSpriteModifier.scale = new Vector2(1, 1);
              runtimeSpriteModifier.translation = new Vector2(0, 0);
              runtimeSpriteModifier.tags = [SpriteTag.solid];
              
              // Replace the building's sprite group
              oniItem.spriteGroup.spriteModifiers = [runtimeSpriteModifier];
              buildingInDatabase.textureName = textureName;
              
              // CRITICAL FIX: Also update the building's sprite list for skipped items
              // Remove ALL individual building sprites, keep only place/UI + grouped modifier
              console.log(`  🧹 Updating skipped building sprite list for ${oniItem.id}...`);
              console.log(`    Before: ${buildingInDatabase.sprites.spriteNames.length} sprites`);
              
              // Keep only place and UI sprites, remove ALL individual building sprites
              const preservedSprites = buildingInDatabase.sprites.spriteNames.filter(name => 
                name.includes('_place') || name.includes('_ui')
              );
              
              // Remove all individual building sprites (those that start with building name + "_off_" pattern)
              const buildingPrefix = oniItem.id + '_';
              const individualSpritesToRemove = buildingInDatabase.sprites.spriteNames.filter(name => 
                name.startsWith(buildingPrefix) && name.includes('_off_') && 
                !name.includes('_place') && !name.includes('_ui')
              );
              
              console.log(`    Removing ${individualSpritesToRemove.length} individual sprites:`, individualSpritesToRemove);
              
              // Replace with preserved sprites + grouped modifier
              buildingInDatabase.sprites.spriteNames = [...preservedSprites, modifierId];
              
              console.log(`    After: ${buildingInDatabase.sprites.spriteNames.length} sprites`);
              console.log(`    Final sprites:`, buildingInDatabase.sprites.spriteNames);
              
              // Register in ImageSource
              const relativeImagePath = `images/${textureName}.png`;
              ImageSource.AddImagePixi(textureName, relativeImagePath);
            }
            
            groupedItems++;
            continue;
          }
          
          console.log(`🔄 GENERATING new grouped sprite for ${oniItem.id}`);
          
          // Debug: Show all sprite modifier names for this building
          console.log(`All sprite modifiers:`, oniItem.spriteGroup.spriteModifiers.map(s => s?.spriteInfoName).filter(Boolean));
          
          // Debug: Check if any sprite infos exist for this building prefix
          const allSpriteInfos = database.uiSprites.map(s => s.name);
          const matchingSprites = allSpriteInfos.filter(name => name.includes(oniItem.id) || name.includes(buildingInDatabase.textureName));
          console.log(`Matching sprite infos in database:`, matchingSprites.slice(0, 10)); // Show first 10 matches
          
          let container = pixiNodeUtil.getNewContainer();
          container.sortableChildren = true;

          let indexDrawPart = 0;
          for (let spriteModifier of spritesToGroup) {
            // Skip UI sprites (we only process solid building sprites)
            if (spriteModifier.tags.indexOf(SpriteTag.ui) !== -1) {
              continue;
            }
            
            // Skip placement sprites (white overlays that mess up grouped sprites)
            if (spriteModifier.spriteInfoName.includes('_place')) {
              continue;
            }

            console.log(`\nProcessing sprite: ${spriteModifier.spriteInfoName}`);

            // Try to convert sprite name to match database pattern
            // From: "AdvancedApothecary_capsule_0" 
            // To: "AdvancedApothecary_off_0_capsule"
            let databaseSpriteName = spriteModifier.spriteInfoName;
            console.log(`Original sprite name: ${spriteModifier.spriteInfoName}`);
            
            // Check if it follows the BuildingName_PartName_0 pattern and needs conversion
            const match = spriteModifier.spriteInfoName.match(/^([^_]+)_(.+)_(\d+)$/);
            if (match && !spriteModifier.spriteInfoName.includes('_off_') && !spriteModifier.spriteInfoName.endsWith('_place_0')) {
              const [, buildingName, partName, frameNum] = match;
              
              console.log(`  Trying conversions for: ${spriteModifier.spriteInfoName}`);
              console.log(`    Building: ${buildingName}, Part: ${partName}, Original Frame: ${frameNum}`);
              
              let found = false;
              // Try different animation states
              const states = ['off', 'on', 'working'];
              // Try frame numbers 0-20 (database uses sequential indices)
              const maxFrames = 20;
              
              for (const state of states) {
                if (found) break;
                for (let i = 0; i < maxFrames; i++) {
                  const potentialName = `${buildingName}_${state}_${i}_${partName}`;
                  if (database.uiSprites.some(s => s.name === potentialName)) {
                    databaseSpriteName = potentialName;
                    console.log(`  ✅ SUCCESS: ${spriteModifier.spriteInfoName} → ${databaseSpriteName}`);
                    found = true;
                    break;
                  }
                }
              }
              
              if (!found) {
                console.log(`  ❌ FAILED: No database match found for ${spriteModifier.spriteInfoName}`);
                // Show what sprites DO exist for this building
                const buildingSprites = database.uiSprites.filter(s => s.name.startsWith(buildingName + '_')).slice(0, 8);
                console.log(`    Available sprites for ${buildingName}:`, buildingSprites.map(s => s.name));
              }
            }

            let spriteInfo = SpriteInfo.getSpriteInfo(databaseSpriteName);
            
            // Debug: log what texture the sprite info is looking for
            console.log(`Sprite expects:`, {
              spriteInfoId: spriteInfo.spriteInfoId,
              buildingTexture: buildingInDatabase.textureName,
              uvMin: spriteInfo.uvMin,
              uvSize: spriteInfo.uvSize
            });
            
            // Try to ensure the main building texture is loaded
            const texturePath = path.join(this.assetsImagesDir, buildingInDatabase.textureName + '.png');
            if (fs.existsSync(texturePath)) {
              const imageData = fs.readFileSync(texturePath);
              const base64Image = `data:image/png;base64,${imageData.toString('base64')}`;
              ImageSource.AddImagePixi(buildingInDatabase.textureName, base64Image);
              
              const baseTexture = await pixiNodeUtil.createBaseTexture(base64Image);
              ImageSource.setBaseTexture(buildingInDatabase.textureName, baseTexture);
              console.log(`Loaded main texture: ${buildingInDatabase.textureName}`);
            } else {
              console.warn(`Main texture file missing: ${texturePath}`);
              continue;
            }
            
            // Use main texture extraction with UV coordinates
            let texture = spriteInfo.getTextureFromMainTexture(pixiNodeUtil, buildingInDatabase.textureName);
            if (!texture) {
              console.warn(`Failed to extract texture for ${oniItem.id} - ${spriteModifier.spriteInfoName} from ${buildingInDatabase.textureName}`);
              continue;
            }

            let sprite = pixiNodeUtil.getSpriteFrom(texture);
            
            // Set sprite properties (legacy approach)
            sprite.anchor.set(spriteInfo.pivot.x, 1 - spriteInfo.pivot.y);
            sprite.x = 0 + (spriteModifier.translation.x);
            sprite.y = 0 - (spriteModifier.translation.y);
            sprite.width = spriteInfo.realSize.x;
            sprite.height = spriteInfo.realSize.y;
            sprite.scale.x = spriteModifier.scale.x;
            sprite.scale.y = spriteModifier.scale.y;
            sprite.angle = -spriteModifier.rotation;
            sprite.zIndex -= (indexDrawPart / 50);

            container.addChild(sprite);
            indexDrawPart++;
          }

          // DON'T add grouped modifier yet - wait until cleanup is complete

          container.calculateBounds();
          let bounds = container.getBounds();
          
          // Legacy bounds calculation with floor/ceil
          bounds.x = Math.floor(bounds.x);
          bounds.y = Math.floor(bounds.y);
          bounds.width = Math.ceil(bounds.width);
          bounds.height = Math.ceil(bounds.height);
          
          console.log(`Saving group to ./frontend/src/assets/images/${textureName}.png`);

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

          // Create and add the new sprite modifier to replace the group (for database)
          let newBSpriteModifier = new BSpriteModifier();
          newBSpriteModifier.name = modifierId;
          newBSpriteModifier.spriteInfoName = spriteInfoId;
          newBSpriteModifier.rotation = 0;
          newBSpriteModifier.scale = new Vector2(1, 1);
          newBSpriteModifier.translation = new Vector2(0, 0);
          newBSpriteModifier.tags = [SpriteTag.solid];
          database.spriteModifiers.push(newBSpriteModifier);

          // Create and add the new spriteInfo
          let newSpriteInfo = new BSpriteInfo();
          newSpriteInfo.name = spriteInfoId;
          newSpriteInfo.textureName = textureName;
          newSpriteInfo.pivot = pivot;
          newSpriteInfo.uvMin = new Vector2(0, 0);
          newSpriteInfo.realSize = new Vector2(bounds.width, bounds.height);
          newSpriteInfo.uvSize = new Vector2(bounds.width, bounds.height);
          database.uiSprites.push(newSpriteInfo);

          // Also add to runtime sprite info map
          let runtimeSpriteInfo = new SpriteInfo(spriteInfoId);
          runtimeSpriteInfo.copyFrom(newSpriteInfo);
          SpriteInfo.addSpriteInfo(runtimeSpriteInfo);
          console.log(`    📝 Added grouped sprite info to static map: ${spriteInfoId}`);

          // Create runtime SpriteModifier for the OniItem (different type)
          let runtimeSpriteModifier = new SpriteModifier(modifierId);
          runtimeSpriteModifier.spriteInfoName = spriteInfoId;
          runtimeSpriteModifier.rotation = 0;
          runtimeSpriteModifier.scale = new Vector2(1, 1);
          runtimeSpriteModifier.translation = new Vector2(0, 0);
          runtimeSpriteModifier.tags = [SpriteTag.solid];

          // Add the new grouped modifier to static map so it can be found by getSpriteModifier
          SpriteModifier.addSpriteModifier(runtimeSpriteModifier);
          console.log(`    📝 Added grouped sprite modifier to static map: ${modifierId}`);

          // CRITICAL: Replace the building's sprite group with just the single grouped sprite
          oniItem.spriteGroup.spriteModifiers = [runtimeSpriteModifier];
          
          // CLEANUP: Remove individual sprite references from database that were grouped
          console.log(`  🧹 Cleaning up ${spritesToGroup.length} individual sprites from database...`);
          let actuallyRemoved = 0;
          let processedSpriteNames: string[] = []; // Track which sprite names we actually processed
          let uniqueProcessedSpriteNames = new Set<string>(); // Deduplicate sprite names
          
          for (const spriteModifier of spritesToGroup) {
            // Skip placement and UI sprites during cleanup too
            if (spriteModifier.tags.indexOf(SpriteTag.ui) !== -1 || 
                spriteModifier.spriteInfoName.includes('_place')) {
              continue;
            }
            
            // Convert sprite name to match database pattern (same logic as processing)
            let databaseSpriteName = spriteModifier.spriteInfoName;
            const match = spriteModifier.spriteInfoName.match(/^([^_]+)_(.+)_(\d+)$/);
            if (match && !spriteModifier.spriteInfoName.includes('_off_') && !spriteModifier.spriteInfoName.endsWith('_place_0')) {
              const [, buildingName, partName, frameNum] = match;
              
              // Try to find the converted name (same logic as processing loop)
              let found = false;
              const states = ['off', 'on', 'working'];
              const maxFrames = 20;
              
              for (const state of states) {
                if (found) break;
                for (let i = 0; i < maxFrames; i++) {
                  const potentialName = `${buildingName}_${state}_${i}_${partName}`;
                  if (database.uiSprites.some(s => s.name === potentialName)) {
                    databaseSpriteName = potentialName;
                    found = true;
                    break;
                  }
                }
              }
            }
            
            // Add to both tracking arrays (processedSpriteNames for logging, uniqueProcessedSpriteNames for deduplication)
            processedSpriteNames.push(databaseSpriteName);
            uniqueProcessedSpriteNames.add(databaseSpriteName);
          }
          
          // Remove duplicates and process each unique sprite name only once
          console.log(`  🧹 Removing ${uniqueProcessedSpriteNames.size} unique sprites from database (${processedSpriteNames.length} total processed)...`);
          for (const databaseSpriteName of Array.from(uniqueProcessedSpriteNames)) {
            // Remove the sprite modifier from database
            const modifierIndex = database.spriteModifiers.findIndex(sm => sm.name === databaseSpriteName);
            if (modifierIndex !== -1) {
              database.spriteModifiers.splice(modifierIndex, 1);
              console.log(`    ✅ Removed sprite modifier: ${databaseSpriteName}`);
            }
            
            // CRITICAL: Also remove from static map so future lookups don't find old modifiers
            SpriteModifier.removeSpriteModifier(databaseSpriteName);
            
            // Remove the sprite info from database
            const spriteInfoIndex = database.uiSprites.findIndex(si => si.name === databaseSpriteName);
            if (spriteInfoIndex !== -1) {
              database.uiSprites.splice(spriteInfoIndex, 1);
              console.log(`    ✅ Removed sprite info: ${databaseSpriteName}`);
              actuallyRemoved++;
            }
          }
          
          // CRITICAL FIX: Remove processed sprite names from building's sprite list (use unique names)
          console.log(`  🧹 Removing processed sprite names from building sprite list...`);
          let removedFromBuilding = 0;
          for (const spriteName of Array.from(uniqueProcessedSpriteNames)) {
            const buildingSpriteIndex = buildingInDatabase.sprites.spriteNames.indexOf(spriteName);
            if (buildingSpriteIndex !== -1) {
              buildingInDatabase.sprites.spriteNames.splice(buildingSpriteIndex, 1);
              console.log(`    ✅ Removed from building sprites: ${spriteName}`);
              removedFromBuilding++;
            }
          }
          
          console.log(`    📊 Actually removed ${actuallyRemoved} sprites from database, ${removedFromBuilding} from building sprite list`);
          
          // CRITICAL: Only add the grouped modifier if cleanup was successful
          const expectedToRemove = uniqueProcessedSpriteNames.size;
          if (removedFromBuilding === expectedToRemove) {
            buildingInDatabase.sprites.spriteNames.push(modifierId);
            console.log(`    ✅ Added grouped modifier to building: ${modifierId}`);
          } else {
            console.error(`    ❌ CLEANUP FAILED: Expected to remove ${expectedToRemove} sprites from building, but only removed ${removedFromBuilding}`);
            console.error(`    ❌ Skipping grouped modifier addition to prevent database corruption`);
            continue; // Skip this building
          }
          
          // Update building's texture reference to use the grouped sprite
          buildingInDatabase.textureName = textureName;
          
          // DEBUG: Verify changes were applied immediately after modification
          console.log(`\n🔍 DEBUG: ${oniItem.id} sprites immediately after modification:`);
          console.log(`   Total sprites: ${buildingInDatabase.sprites.spriteNames.length}`);
          console.log(`   Sprite names:`, buildingInDatabase.sprites.spriteNames);
          console.log(`   Contains grouped modifier: ${buildingInDatabase.sprites.spriteNames.includes(modifierId)}`);
          console.log(`   Texture name: ${buildingInDatabase.textureName}`);
          
          console.log(`✅ Replaced ${oniItem.id} sprite group (${spritesToGroup.length} sprites → 1 grouped sprite)`);

          let brt = pixiNodeUtil.getNewBaseRenderTexture({ width: bounds.width, height: bounds.height });
          let rt = pixiNodeUtil.getNewRenderTexture(brt);

          pixiNodeUtil.pixiApp.renderer.render(container, rt);
          let base64: string = pixiNodeUtil.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

          let group = await jimp.read(Buffer.from(base64.replace(/^data:image\/png;base64,/, ""), 'base64'));
          
          // Ensure frontend images directory exists
          if (!fs.existsSync(frontendImagesDir)) {
            fs.mkdirSync(frontendImagesDir, { recursive: true });
          }
          
          // Save to frontend directory where it will actually be used
          group.write(frontendGroupPath);
          
          // Also save to backend assets for consistency/backup
          group.write(backendGroupPath);

          // Register the grouped sprite in ImageSource so it can be loaded by the frontend
          const relativeImagePath = `images/${textureName}.png`;
          ImageSource.AddImagePixi(textureName, relativeImagePath);
          console.log(`📝 Registered grouped sprite: ${textureName} → ${relativeImagePath}`);

          // Free memory
          brt.destroy();
          brt = null;
          rt.destroy();
          rt = null;
          container.destroy({ children: true });
          container = null;
          global.gc && global.gc();
          
          groupedItems++;
        } catch (error) {
          console.error(`Error processing sprite group for ${oniItem.id}:`, error);
          continue;  // Skip this item but continue with others
        }
      }
      
      console.log(`\nBuilding grouping complete: ${groupedItems}/${totalItems} buildings grouped`);

      // DEBUG: Check the Bed entry right before writing to disk
      const bedBeforeWrite = database.buildings.find(b => b.prefabId === 'Bed');
      if (bedBeforeWrite) {
        console.log(`\n🔍 DEBUG: Bed sprites right before writing database:`);
        console.log(`   Total sprites: ${bedBeforeWrite.sprites.spriteNames.length}`);
        console.log(`   Sprite names:`, bedBeforeWrite.sprites.spriteNames);
        console.log(`   Contains grouped modifier: ${bedBeforeWrite.sprites.spriteNames.includes('Bed_group_modifier')}`);
        console.log(`   Texture name: ${bedBeforeWrite.textureName}`);
      }

      let data = JSON.stringify(database, null, 2);
      fs.writeFileSync('./assets/database/database-groups.json', data);
      
      // Fix: Copy to the correct path that frontend actually loads from
      const frontendDatabasePath = './frontend/src/assets/database/database.json';
      
      // Ensure the database directory exists in frontend assets
      const frontendDatabaseDir = path.dirname(frontendDatabasePath);
      if (!fs.existsSync(frontendDatabaseDir)) {
        fs.mkdirSync(frontendDatabaseDir, { recursive: true });
        console.log(`Created frontend database directory: ${frontendDatabaseDir}`);
      }
      
      fs.copyFileSync('./assets/database/database-groups.json', frontendDatabasePath);
      console.log(`✅ Copied grouped database to frontend: ${frontendDatabasePath}`);

      console.log('Done generating groups');
    } catch (error) {
      console.error('Error in generateGroups:', error);
      throw error;
    }
  }

}

// Only execute this script if loaded directly with node
if (require.main === module) {
  const assetsImagesDir = path.join(__dirname, '../../../assets/images');
  new GenerateGroups('./assets/database/database.json', assetsImagesDir);
}

