import { JSDOM } from 'jsdom';
const { window } = new JSDOM();
(global as any).window = window;
(global as any).document = window.document;
(global as any).navigator = window.navigator;
(global as any).requestAnimationFrame = null;
(global as any).cancelAnimationFrame = null;

import * as fs from 'fs';
import {
  copySync // fs.cpSync available in Node v16.7.0
} from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import { BExport } from "../../../lib/index";
import { FixHtmlLabels } from "./fix-html-labels";
import { AddInfoIcons } from './add-info-icons';
import { GenerateIcons } from './generate-icons';
import { GenerateGroups } from './generate-groups';
import { renameBuildings, updateJsonFile } from './database-massager';
import { PixiNodeUtil } from '../pixi-node-util';


const projectRoot = path.join(__dirname, '../../../../');
// Transform project relative path to absolute paths
const absolutePath = (projectPathFromRoot: string) => path.join(projectRoot, projectPathFromRoot);
const databasePath = absolutePath('export/database/database.json');
// Clean working export dir and unzip extract export.zip
const freshExport = () => {
  console.log('Starting freshExport...');
  console.log('Removing export directory...');
  fs.rmdirSync(absolutePath('export'), { recursive: true });
  
  console.log('Extracting export.zip...');
  const zipPath = absolutePath('export.zip');
  console.log('Zip file exists:', fs.existsSync(zipPath));
  const zip = new AdmZip(absolutePath('export.zip'));
  
  // Extract to a temp directory first
  console.log('Extracting to temp directory...');
  const tempDir = absolutePath('temp_export');
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir, { recursive: true });
  }
  zip.extractAllTo(tempDir);
  
  // Move contents from nested 'export' directory to correct location
  console.log('Moving files from nested export directory...');
  const nestedExportDir = path.join(tempDir, 'export');
  if (fs.existsSync(nestedExportDir)) {
    fs.renameSync(nestedExportDir, absolutePath('export'));
    fs.rmdirSync(tempDir, { recursive: true });
  } else {
    console.error('Expected nested export directory not found!');
    console.log('Contents of temp directory:', fs.readdirSync(tempDir));
  }
  
  console.log('Extraction complete');
  console.log('export/images exists:', fs.existsSync(absolutePath('export/images')));
  
  // List contents of export directory
  const exportDir = absolutePath('export');
  if (fs.existsSync(exportDir)) {
    console.log('\nContents of export directory:');
    fs.readdirSync(exportDir).forEach(file => {
      console.log(' -', file);
    });
  }
}

// Move newly extracted images to the backend images directory
const replaceImages = () => {
  console.log('\nStarting replaceImages...');
  console.log('Current working directory:', process.cwd());
  
  const assetsImagesPath = absolutePath('assets/images');
  const exportImagesPath = absolutePath('export/images');
  const manualAssetsPath = absolutePath('assets/manual');
  const uiPath = absolutePath('assets/images/ui');
  
  console.log('\nChecking paths before operations:');
  console.log('assets/images exists:', fs.existsSync(assetsImagesPath));
  console.log('export/images exists:', fs.existsSync(exportImagesPath));
  console.log('assets/manual exists:', fs.existsSync(manualAssetsPath));
  
  // Clean and recreate directories
  console.log('\nCleaning and creating directories...');
  if (fs.existsSync(assetsImagesPath)) {
    fs.rmdirSync(assetsImagesPath, { recursive: true });
  }
  fs.mkdirSync(assetsImagesPath);
  fs.mkdirSync(uiPath);
  
  // List contents of export/images before moving
  if (fs.existsSync(exportImagesPath)) {
    console.log('\nContents of export/images before moving:');
    listDirectoryContents(exportImagesPath);
  }
  
  // Copy (not move) export/images to assets/images
  console.log('\nCopying export/images to assets/images...');
  copySync(exportImagesPath, assetsImagesPath);
  
  console.log('Copying manual assets...');
  copySync(manualAssetsPath, assetsImagesPath);
  
  // List contents after all operations
  console.log('\nFinal contents of assets/images:');
  listDirectoryContents(assetsImagesPath);
}

