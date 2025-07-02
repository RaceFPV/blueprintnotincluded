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
import { GenerateGroups } from './generate-groups'; // Use the fixed version
import { GenerateUI } from './generate-ui';
import { renameBuildings, updateJsonFile } from './database-massager';

const projectRoot = path.join(__dirname, '../../../');
// Transform project relative path to absolute paths
const absolutePath = (projectPathFromRoot: string) => path.join(projectRoot, projectPathFromRoot);
const databasePath = absolutePath('export/database/database.json');

// Clean working export dir and unzip extract export.zip
const freshExport = () => {
  console.log('🗂️  Extracting export.zip...');
  if (fs.existsSync(absolutePath('export'))) {
    fs.rmSync(absolutePath('export'), { recursive: true, force: true });
  }
  
  if (!fs.existsSync(absolutePath('export.zip'))) {
    throw new Error('export.zip not found in project root. Please copy the export.zip from your game first.');
  }
  
  const zip = new AdmZip(absolutePath('export.zip'));
  zip.extractAllTo(absolutePath('./'));
  console.log('✅ Export extracted successfully');
}

// Move newly extracted images to the backend images directory
const replaceImages = () => {
  console.log('🖼️  Moving images to assets folder...');
  
  // Clean out old images
  if (fs.existsSync(absolutePath('assets/images'))) {
    fs.rmSync(absolutePath('assets/images'), { recursive: true, force: true });
  }
  if (fs.existsSync(absolutePath('frontend/src/assets/images'))) {
    fs.rmSync(absolutePath('frontend/src/assets/images'), { recursive: true, force: true });
  }
  
  // Create directories
  fs.mkdirSync(absolutePath('assets/images'), { recursive: true });
  fs.mkdirSync(absolutePath('frontend/src/assets/images'), { recursive: true });
  
  // Move extracted images
  if (fs.existsSync(absolutePath('export/images'))) {
    copySync(absolutePath('export/images'), absolutePath('assets/images'));
  }
  
  // Copy manual assets if they exist
  if (fs.existsSync(absolutePath('assets/manual'))) {
    copySync(absolutePath('assets/manual'), absolutePath('assets/images'));
  }
  
  console.log('✅ Images moved successfully');
}

// Copy and process the database
const setupDatabase = () => {
  console.log('📊 Setting up database...');
  
  // Create database directories
  fs.mkdirSync(absolutePath('assets/database'), { recursive: true });
  fs.mkdirSync(absolutePath('frontend/src/assets/database'), { recursive: true });
  
  // Copy original database
  if (fs.existsSync(databasePath)) {
    copySync(databasePath, absolutePath('assets/database/database.json'));
    console.log('✅ Database copied successfully');
  } else {
    throw new Error('database.json not found in export/database/');
  }
}

const processDatabase = () => {
  console.log('⚙️  Processing database...');
  const workingDatabasePath = absolutePath('assets/database/database.json');
  
  new FixHtmlLabels(workingDatabasePath);
  new AddInfoIcons(workingDatabasePath);
  
  // Apply building renames if the file exists
  const renameFilePath = absolutePath('assets/manual-buildMenuRename.json');
  if (fs.existsSync(renameFilePath)) {
    updateJsonFile(workingDatabasePath, (database: BExport) => {
      return renameBuildings(database, renameFilePath);
    });
  }
  
  console.log('✅ Database processing complete');
}

const processImages = async () => {
  console.log('🎨 Generating images...');
  const workingDatabasePath = absolutePath('assets/database/database.json');
  const assetsImagesDir = absolutePath('assets/images');

  // Generate element UI sprites (individual element icons)
  console.log('  🧪 Generating element UI sprites...');
  const uiGenerator = new GenerateUI(workingDatabasePath);
  await uiGenerator.generateUI();

  // Generate category icons 
  console.log('  📱 Generating category icons...');
  const icons = new GenerateIcons(workingDatabasePath);
  await icons.generateIcons();

  // Generate grouped building sprites (this will also copy manual images to UI folder)
  console.log('  🏗️  Generating building groups...');
  const groups = new GenerateGroups(workingDatabasePath, assetsImagesDir);
  // Load the database for groups processing
  const rawData = fs.readFileSync(workingDatabasePath).toString();
  const database = JSON.parse(rawData);
  await groups.generateGroups(database);

  console.log('✅ Image processing complete');
}

const finalizeAssets = () => {
  console.log('📋 Finalizing assets...');
  
  // Ensure the database directory exists in frontend
  fs.mkdirSync(absolutePath('frontend/src/assets/database'), { recursive: true });
  
  // Copy the final grouped database to frontend (we use direct JSON loading now)
  const groupedDatabasePath = absolutePath('assets/database/database-groups.json');
  if (fs.existsSync(groupedDatabasePath)) {
    copySync(groupedDatabasePath, absolutePath('frontend/src/assets/database/database.json'));
    console.log('✅ Final database copied to frontend');
  } else {
    // Fallback to regular database if groups weren't generated
    copySync(absolutePath('assets/database/database.json'), absolutePath('frontend/src/assets/database/database.json'));
    console.log('✅ Regular database copied to frontend (no groups generated)');
  }
  
  // Copy generated UI images to frontend
  console.log('🖼️  Copying UI images to frontend...');
  const backendUIDir = absolutePath('assets/images/ui');
  const frontendUIDir = absolutePath('frontend/src/assets/images/ui');
  
  if (fs.existsSync(backendUIDir)) {
    // Ensure frontend UI directory exists
    fs.mkdirSync(frontendUIDir, { recursive: true });
    
    // Copy all UI images
    copySync(backendUIDir, frontendUIDir);
    console.log('✅ UI images copied to frontend');
  } else {
    console.warn('⚠️  No UI images found to copy');
  }
  
  // Copy generated building group sprites to frontend
  console.log('🏗️  Copying building group sprites to frontend...');
  const backendImagesDir = absolutePath('assets/images');
  const frontendImagesDir = absolutePath('frontend/src/assets/images');
  
  // Copy all PNG files from backend to frontend (group sprites)
  if (fs.existsSync(backendImagesDir)) {
    const files = fs.readdirSync(backendImagesDir);
    const groupSprites = files.filter(file => file.endsWith('_group_sprite.png'));
    
    for (const file of groupSprites) {
      const sourcePath = path.join(backendImagesDir, file);
      const destPath = path.join(frontendImagesDir, file);
      try {
        copySync(sourcePath, destPath);
      } catch (error) {
        console.warn(`Failed to copy ${file}:`, error);
      }
    }
    console.log(`✅ ${groupSprites.length} group sprites copied to frontend`);
  }
}

export const extractExport = async () => {
  console.log('🚀 Starting complete extraction and processing pipeline...\n');
  
  try {
    // Step 1: Extract the export
    freshExport();
    
    // Step 2: Setup directories and copy database
    setupDatabase();
    
    // Step 3: Move images
    replaceImages();
    
    // Step 4: Process database
    processDatabase();
    
    // Step 5: Generate all images
    await processImages();
    
    // Step 6: Finalize
    finalizeAssets();
    
    console.log('\n🎉 Complete extraction and processing pipeline finished successfully!');
    console.log('📁 Frontend assets are ready in frontend/src/assets/');
    console.log('🌐 You can now build and run the site');
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
    throw error;
  }
}

// Only execute this script if loaded directly with node
if (require.main === module) {
  extractExport()
    .then(() => {
      console.log('\n✨ All done! Ready to build and run the site.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Extract pipeline failed:', error);
      process.exit(1);
    });
}
