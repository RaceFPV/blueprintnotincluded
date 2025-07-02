import { SpriteTag } from "../enums/sprite-tag";
import { Vector2 } from "../vector2";
import { BSpriteModifier } from "../b-export/b-sprite-modifier";
import { BBuilding } from "../b-export/b-building";
import { BExport } from "../b-export/b-export";

export class SpriteModifier
{
  spriteModifierId: string;
  spriteInfoName: string = '';
  tags: SpriteTag[] = [];

  rotation: number = 0;
  scale: Vector2 = new Vector2();
  translation: Vector2 = new Vector2();

  constructor(spriteModifierId: string)
  {
    this.spriteModifierId = spriteModifierId;
    this.cleanUp();
  }

  public importFrom(original: BSpriteModifier)
  {
    this.spriteInfoName = original.spriteInfoName;

    this.translation = original.translation;
    this.scale = original.scale;
    this.rotation = original.rotation;

    this.tags = [];
    if (original.tags != null && original.tags.length > 0)
      for (let tag of original.tags) this.tags.push(tag);
  }

  public cleanUp()
  {
    if (this.rotation == null) this.rotation = 0;
    if (this.scale == null) this.scale = Vector2.one();
    if (this.translation == null) this.translation = Vector2.zero();
    if (this.tags == null) this.tags = [];
  }

  public hasTag(tag: SpriteTag) {
    return this.tags.indexOf(tag) != -1;
  }

  public static AddSpriteModifier(bBuilding: BBuilding)
  {
    // TODO Why is this empty again?
  }

  public static get spriteModifiers() { return Array.from(SpriteModifier.spriteModifiersMap.values()); }
  private static spriteModifiersMap: Map<string, SpriteModifier>;
  public static init()
  {
    SpriteModifier.spriteModifiersMap = new Map<string, SpriteModifier>();
    // Add default sprite modifiers
    SpriteModifier.addSpriteModifier(new SpriteModifier('element_tile_back'));
    SpriteModifier.addSpriteModifier(new SpriteModifier('gas_tile_front'));
    SpriteModifier.addSpriteModifier(new SpriteModifier('liquid_tile_front'));
    SpriteModifier.addSpriteModifier(new SpriteModifier('vacuum_tile_front'));
    SpriteModifier.addSpriteModifier(new SpriteModifier('info_back'));
    // Add info front modifiers
    for (let i = 0; i < 12; i++) {
      SpriteModifier.addSpriteModifier(new SpriteModifier(`info_front_${i}`));
    }
  }

  public static addSpriteModifier(spriteModifier: SpriteModifier) {
    SpriteModifier.spriteModifiersMap.set(spriteModifier.spriteModifierId, spriteModifier);
  }

  public static removeSpriteModifier(spriteModifierId: string): boolean {
    const removed = SpriteModifier.spriteModifiersMap.delete(spriteModifierId);
    if (removed) {
      console.log(`[SpriteModifier] Removed from static map: "${spriteModifierId}"`);
    } else {
      console.warn(`[SpriteModifier] Failed to remove from static map (not found): "${spriteModifierId}"`);
    }
    return removed;
  }

  public static getSpriteModifier(id: string): SpriteModifier {
    const modifier = SpriteModifier.spriteModifiersMap.get(id);
    if (!modifier) {
      console.warn(`[SpriteModifier] Sprite modifier not found: ${id}, creating default fallback`);
      
      // Create a fallback sprite modifier instead of throwing
      const fallbackModifier = new SpriteModifier(id);
      fallbackModifier.spriteInfoName = 'default';
      fallbackModifier.cleanUp();
      
      // Optionally cache it to avoid recreating it repeatedly
      SpriteModifier.spriteModifiersMap.set(id, fallbackModifier);
      
      return fallbackModifier;
    }
    return modifier;
  }

  public static getSpriteModifer(
    spriteModifierName: string,
    database?: BExport
  ): SpriteModifier {
    console.log(`[SpriteModifier] getSpriteModifer called with: "${spriteModifierName || 'UNDEFINED'}" (type: ${typeof spriteModifierName})`);
    
    // Debug validation
    if (!spriteModifierName) {
      console.warn('[SpriteModifier] Empty spriteModifierName provided');
      console.warn('[SpriteModifier] Call stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
      return SpriteModifier.getSpriteModifier('default');
    }

    // First, try the existing static map (for backward compatibility)
    const existingModifier = SpriteModifier.spriteModifiersMap.get(spriteModifierName);
    if (existingModifier) {
      console.log(`[SpriteModifier] Found sprite modifier in static map: "${spriteModifierName}"`);
      console.log(`[SpriteModifier] Sprite modifier details:`, {
        spriteModifierId: existingModifier.spriteModifierId,
        spriteInfoName: existingModifier.spriteInfoName,
        translation: existingModifier.translation,
        scale: existingModifier.scale,
        rotation: existingModifier.rotation,
        tags: existingModifier.tags
      });
      return existingModifier;
    }

    console.log(`[SpriteModifier] Not found in static map, static map has ${SpriteModifier.spriteModifiersMap.size} entries`);

    // If database is provided, search it
    if (database && database.spriteModifiers) {
      console.log(`[SpriteModifier] Searching database for sprite modifier: "${spriteModifierName}"`);
      
      for (let spriteModifier of database.spriteModifiers) {
        if (spriteModifier.name === spriteModifierName) {
          const modifier = new SpriteModifier(spriteModifier.name);
          modifier.importFrom(spriteModifier);
          console.log(`[SpriteModifier] Found sprite modifier in database: "${spriteModifierName}"`);
          console.log(`[SpriteModifier] Database sprite modifier details:`, {
            name: spriteModifier.name,
            spriteInfoName: spriteModifier.spriteInfoName,
            translation: spriteModifier.translation,
            scale: spriteModifier.scale,
            rotation: spriteModifier.rotation
          });
          return modifier;
        }
      }

      // Enhanced error reporting when database search fails
      console.warn(`[SpriteModifier] Sprite modifier not found in database: "${spriteModifierName}"`);
      console.warn(`[SpriteModifier] Database contains ${database.spriteModifiers.length} sprite modifiers`);
      
      // Try to find similar names
      const similar = database.spriteModifiers
        .filter(sm => sm.name.includes(spriteModifierName.split('_')[0]) || 
                      spriteModifierName.includes(sm.name.split('_')[0]))
        .slice(0, 5)
        .map(sm => sm.name);
      
      if (similar.length > 0) {
        console.warn(`[SpriteModifier] Similar sprite modifiers found: ${similar.join(', ')}`);
      }
    }

    // Fallback to creating a default modifier (maintains old behavior)
    console.warn(`[SpriteModifier] Creating fallback modifier for: "${spriteModifierName}"`);
    return SpriteModifier.getSpriteModifier(spriteModifierName);
  }

  public static load(spriteModifiers: BSpriteModifier[])
  {
    for (let original of spriteModifiers)
    {
      let spriteModifier = new SpriteModifier(original.name);
      spriteModifier.cleanUp();
      spriteModifier.importFrom(original);

      SpriteModifier.spriteModifiersMap.set(spriteModifier.spriteModifierId, spriteModifier);
    }
  }
}

