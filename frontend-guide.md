# Frontend Build Tool & Sprite Loading Guide

This document explains how the build tool and sprite placement system works in the blueprintnotincluded frontend, particularly focusing on the loading and rendering pipeline.

## Architecture Overview

The frontend uses Angular with PIXI.js for canvas rendering. The build tool system consists of several key components:

- **ToolService**: Manages tool switching and coordination
- **BuildTool**: Core logic for building placement and validation  
- **ComponentSideBuildToolComponent**: UI component for building selection
- **BlueprintItem**: Represents individual buildings with their sprites
- **DrawPart/SpriteModifier**: Handles sprite rendering and grouped textures

## Build Tool Workflow

### 1. What happens when you first click on the build tool from the menu

**File: `component-menu.component.ts`**

When you click "Build" in the menu:

1. **Menu Click Handler** (`clickTool()`):
   ```typescript
   clickTool(toolType: ToolType) {
     this.toolService.changeTool(toolType);
   }
   ```

2. **Tool Service Activation** (`tool-service.ts`):
   - Deactivates other tools in the same tool group
   - Sets the BuildTool as `visible = true` and `captureInput = true`
   - Calls `buildTool.switchTo()` to activate the tool
   - Notifies all observers that the tool changed via `toolChanged(newTool)`

3. **Build Tool Component Response** (`build-tool.component.ts`):
   ```typescript
   toolChanged(toolType: ToolType) {
     if (toolType == ToolType.build && this.databaseLoaded) {
       this.uiItemChanged(); // Recreates the template item
     }
     // Hides all overlay panels
   }
   ```

4. **Initial Template Creation**:
   - If database is loaded, creates a default "Tile" building as `templateItemToBuild`
   - This calls `BlueprintHelpers.createInstance("Tile")`
   - The template item is set to invisible position (-99999, -99999)

## Deep Dive: Initial Template Creation Process

Let's examine exactly what happens during `BlueprintHelpers.createInstance("Tile")` and how the database objects are processed to load PNG sprites.

### 1. Database Structure Overview

The database loaded from `/assets/database/database.json` contains several key arrays:

```typescript
interface DatabaseStructure {
  buildings: BBuilding[];        // ← Building definitions
  spriteModifiers: BSpriteModifier[];  // ← Sprite transformation data  
  uiSprites: BSpriteInfo[];      // ← Sprite texture/UV mapping info
  elements: BuildableElement[];   // Material definitions
  buildMenuCategories: BuildMenuCategory[]; // UI organization
  buildMenuItems: BuildMenuItem[]; // What appears in build menus
}
```

### 2. What Happens During `BlueprintHelpers.createInstance("Tile")`

**File: `blueprint-helpers.ts`**

```typescript
static createInstance(id: string): BlueprintItem {
  let oniItem = OniItem.getOniItem(id); // ← Lookup "Tile" in database
  
  if (oniItem == null) throw new Error('OniItem id not found');
  
  if (oniItem.isWire) return new BlueprintItemWire(id);
  else if (oniItem.isTile) return new BlueprintItemTile(id);
  else if (oniItem.id == OniItem.elementId) return new BlueprintItemElement(id);
  else return new BlueprintItem(id); // ← Creates regular BlueprintItem for "Tile"
}
```

### 3. How Database Objects Are Loaded - The Complete Pipeline

#### Step 1: Database Loading (`OniItem.load()`)

**File: `oni-item.ts:243`**

```typescript
public static load(buildings: BBuilding[]) {
  for (let building of buildings) {
    let oniItem = new OniItem(building.prefabId); // ← Creates OniItem for "Tile"
    oniItem.copyFrom(building);  // ← Copies all data from database
    oniItem.cleanUp();
    
    SpriteModifier.AddSpriteModifier(building); // ← Processes sprite data
    OniItem.oniItemsMap.set(oniItem.id, oniItem); // ← Stores in lookup map
  }
}
```

