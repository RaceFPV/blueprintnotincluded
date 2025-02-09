import { SpriteTag } from "../enums/sprite-tag";
import { Vector2 } from "../vector2";
import { BSpriteModifier } from "../b-export/b-sprite-modifier";
import { BBuilding } from "../b-export/b-building";

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

  public static getSpriteModifier(id: string): SpriteModifier {
    const modifier = SpriteModifier.spriteModifiersMap.get(id);
    if (!modifier) {
      console.error(`Sprite modifier not found: ${id}`);
      throw new Error(`SpriteModifier.getSpriteModifer : Sprite Modifier not found : ${id}`);
    }
    return modifier;
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