// Helper function to recursively list directory contents
function listDirectoryContents(dir: string, indent: string = '') {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      console.log(indent + '📁 ' + file);
      listDirectoryContents(fullPath, indent + '  ');
    } else {
      console.log(indent + '📄 ' + file);
    }
  });
}

const generateDatabase = () => {
  new FixHtmlLabels(databasePath);
  new AddInfoIcons(databasePath);
  updateJsonFile(databasePath, (database: BExport) => {
    return renameBuildings(database, absolutePath('assets/manual-buildMenuRename.json'));
  })
}

const validateDatabase = (database: BExport) => {
  console.log('Validating database...');
  let modified = false;

  // Validate buildings
  database.buildings = database.buildings.map(building => {
    if (building.utilities) {
      building.utilities = building.utilities.filter(utility => {
        if (!utility || utility.offset === null) {
          console.warn(`Removing null utility in building: ${building.prefabId}`);
          modified = true;
          return false;
        }
        return true;
      });
    }
    return building;
  });

  if (modified) {
    console.log('Database was modified during validation, saving changes...');
    fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));
  }
  
  return database;
}

const processImages = async () => {
  const rawdata = fs.readFileSync(databasePath).toString();
  const database: BExport = JSON.parse(rawdata);

  await new GenerateIcons(databasePath).generateIcons();
  await new GenerateGroups(databasePath, absolutePath('assets/images')).generateGroups(database);
}

const replaceDatabase = () => {
  var zip = new AdmZip();
  zip.addLocalFile(databasePath);
  zip.writeZip('assets/database/database.zip');
  fs.copyFileSync('assets/database/database.zip', 'frontend/src/assets/database/database.zip');
  fs.copyFileSync(databasePath, 'frontend/src/assets/database.json');
}