#### Step 2: Building Data Processing (`OniItem.copyFrom()`)

**File: `oni-item.ts:85`**

When copying from the database `BBuilding` object:

```typescript
public copyFrom(original: BBuilding) {
  this.id = original.prefabId;           // "Tile"
  this.name = original.name;             // "Tiles"
  this.size = original.sizeInCells;      // Vector2(1, 1)
  this.spriteModifierId = original.kanimPrefix; // "floor_mesh"
  
  // ← Critical: This processes the sprite group data!
  this.spriteGroup = new SpriteModifierGroup();
  this.spriteGroup.importFrom(original.sprites);
}
```

#### Step 3: Sprite Group Processing (`SpriteModifierGroup.importFrom()`)

**File: `sprite-modifier-group.ts:12`**

```typescript
importFrom(original: BSpriteGroup) {
  this.groupName = original.groupName; // "Base"
  
  for (let spriteName of original.spriteNames) {
    // ← These are the sprite modifier names from your grouped database!
    // For grouped sprites: ["Tile_group_modifier"]
    // For individual sprites: ["floor_mesh_place", "floor_mesh_solid"] 
    let spriteModifier = SpriteModifier.getSpriteModifier(spriteName);
    if (spriteModifier != null) this.spriteModifiers.push(spriteModifier);
  }
}
```

**🔑 Key Point**: This is where your grouped sprite system connects! In your new grouped database, `original.spriteNames` contains `["Tile_group_modifier"]` instead of individual sprite names.

#### Step 4: Sprite Modifier Lookup (`SpriteModifier.getSpriteModifier()`)

**File: `sprite-modifier.ts:71`**

```typescript
public static getSpriteModifier(id: string): SpriteModifier {
  const modifier = SpriteModifier.spriteModifiersMap.get(id);
  if (!modifier) {
    throw new Error(`SpriteModifier not found : ${id}`); // ← Your original error!
  }
  return modifier;
}
```

The `spriteModifiersMap` is populated from `database.json.spriteModifiers` array. In your grouped database, this contains entries like:

```typescript
{
  "name": "Tile_group_modifier",
  "spriteInfoName": "Tile_group_sprite", // ← Links to the PNG file info
  "tags": ["place"],
  "translation": { "x": 0, "y": 0 },
  "scale": { "x": 1, "y": 1 },
  "rotation": 0
}
```

### 4. BlueprintItem Constructor & Sprite Preparation

**File: `blueprint-item.ts:90`**

```typescript
constructor(id: string = 'Vacuum') {
  this.id = id; // "Tile"
  this.oniItem = OniItem.getOniItem(id); // ← Gets the processed OniItem
}
```

Then `cleanUp()` is called:

**File: `blueprint-item.ts:288`**

```typescript
public cleanUp() {
  this.drawParts = [];
  
  // ← This iterates through the sprite modifiers from the database!
  for (let spriteModifier of this.oniItem.spriteGroup.spriteModifiers) {
    if (spriteModifier.tags.indexOf(SpriteTag.ui) == -1) {
      let newDrawPart = new DrawPart();
      newDrawPart.spriteModifier = spriteModifier; // ← "Tile_group_modifier" 
      this.drawParts.push(newDrawPart);
    }
  }
}
```

### 5. How PNG Files Are Located and Loaded

#### Step 1: Sprite Info Loading (`SpriteInfo.load()`)

**File: `sprite-info.ts:47`**

The database's `uiSprites` array contains `BSpriteInfo` objects that map sprite names to PNG files:

```typescript
public static load(spriteInfos: BSpriteInfo[]) {
  for (let original of spriteInfos) {
    let spriteInfo = new SpriteInfo(original.name); // "Tile_group_sprite"
    spriteInfo.copyFrom(original);
    SpriteInfo.addSpriteInfo(spriteInfo);
  }
}
```

#### Step 2: PNG Path Construction (`SpriteInfo.copyFrom()`)

