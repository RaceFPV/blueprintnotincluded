import { Canvas, loadImage } from 'canvas';
import { JSDOM } from 'jsdom';

// Set up JSDOM environment before requiring PIXI
const dom = new JSDOM('<!DOCTYPE html>');
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Image = dom.window.Image;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.HTMLImageElement = dom.window.HTMLImageElement;

// Now require PIXI after environment is set up
const PIXI = require('../pixi-shim');
require('../pixi-shim/lib/pixi-shim-node.js');

import Jimp from 'jimp';
import { PixiUtil, ImageSource, Blueprint, Vector2, CameraService, Overlay, Display } from "../../lib";
import { resources } from 'pixi.js-legacy';

class NodeCanvasResource extends resources.BaseImageResource {
  constructor(source: any) {
    super(source);
  }
}

export class PixiNodeUtil extends PixiUtil {
  private static imageCache: Map<string, any> = new Map();

  pixiApp: PIXI.Application;
  pixiGraphicsBack: PIXI.Graphics;
  pixiGraphicsFront: PIXI.Graphics;

  constructor(options: any) {
    super(options);
    this.pixiApp = new PIXI.Application(options);
    this.pixiGraphicsFront = this.getNewGraphics();
    this.pixiGraphicsBack = this.getNewGraphics();
  }

  getNewPixiApp(options: any) {
    return this.pixiApp;
    //return new PIXI.Application(options);
  }
  getNewBaseRenderTexture(options: any) {
    return new PIXI.BaseRenderTexture(options);
  }
  getNewRenderTexture(brt: any) {
    return new PIXI.RenderTexture(brt);
  }
  getNewGraphics() {
    return new PIXI.Graphics();
  }
  getNewContainer() {
    return new PIXI.Container();
  }
  getSpriteFrom(resource: any) {
    if (!resource) {
      console.warn('Attempted to create sprite from null resource');
      // Return a 1x1 transparent sprite instead of failing
      const emptyTexture = new PIXI.Texture(new PIXI.BaseTexture(new NodeCanvasResource(new Canvas(1, 1))));
      return new PIXI.Sprite(emptyTexture);
    }
    return PIXI.Sprite.from(resource);
  }
  getNewBaseTexture(url: string): PIXI.BaseTexture {
    throw new Error('This should not be called on node: all textures should be preloaded');
    // TypeScript needs a return statement even though this will never be reached
    const canvas = new Canvas(1, 1);  // Now Canvas is properly imported
    return new PIXI.BaseTexture(new NodeCanvasResource(canvas));
  }
  getNewTexture(baseTex: any, rectangle: any) {
    return new PIXI.Texture(baseTex, rectangle);
  }

  public getNewTextureWhole(baseTex: PIXI.BaseTexture) {
    return new PIXI.Texture(baseTex);
  }

  getNewRectangle(x1: number, y1: number, x2: number, y2: number) {
    return new PIXI.Rectangle(x1, y1, x2, y2);
  }

  getUtilityGraphicsBack(): any {
    return this.pixiGraphicsBack;
  }

  getUtilityGraphicsFront(): any {
    return this.pixiGraphicsFront;
  }

  async initTextures(): Promise<void> {
    console.log('Starting texture initialization...');
    const total = ImageSource.keys.length;
    let processed = 0;

    for (let k of ImageSource.keys) {
      try {
        let imageUrl = ImageSource.getUrl(k);
        if (!imageUrl) {
          console.warn(`No URL found for texture: ${k}`);
          continue;
        }

        let brt = await this.getImageFromCanvas(imageUrl);
        if (brt) {
          ImageSource.setBaseTexture(k, brt);
        }
        
        processed++;
        if (processed % 10 === 0) { // Log progress every 10 textures
          console.log(`Processed ${processed}/${total} textures`);
        }
      } catch (error) {
        console.warn(`Failed to initialize texture ${k}:`, error);
        continue; // Skip this texture but continue with others
      }
    }
    console.log(`Texture initialization complete. Processed ${processed}/${total} textures`);
  }