export const extractExport = async () => {
  try {
    console.log('\n=== Starting Export Process ===');
    
    // Define all directory paths up front
    const assetsImagesDir = absolutePath('assets/images');
    const assetsUiDir = absolutePath('assets/images/ui');
    const frontendImagesDir = absolutePath('frontend/src/assets/images');
    const frontendUiDir = absolutePath('frontend/src/assets/images/ui');
    const exportImagesDir = absolutePath('export/images');
    const manualAssetsDir = absolutePath('assets/manual');
    
    // Step 1: Extract files from export.zip
    console.log('\n1. Extracting files...');
    freshExport();
    
    // Step 2: Set up image directories and copy images
    console.log('\n2. Setting up images...');
    // Create necessary directories
    fs.mkdirSync(assetsImagesDir, { recursive: true });
    fs.mkdirSync(assetsUiDir, { recursive: true });
    fs.mkdirSync(frontendImagesDir, { recursive: true });
    fs.mkdirSync(frontendUiDir, { recursive: true });
    
    // First verify and copy all images from export
    console.log('Copying and verifying images from export...');
    fs.readdirSync(exportImagesDir).forEach(file => {
      if (!file.toLowerCase().endsWith('.png')) return;
      
      const sourcePath = path.join(exportImagesDir, file);
      const destPath = path.join(assetsImagesDir, file);
      
      try {
        // Copy to main images directory
        copySync(sourcePath, destPath);
        console.log(`Copied ${file} to assets/images`);
        
        // If it's a UI image, also copy to UI directory
        if (file.includes('_ui_') || file.startsWith('info_') || file.includes('_place_')) {
          const uiDestPath = path.join(assetsUiDir, file);
          copySync(sourcePath, uiDestPath);
          console.log(`Copied ${file} to assets/images/ui`);
        }
      } catch (error) {
        console.error(`Failed to copy ${file}:`, error);
      }
    });
    
    // Step 3: Process database
    console.log('\n3. Processing database...');
    
    // Copy original database.json to assets/database
    console.log('Copying original database...');
    fs.mkdirSync(absolutePath('assets/database'), { recursive: true });
    copySync(
      databasePath,  // from export/database/database.json
      absolutePath('assets/database/database.json')  // to assets/database/database.json
    );
    
    // Create and copy database zip
    console.log('Creating database zip...');
    const zip = new AdmZip();
    zip.addLocalFile(databasePath);
    zip.writeZip(absolutePath('assets/database/database.zip'));
    
    // Copy zip to frontend
    console.log('Copying database zip to frontend...');
    copySync(
      absolutePath('assets/database/database.zip'), 
      absolutePath('frontend/src/assets/database/database.zip')
    );
    
    // Step 4: Run database processors
    console.log('\n4. Running database processors...');
    new FixHtmlLabels(databasePath);
    new AddInfoIcons(databasePath);
    
    // Validate database before generation steps
    const database: BExport = JSON.parse(fs.readFileSync(databasePath).toString());
    const validatedDatabase = validateDatabase(database);
    
    // Step 5: Generate images
    console.log('\n5. Generating images...');
    await new GenerateIcons(databasePath).generateIcons();
    await new GenerateGroups(databasePath, assetsImagesDir).generateGroups(validatedDatabase);
    
    // Step 6: Final database copy
    console.log('\n6. Copying final database and images...');
    // Keep original database.json in assets/database
    copySync(
      databasePath,
      absolutePath('assets/database/database.json')
    );
    // Copy regular database directly to frontend
    copySync(
      databasePath,
      absolutePath('frontend/src/assets/database.json')
    );
    
    // Step 7: Copy all generated images to frontend
    console.log('\n7. Copying all generated images to frontend...');
    
    // Copy ALL images from assets/images to frontend/src/assets/images
    console.log('Copying all images to frontend...');
    if (fs.existsSync(assetsImagesDir)) {
      copySync(assetsImagesDir, frontendImagesDir);
    }
    
    // Copy ALL UI-related images to UI directories
    console.log('Copying UI images to UI directories...');
    if (fs.existsSync(assetsImagesDir)) {
      fs.readdirSync(assetsImagesDir)
        .filter(file => {
          const lowerFile = file.toLowerCase();
          return lowerFile.endsWith('.png') && (
            lowerFile.includes('_ui_') ||      // UI images
            lowerFile.startsWith('info_') ||    // Info images
            lowerFile.includes('_front_') ||    // Front overlays
            lowerFile.includes('_overlay_') ||  // Other overlays
            lowerFile.includes('_input_') ||    // Input/Output images
            lowerFile.includes('_output_') ||   // Input/Output images
            lowerFile.includes('_icon_') ||     // Icon images
            lowerFile.includes('_place_')        // Place images
          );
        })
        .forEach(file => {
          // Copy to assets UI directory
          copySync(
            path.join(assetsImagesDir, file),
            path.join(assetsUiDir, file)
          );
          // Copy to frontend UI directory
          copySync(
            path.join(assetsImagesDir, file),
            path.join(frontendUiDir, file)
          );
          console.log(`Copied UI image: ${file}`);
        });
    }
    
    console.log('\n=== Export Process Complete ===');
  } catch (error) {
    console.error('Error during export process:', error);
    throw error;
  } finally {
    // Clear image cache
    PixiNodeUtil.clearImageCache();
    
    // Force cleanup of any remaining PIXI resources
    if (global.PIXI) {
      global.PIXI.utils.destroyTextureCache();
      global.PIXI.utils.clearTextureCache();
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Exit process after a small delay to ensure cleanup
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }
}

// Only execute this script if loaded directly with node
if (require.main === module) {
  extractExport()
    .then(() => {
      console.log('extractExport complete');
      // Note: Don't need process.exit here since it's in the finally block
    })
    .catch(error => {
      console.error('Failed to complete export:', error);
      process.exit(1);
    });
}