**File: `sprite-info.ts:67`**

```typescript
public copyFrom(original: BSpriteInfo) {
  // ← This determines the PNG file path!
  const isGroupSprite = original.textureName.includes('_group_sprite');
  let imageUrl: string = DrawHelpers.createUrl(original.textureName, !isGroupSprite);
  
  // For grouped sprites: 'assets/images/Tile_group_sprite.png'
  // For UI sprites: 'assets/images/ui/floor_mesh_ui_0.png'
  
  ImageSource.AddImagePixi(original.textureName, imageUrl);
  this.imageId = original.textureName; // "Tile_group_sprite"
  
  // UV coordinates for grouped textures
  this.uvMin = original.uvMin;   // Where in the grouped image
  this.uvSize = original.uvSize; // Size of this sprite's section
  this.realSize = original.realSize; // Display size
  this.pivot = original.pivot;   // Anchor point
}
```

#### Step 3: URL Construction (`DrawHelpers.createUrl()`)

**File: `draw-helpers.ts:10`**

```typescript
public static createUrl(ressource: string, ui: boolean): string {
  return 'assets/images/'+(ui?'ui/':'')+ressource+'.png';
}
```

**Examples**:
- Individual sprite: `createUrl("floor_mesh_ui_0", true)` → `"assets/images/ui/floor_mesh_ui_0.png"`
- Grouped sprite: `createUrl("Tile_group_sprite", false)` → `"assets/images/Tile_group_sprite.png"`

#### Step 4: PIXI Texture Registration (`ImageSource.AddImagePixi()`)

**File: `image-source.ts:25`**

```typescript
public static AddImagePixi(id: string, url: string) {
  const newImageSource = new ImageSource(id, url);
  ImageSource.imageSourcesMapPixi.set(id, newImageSource); // Maps "Tile_group_sprite" → URL
  ImageSource.imageMap.set(id, url); // Browser can load the PNG file
}
```

### 6. Sprite Rendering Pipeline (When Building is Placed)

#### Step 1: Sprite Preparation (`DrawPart.prepareSprite()`)

**File: `draw-part.ts:43`**

```typescript
public prepareSprite(container: any, oniItem: OniItem, pixiUtil: PixiUtil) {
  if (!this.isReady) {
    // ← Gets the sprite info using the modifier's link
    this.spriteInfo = SpriteInfo.getSpriteInfo(this.spriteModifier.spriteInfoName);
    // spriteModifier.spriteInfoName = "Tile_group_sprite"
    
    let texture = this.spriteInfo.getTexture(pixiUtil); // ← Loads the PNG!
    
    if (texture != null) {
      this.sprite = pixiUtil.getSpriteFrom(texture);
      // Apply positioning, scaling, rotation from spriteModifier
      container.addChild(this.sprite);
      this.isReady = true;
    }
  }
}
```

#### Step 2: PNG Loading (`SpriteInfo.getTexture()`)

**File: `sprite-info.ts:112`**

```typescript
public getTexture(pixiUtil: PixiUtil): any {
  if (this.texture == null) {
    let baseTex = ImageSource.getBaseTexture(this.imageId, pixiUtil);
    // ← Loads "assets/images/Tile_group_sprite.png"
    
    let rectangle = pixiUtil.getNewRectangle(
      this.uvMin.x,   // X position in grouped image
      this.uvMin.y,   // Y position in grouped image  
      this.uvSize.x,  // Width of sprite section
      this.uvSize.y   // Height of sprite section
    );
    
    this.texture = pixiUtil.getNewTexture(baseTex, rectangle);
    // ← Creates texture from specific UV region of grouped image
  }
  return this.texture;
}
```

#### Step 3: Base Texture Loading (`ImageSource.getBaseTexture()`)

**File: `image-source.ts:40`**

