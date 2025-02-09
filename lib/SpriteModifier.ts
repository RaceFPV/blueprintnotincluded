import { Vector2 } from './Vector2';

interface Position {
  x: number;
  y: number;
}

export interface BSpriteModifier {
  id: string;
  position?: Vector2 | Position;
  drawPixi?: any;
  sprite?: any;
  container?: any;
}

console.log('[SpriteModifier] Module loaded');
process.stdout.write('[SpriteModifier] Module loaded\n');

export class SpriteModifier {
  private static instance: SpriteModifier;
  private static spriteModifiers: Map<string, SpriteModifier> = new Map();
  public id: string;
  public position: Vector2;
  public sprite: any;
  public container: any;

  constructor() {
    console.log('[SpriteModifier] Initializing new instance');
    process.stdout.write('[SpriteModifier] Initializing new instance\n');
    
    this.id = '';
    this.position = new Vector2(0, 0);
    this.sprite = null;
    this.container = null;
    this.drawPixi = this.defaultDrawPixi.bind(this);
  }

  private static ensureInitialized(): void {
    if (!SpriteModifier.instance || !SpriteModifier.spriteModifiers) {
      console.log('[SpriteModifier] Ensuring initialization');
      process.stdout.write('[SpriteModifier] Ensuring initialization\n');
      SpriteModifier.getInstance();
    }
  }

  public static getInstance(): SpriteModifier {
    if (!SpriteModifier.instance) {
      console.log('[SpriteModifier] Creating singleton instance');
      process.stdout.write('[SpriteModifier] Creating singleton instance\n');
      
      SpriteModifier.instance = new SpriteModifier();
      SpriteModifier.init();
    }
    return SpriteModifier.instance;
  }

  private defaultDrawPixi(camera: any, util: any): void {
    try {
      SpriteModifier.ensureInitialized();
      if (this.sprite && this.container) {
        this.container.addChild(this.sprite);
      }
    } catch (error) {
      SpriteModifier.logError('defaultDrawPixi', error);
    }
  }

  public static init() {
    try {
      if (!SpriteModifier.spriteModifiers) {
        SpriteModifier.spriteModifiers = new Map();
      }
      
      // Create default modifier
      const defaultModifier = new SpriteModifier();
      defaultModifier.id = 'default';
      defaultModifier.position = new Vector2(0, 0);
      defaultModifier.sprite = null;
      defaultModifier.container = null;
      SpriteModifier.spriteModifiers.set('default', defaultModifier);

      // Add element_tile_back as it seems to be required
      const tileBackModifier = new SpriteModifier();
      tileBackModifier.id = 'element_tile_back';
      tileBackModifier.position = new Vector2(0, 0);
      tileBackModifier.sprite = null;
      tileBackModifier.container = null;
      SpriteModifier.spriteModifiers.set('element_tile_back', tileBackModifier);
    } catch (error) {
      SpriteModifier.logError('init', error);
      throw error;
    }
  }

  private static logError(method: string, error: unknown, context?: any) {
    console.error(`[SpriteModifier] Error in ${method}:`, error);
    if (context) {
      console.error('Context:', context);
    }
    // Log to container stdout
    process.stdout.write(`[SpriteModifier] Error in ${method}: ${error}\n`);
    if (context) {
      process.stdout.write(`Context: ${JSON.stringify(context)}\n`);
    }
  }

  private static getOrCreatePosition(instance: SpriteModifier | undefined): Vector2 {
    if (!instance) {
      console.warn('[SpriteModifier] Instance is undefined, creating new position');
      return new Vector2(0, 0);
    }
    
    if (!instance.position) {
      console.warn('[SpriteModifier] Position not initialized, creating new position');
      instance.position = new Vector2(0, 0);
    }
    
    return instance.position;
  }

  private static safeSetPosition(instance: SpriteModifier | undefined, newPosition: Vector2 | Position): void {
    try {
      if (!instance) {
        console.error('[SpriteModifier] Cannot set position on undefined instance');
        return;
      }

      instance.position = newPosition instanceof Vector2 
        ? newPosition.clone() 
        : new Vector2(newPosition.x, newPosition.y);
    } catch (error) {
      SpriteModifier.logError('safeSetPosition', error, { 
        hasInstance: !!instance,
        instanceId: instance?.id,
        newPosition 
      });
    }
  }

