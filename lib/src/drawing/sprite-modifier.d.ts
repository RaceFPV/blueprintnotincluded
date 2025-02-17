import { SpriteTag } from "../enums/sprite-tag";
import { Vector2 } from "../vector2";
import { BSpriteModifier } from "../b-export/b-sprite-modifier";
import { BBuilding } from "../b-export/b-building";
export declare class SpriteModifier {
    spriteModifierId: string;
    spriteInfoName: string;
    tags: SpriteTag[];
    rotation: number;
    scale: Vector2;
    translation: Vector2;
    constructor(spriteModifierId: string);
    importFrom(original: BSpriteModifier): void;
    cleanUp(): void;
    hasTag(tag: SpriteTag): boolean;
    static AddSpriteModifier(bBuilding: BBuilding): void;
    static get spriteModifiers(): SpriteModifier[];
    private static spriteModifiersMap;
    static init(): void;
    static addSpriteModifier(spriteModifier: SpriteModifier): void;
    static getSpriteModifier(id: string): SpriteModifier;
    static load(spriteModifiers: BSpriteModifier[]): void;
}
//# sourceMappingURL=sprite-modifier.d.ts.map