```typescript
public static getBaseTexture(id: string, pixiUtil: PixiUtil): any {
  const imageUrl = ImageSource.imageMap.get(id); // "assets/images/Tile_group_sprite.png"
  if (!imageUrl) return null;
  
  const newBaseTexture = pixiUtil.getNewBaseTexture(imageUrl);
  // ← Browser downloads and loads the PNG file into PIXI
  
  ImageSource.baseTextureMap.set(id, newBaseTexture);
  return newBaseTexture;
}
```

### 7. The Complete Data Flow

```
1. Database Loading:
   database.json → buildings["Tile"] → OniItem("Tile")

2. Sprite Group Assignment:
   buildings["Tile"].sprites.spriteNames → ["Tile_group_modifier"]

3. Sprite Modifier Lookup:
   "Tile_group_modifier" → spriteModifiers["Tile_group_modifier"]

4. Sprite Info Connection:
   spriteModifier.spriteInfoName → "Tile_group_sprite"

5. PNG Path Resolution:
   "Tile_group_sprite" → "assets/images/Tile_group_sprite.png"

6. UV Mapping:
   uiSprites["Tile_group_sprite"] → {uvMin, uvSize, realSize, pivot}

7. PIXI Rendering:
   PNG file + UV coordinates → Rendered sprite on canvas
```

### 8. Key Database Objects Involved

**For "Tile" building, the database contains:**

```typescript
// In buildings array:
{
  "prefabId": "Tile",
  "name": "Tiles", 
  "kanimPrefix": "floor_mesh",
  "sprites": {
    "groupName": "Base",
    "spriteNames": ["Tile_group_modifier"] // ← Your grouped sprite!
  }
}

// In spriteModifiers array:
{
  "name": "Tile_group_modifier",
  "spriteInfoName": "Tile_group_sprite", // ← Links to PNG info
  "tags": ["place"],
  "translation": {"x": 0, "y": 0},
  "scale": {"x": 1, "y": 1}
}

// In uiSprites array:
{
  "name": "Tile_group_sprite",
  "textureName": "Tile_group_sprite",  // ← PNG filename
  "uvMin": {"x": 0, "y": 0},          // ← Position in grouped image
  "uvSize": {"x": 128, "y": 128},     // ← Size of this sprite
  "realSize": {"x": 100, "y": 100},   // ← Display size
  "pivot": {"x": 0.5, "y": 0.5}       // ← Anchor point
}
```

**The PNG file**: `frontend/src/assets/images/Tile_group_sprite.png` contains multiple building sprites combined into one image, with UV coordinates defining where each building's sprite is located within the grouped texture.

This complete pipeline ensures that when you click on "Tile" in the build tool, it knows exactly which PNG file to load and which portion of that file contains the Tile sprite!

### 2. What happens when you click on a building within the build tool

**Files: `build-tool.component.ts`, `blueprint-helpers.ts`, `blueprint-item.ts`**

When you click on a specific building in the build menu:

1. **Building Selection**:
   ```typescript
   chooseItem(item: OniItem) {
     this.currentItem = item;
     this.uiItemChanged();
   }
   ```

2. **Template Item Creation**:
   ```typescript
   uiItemChanged() {
     this.toolService.buildTool.changeItem(
       BlueprintHelpers.createInstance(this.currentItem.id)
     );
   }
   ```

3. **BlueprintHelpers.createInstance Process**:
   - Looks up the `OniItem` from the loaded database using the building ID
   - Determines the correct BlueprintItem subclass:
     - `BlueprintItemWire` for wires
     - `BlueprintItemTile` for tiles  
     - `BlueprintItemElement` for elements
     - `BlueprintItem` for regular buildings
   - Returns the new template item instance

4. **BuildTool.changeItem**:
   ```typescript
   changeItem(item: BlueprintItem) {
     if (this.templateItemToBuild != null) this.templateItemToBuild.destroy();
     
     this.templateItemToBuild = item;
     this.templateItemToBuild.setInvisible(); // Position (-99999, -99999)
     this.templateItemToBuild.alpha = 1;
     this.templateItemToBuild.isBuildCandidate = true;
     this.templateItemToBuild.prepareBoundingBox();
   }
   ```