  public static hover(id: string, position?: Vector2 | Position): void {
    try {
      SpriteModifier.ensureInitialized();

      // Get the modifier instance from the map
      const modifier = SpriteModifier.spriteModifiers.get(id);
      if (!modifier) {
        console.warn(`[SpriteModifier] No modifier found for id: ${id}, creating default`);
        const defaultModifier = new SpriteModifier();
        defaultModifier.id = id;
        SpriteModifier.spriteModifiers.set(id, defaultModifier);
        return;
      }

      // Get current position safely
      const currentPosition = SpriteModifier.getOrCreatePosition(modifier);

      // If no new position provided, keep current
      if (!position) {
        return;
      }

      console.log(`[SpriteModifier] Attempting to set position for ${id}`);
      
      // Set new position safely
      if (position instanceof Vector2) {
        SpriteModifier.safeSetPosition(modifier, position);
      } else if (SpriteModifier.isPosition(position)) {
        SpriteModifier.safeSetPosition(modifier, position);
      } else {
        console.warn('[SpriteModifier] Invalid position provided, keeping current position');
        SpriteModifier.safeSetPosition(modifier, currentPosition);
      }
    } catch (error) {
      SpriteModifier.logError('hover', error, {
        id,
        position,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Recovery attempt
      try {
        const modifier = SpriteModifier.spriteModifiers.get(id) || new SpriteModifier();
        modifier.id = id;
        SpriteModifier.safeSetPosition(modifier, new Vector2(0, 0));
        SpriteModifier.spriteModifiers.set(id, modifier);
      } catch (recoveryError) {
        SpriteModifier.logError('hover recovery', recoveryError);
      }
    }
  }

  private static isPosition(obj: any): obj is Position {
    return obj && typeof obj.x === 'number' && typeof obj.y === 'number';
  }

  public static load(modifiers: BSpriteModifier[]) {
    try {
      if (!SpriteModifier.spriteModifiers) {
        SpriteModifier.init();
      }

      // Keep existing modifiers
      const existingModifiers = Array.from(SpriteModifier.spriteModifiers.values());
      
      modifiers?.forEach(modifierData => {
        if (!modifierData) return;
        
        const modifier = new SpriteModifier();
        modifier.id = modifierData.id || 'unknown';
        
        if (modifierData.position) {
          if (modifierData.position instanceof Vector2) {
            modifier.position = modifierData.position.clone();
          } else if (this.isPosition(modifierData.position)) {
            modifier.position = new Vector2(
              modifierData.position.x,
              modifierData.position.y
            );
          }
        }

        if (modifierData.drawPixi) {
          modifier.drawPixi = modifierData.drawPixi.bind(modifier);
        }

        modifier.sprite = modifierData.sprite || null;
        modifier.container = modifierData.container || null;
        
        SpriteModifier.spriteModifiers.set(modifier.id, modifier);
      });

      // Preserve existing modifiers that weren't overwritten
      existingModifiers.forEach(modifier => {
        if (!SpriteModifier.spriteModifiers.has(modifier.id)) {
          SpriteModifier.spriteModifiers.set(modifier.id, modifier);
        }
      });
    } catch (error) {
      console.warn('Error loading sprite modifiers:', error);
    }
  }

  public static getSpriteModifer(id: string): SpriteModifier {
    try {
      if (!id) {
        const error = new Error('No id provided to getSpriteModifer');
        this.logError('getSpriteModifer', error);
        throw error;
      }

      if (!SpriteModifier.spriteModifiers) {
        console.warn('[SpriteModifier] Initializing sprite modifiers map');
        process.stdout.write('[SpriteModifier] Initializing sprite modifiers map\n');
        SpriteModifier.init();
      }

      const modifier = SpriteModifier.spriteModifiers.get(id);
      if (!modifier) {
        console.warn(`[SpriteModifier] Sprite Modifier not found: ${id}, using default`);
        process.stdout.write(`[SpriteModifier] Sprite Modifier not found: ${id}, using default\n`);
        
        const defaultModifier = SpriteModifier.spriteModifiers.get('default');
        if (!defaultModifier) {
          console.warn('[SpriteModifier] Default modifier not found, creating new one');
          process.stdout.write('[SpriteModifier] Default modifier not found, creating new one\n');
          
          const newDefault = new SpriteModifier();
          newDefault.id = 'default';
          return newDefault;
        }
        return defaultModifier;
      }
      return modifier;
    } catch (error) {
      this.logError('getSpriteModifer', error, { id });
      const defaultModifier = new SpriteModifier();
      defaultModifier.id = 'default';
      return defaultModifier;
    }
  }

  public drawPixi(camera: any, util: any): void {
    try {
      SpriteModifier.ensureInitialized();
      
      if (!this.sprite || !this.container) {
        console.warn(`[SpriteModifier] Missing sprite or container for ${this.id}`);
        process.stdout.write(`[SpriteModifier] Missing sprite or container for ${this.id}\n`);
        return;
      }

      this.container.addChild(this.sprite);
    } catch (error) {
      SpriteModifier.logError('drawPixi', error, {
        id: this?.id,
        hasSprite: !!this?.sprite,
        hasContainer: !!this?.container
      });
    }
  }

  public mouseMove(event: any): void {
    try {
      const position = new Vector2(event.x, event.y);
      SpriteModifier.hover(this.id, position);
    } catch (error) {
      SpriteModifier.logError('mouseMove', error, {
        id: this.id,
        event
      });
    }
  }
} 