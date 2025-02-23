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
import { GenerateGroupsLegacy } from './generate-groups-legacy';
import { renameBuildings, updateJsonFile } from './database-massager';
import { GenerateUI } from './generate-ui';


const projectRoot = path.join(__dirname, '../../../../');
// Transform project relative path to absolute paths
const absolutePath = (projectPathFromRoot: string) => path.join(projectRoot, projectPathFromRoot);
const databasePath = absolutePath('export/database/database.json');
// Clean working export dir and unzip extract export.zip
const freshExport = () => {
  fs.rmdirSync(absolutePath('export'), { recursive: true });
  const zip = new AdmZip(absolutePath('export.zip'));
  zip.extractAllTo(absolutePath('/'));
}

// Move newly extracted images to the backend images directory
const replaceImages = () => {
  fs.rmdirSync(absolutePath('assets/images'), { recursive: true });
  fs.renameSync(absolutePath('export/images'), absolutePath('assets/images'))
  copySync(absolutePath('assets/manual'), absolutePath('assets/images'));
}

const generateDatabase = () => {
  new FixHtmlLabels(databasePath);
  new AddInfoIcons(databasePath);
  updateJsonFile(databasePath, (database: BExport) => {
    return renameBuildings(database, absolutePath('assets/manual-buildMenuRename.json'));
  })
}

const processImages = async () => {
  // First generate icons
  console.log('Generating icons...');
  const icons = new GenerateIcons(databasePath);
  await icons.generateIcons();

  // Then generate groups
  console.log('Generating groups...');
  new GenerateGroupsLegacy(databasePath);

  console.log('Image processing complete');
}

const replaceDatabase = () => {
  var zip = new AdmZip();
  zip.addLocalFile(databasePath);
  zip.writeZip('assets/database/database.zip');
  fs.copyFileSync('assets/database/database.zip', 'frontend/src/assets/database/database.zip');
  fs.copyFileSync('assets/database/database-repack.json', 'frontend/src/assets/database.json');
}

export const extractExport = async () => {  // Make this async
  freshExport();
  replaceImages();
  generateDatabase();
  await processImages();  // Wait for image processing
  replaceDatabase();

  // Generate UI sprites
  console.log('Generating UI sprites...');
  const uiGenerator = new GenerateUI('./assets/database/database.json');
  await uiGenerator.generateUI();

  // Generate category icons
  console.log('Generating category icons...');
  const iconGenerator = new GenerateIcons('./assets/database/database.json');
  await iconGenerator.generateIcons();

  console.log('Extraction process complete');
}

// Only execute this script if loaded directly with node
if (require.main === module) {
  extractExport()
    .then(() => console.log('extractExport complete'))
    .catch(error => {
      console.error('Extract failed:', error);
      process.exit(1);
    });
}