5. **Critical: Sprite Loading in cleanUp**:
   ```typescript
   public cleanUp() {
     this.drawParts = [];
     for (let spriteModifier of this.oniItem.spriteGroup.spriteModifiers) {
       if (spriteModifier.tags.indexOf(SpriteTag.ui) == -1) {
         let newDrawPart = new DrawPart();
         newDrawPart.spriteModifier = spriteModifier; // ← Links to grouped sprites!
         this.drawParts.push(newDrawPart);
       }
     }
   }
   ```

**🔑 Key Point**: This is where grouped sprites are loaded! Each building's `oniItem.spriteGroup.spriteModifiers` contains references to the `*_group_modifier` entries from the database, which point to your generated `*_group_sprite.png` files.

### 3. What happens when you click to place the building on canvas

**Files: `build-tool.ts`, `blueprint-item.ts`**

When you click on the canvas to place a building:

1. **Mouse Click Handler**:
   ```typescript
   leftClick(tile: Vector2) {
     this.templateItemToBuild.position = tile;
     this.build();
   }
   ```

2. **Build Validation & Placement**:
   ```typescript
   build() {
     if (!this.templateItemToBuild.buildCandidateResult.canBuild) return;
     
     let newItem = BlueprintHelpers.cloneBlueprintItem(this.templateItemToBuild);
     newItem.prepareBoundingBox();
     newItem.updateTileables(this.blueprintService.blueprint);
     this.blueprintService.blueprint.addBlueprintItem(newItem);
   }
   ```

3. **PIXI Sprite Rendering**:
   ```typescript
   public drawPixi(camera: CameraService, pixiUtil: PixiUtil) {
     // Creates PIXI container if needed
     if (!this.containerCreated) {
       this.container = pixiUtil.getNewContainer();
       camera.addToContainer(this.container);
       
       // ← Sprites loaded from grouped images here!
       for (let drawPart of this.drawParts) {
         drawPart.prepareSprite(this.container, this.oniItem, pixiUtil);
       }
     }
     
     // Position and scale the container
     this.container.x = positionCorrected.x;
     this.container.y = positionCorrected.y;
     this.container.scale.x = this.scale.x * sizeCorrected.x;
     this.container.scale.y = this.scale.y * sizeCorrected.y;
   }
   ```

### 4. Mouse Hover Behavior (Ghost Preview)

While moving the mouse around before placing:

```typescript
hover(tile: Vector2) {
  this.templateItemToBuild.position = Vector2.clone(tile);
  this.templateItemToBuild.prepareBoundingBox();
  this.updateBuildCandidateResult(); // Validates placement legality
}
```

The `updateBuildCandidateResult()` method:
- Checks for building collisions on the same object layer
- Validates utility connection conflicts  
- Updates `buildCandidateResult.canBuild` and `cantBuildReason`
- Triggers UI refresh to show red/green preview

## Database & Sprite Loading Pipeline

### Database Loading Process

**File: `component-blueprint-parent.component.ts`**

1. **Initial Database Fetch**:
   ```typescript
   async fetchDatabase() {
     const response = await fetch("/assets/database/database.json");
     const json = await response.json();
     
     // Load all game data
     BuildableElement.load(json.elements);
     BuildMenuCategory.load(json.buildMenuCategories);  
     BuildMenuItem.load(json.buildMenuItems);
     SpriteInfo.load(json.uiSprites);
     SpriteModifier.load(json.spriteModifiers); // ← Grouped sprites loaded here!
     OniItem.load(json.buildings);
   }
   ```