  async getImageFromCanvas(path: string) {
    // Try different possible paths
    const paths = [
      path,
      path.replace(/^assets\/images\/ui\//, 'assets/images/'),
      path.replace(/^assets\//, 'frontend/src/assets/'),
      path.replace(/^assets\/images\/ui\//, 'frontend/src/assets/images/')
    ];
    
    for (const tryPath of paths) {
      try {
        const image = await loadImage(tryPath);
        const resource = new NodeCanvasResource(image);
        return new PIXI.BaseTexture(resource);
      } catch (err) {
        // Continue silently to next path
        continue;
      }
    }
    
    // If we get here, none of the paths worked - return a 1x1 transparent texture
    console.warn(`Could not load image: ${path}`);
    return new PIXI.BaseTexture(new NodeCanvasResource(new Canvas(1, 1)));
  }

  async getImageWhite(path: string) {
    const originalPath = path;
    const frontendPath = path.replace(/^assets\//, 'frontend/src/assets/');
    
    let data: Jimp | null;
    try {
      console.log('reading ' + originalPath);
      data = await Jimp.read(originalPath);
    } catch (err) {
      try {
        console.log('reading from frontend path: ' + frontendPath);
        data = await Jimp.read(frontendPath);
      } catch (err2) {
        throw new Error(`Could not read image from either ${originalPath} or ${frontendPath}`);
      }
    }

    let width = data.getWidth();
    let height = data.getHeight();

    let brt = this.getNewBaseRenderTexture({ width: width, height: height });
    let rt = this.getNewRenderTexture(brt);

    let graphics = this.getNewGraphics();

    let container = this.getNewContainer();
    container.addChild(graphics);

    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++) {
        let color = data.getPixelColor(x, y);
        let colorObject = Jimp.intToRGBA(color);
        let alpha = colorObject.a / 255;
        graphics.beginFill(0xFFFFFF, alpha);
        graphics.drawRect(x, y, 1, 1);
        graphics.endFill();
      }

    this.pixiApp.renderer.render(container, rt, false);

    // Release memory
    container.destroy({ children: true });
    container = null;
    rt.destroy();
    rt = null;
    data = null;
    global.gc && global.gc();

    //console.log('render done for ' + path);
    return brt;
  }

  generateThumbnail(angularBlueprint: Blueprint) {

    let boundingBox = angularBlueprint.getBoundingBox();
    let topLeft = boundingBox[0];
    let bottomRight = boundingBox[1];
    let totalTileSize = new Vector2(bottomRight.x - topLeft.x + 3, bottomRight.y - topLeft.y + 3);

    let thumbnailSize = 200;
    let maxTotalSize = Math.max(totalTileSize.x, totalTileSize.y);
    let thumbnailTileSize = thumbnailSize / maxTotalSize;
    let cameraOffset = new Vector2(-topLeft.x + 1, bottomRight.y + 1);
    if (totalTileSize.x > totalTileSize.y) cameraOffset.y += totalTileSize.x / 2 - totalTileSize.y / 2;
    if (totalTileSize.y > totalTileSize.x) cameraOffset.x += totalTileSize.y / 2 - totalTileSize.x / 2;

    thumbnailTileSize = Math.floor(thumbnailTileSize);
    cameraOffset.x = Math.floor(cameraOffset.x);
    cameraOffset.y = Math.floor(cameraOffset.y);

    let exportCamera = new CameraService(this.getNewContainer());
    exportCamera.setHardZoom(thumbnailTileSize);
    exportCamera.cameraOffset = cameraOffset;
    exportCamera.overlay = Overlay.Base;
    exportCamera.display = Display.solid;

    exportCamera.container = this.getNewContainer();
    exportCamera.container.sortableChildren = true;

    let graphics = this.getNewGraphics();
    exportCamera.container.addChild(graphics);

    graphics.beginFill(0xffffff);
    graphics.drawRect(0, 0, 200, 200);
    graphics.endFill();

    // Instead of using this directly, create a new PixiUtil instance
    const pixiUtil = new PixiUtil();
    angularBlueprint.blueprintItems.map((item) => {
      item.updateTileables(angularBlueprint);
      item.drawPixi(exportCamera, pixiUtil);
    });

    let brt = this.getNewBaseRenderTexture({ width: thumbnailSize, height: thumbnailSize });
    let rt = this.getNewRenderTexture(brt);

    this.pixiApp.renderer.render(exportCamera.container, rt, false);

    let base64: string = this.pixiApp.renderer.plugins.extract.canvas(rt).toDataURL();

    // Memory release
    exportCamera.container.destroy({ children: true });
    brt.destroy();
    rt.destroy();

    //console.log(base64)
    return base64;
  }

  async getImage(path: string): Promise<any> {
    // Check cache first
    if (PixiNodeUtil.imageCache.has(path)) {
      return PixiNodeUtil.imageCache.get(path);
    }

    try {
      // Only try loading from assets/images path
      const imagePath = path.includes('assets/images') ? path : `assets/images/${path}`;
      console.log('Loading image:', imagePath);
      
      const image = await loadImage(imagePath);
      PixiNodeUtil.imageCache.set(path, image);
      return image;
    } catch (error) {
      console.error(`Failed to load image: ${path}`, error);
      throw error;
    }
  }

  // Add method to clear cache (useful for cleanup)
  static clearImageCache() {
    PixiNodeUtil.imageCache.clear();
  }

  public async createBaseTexture(base64Image: string): Promise<any> {
    try {
      // Remove the data URL prefix if present
      const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Load image directly with node-canvas
      const image = await loadImage(imageBuffer);
      const canvas = new Canvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      // Create PIXI base texture from canvas
      const resource = new NodeCanvasResource(canvas);
      return new PIXI.BaseTexture(resource);
    } catch (error) {
      console.error('Error creating base texture:', error);
      throw error;
    }
  }
}
