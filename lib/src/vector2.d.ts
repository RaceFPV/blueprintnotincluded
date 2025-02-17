export declare class Vector2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    clone(): Vector2;
    get length(): number;
    get lengthSquared(): number;
    static clone(original: Vector2 | undefined): Vector2 | null;
    static cloneNullToZero(source: Vector2 | null | undefined): Vector2;
    static zero(): Vector2;
    static one(): Vector2;
    static readonly Zero: Vector2;
    static readonly One: Vector2;
    static readonly Left: Vector2;
    static readonly Right: Vector2;
    static readonly Up: Vector2;
    static readonly Down: Vector2;
    equals(v: Vector2): boolean;
    static compare(v1?: Vector2, v2?: Vector2): boolean;
}
//# sourceMappingURL=vector2.d.ts.map