2. **Sprite Modifier Loading**:
   - `SpriteModifier.load()` processes all sprite modifiers from database
   - This includes both individual sprites and your new grouped sprites
   - Grouped sprites have names like `CornerMoulding_group_modifier`
   - They reference texture files like `CornerMoulding_group_sprite.png`

### Sprite Rendering Process

**File: `draw-part.ts` (referenced)**

1. **prepareSprite()** method:
   - Takes the `spriteModifier` assigned during `cleanUp()`
   - Loads the actual texture file (your `*_group_sprite.png` files)
   - Creates PIXI sprites and adds them to the container
   - Handles UV mapping for sprite positioning within grouped textures

2. **Texture Loading**:
   - Individual sprites: `BuildingName_sprite.png`  
   - Grouped sprites: `BuildingName_group_sprite.png` (multiple buildings combined)
   - UV coordinates determine which part of the grouped texture to display

## The Grouped Sprite System Fix

### The Problem You Encountered

The error `SpriteModifier.getSpriteModifer : Sprite Modifier not found : CornerMoulding_group_modifier` occurred because:

1. Your `GenerateGroups` process created grouped sprite modifiers in `database-groups.json`
2. The frontend was loading the original `database.json` without grouped modifiers  
3. When `cleanUp()` tried to access `spriteModifier` objects, it looked for `*_group_modifier` entries that didn't exist

### The Solution Applied

Modified `extract-export.js` to:

1. **Check for grouped database**:
   ```javascript
   var groupedDatabasePath = absolutePath('assets/database/database-groups.json');
   if (fs.existsSync(groupedDatabasePath)) {
     console.log('Using grouped database with sprite groups...');
     sourceDbPath = groupedDatabasePath;
   }
   ```

2. **Copy grouped database to frontend**:
   ```javascript
   // Copy the chosen database to both locations
   (0, fs_extra_1.copySync)(sourceDbPath, absolutePath('assets/database/database.json'));
   (0, fs_extra_1.copySync)(sourceDbPath, absolutePath('frontend/src/assets/database.json'));
   ```

Now the frontend receives the database with all the `*_group_modifier` entries that reference your generated `*_group_sprite.png` files.

## Key Files Reference

### Frontend Components
- `components/side-bar/build-tool/build-tool.component.ts` - Build tool UI
- `services/tool-service.ts` - Tool management and coordination
- `common/tools/build-tool.ts` - Core build tool logic
- `components/component-canvas/component-canvas.component.ts` - Canvas rendering

### Core Library Classes  
- `lib/src/blueprint/blueprint-helpers.ts` - Building instantiation
- `lib/src/blueprint/blueprint-item.ts` - Building representation and rendering
- `lib/src/oni-item.ts` - Building definitions from database
- `lib/src/drawing/sprite-info.ts` - Sprite texture management

### Build Process
- `build/app/api/batch/extract-export.js` - Main asset pipeline
- `build/app/api/batch/generate-groups.js` - Sprite grouping process

## Debugging Tips

### Common Issues

1. **"templateItemToBuild is undefined"**:
   - Database not loaded when tool activated
   - Check `databaseLoaded` flag in build tool component

2. **"Sprite Modifier not found"**:
   - Frontend database missing grouped sprite modifiers
   - Verify `database-groups.json` was copied to frontend correctly

3. **Textures not loading**:
   - Check browser network tab for failed image requests
   - Verify `*_group_sprite.png` files exist in `frontend/src/assets/images/`

### Debug Points

Add console.log at these locations to trace sprite loading:

```typescript
// In build-tool.component.ts
uiItemChanged() {
  console.log('Creating building:', this.currentItem?.id);
}

// In blueprint-item.ts  
cleanUp() {
  console.log('Loading sprites for:', this.id, this.oniItem.spriteGroup.spriteModifiers.length);
}

// In extract-export.js
console.log('Using database:', sourceDbPath);
```

This pipeline ensures that when you click a building in the build tool, it loads the correct grouped sprites and renders them efficiently on the canvas using PIXI.js. 