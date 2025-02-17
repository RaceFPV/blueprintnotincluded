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
export declare class SpriteModifier {
    private static instance;
    private static spriteModifiers;
    id: string;
    position: Vector2;
    sprite: any;
    container: any;
    constructor();
    private static ensureInitialized;
    static getInstance(): SpriteModifier;
    private defaultDrawPixi;
    static init(): void;
    private static logError;
    private static getOrCreatePosition;
    private static safeSetPosition;
    static hover(id: string, position?: Vector2 | Position): void;
    private static isPosition;
    static load(modifiers: BSpriteModifier[]): void;
    static getSpriteModifer(id: string): SpriteModifier;
    drawPixi(camera: any, util: any): void;
    mouseMove(event: any): void;
}
export {};
//# sourceMappingURL=SpriteModifier.d.ts.map