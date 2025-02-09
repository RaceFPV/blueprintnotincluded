export class Vector2 {
    constructor(public x: number = 0, public y: number = 0) {}

    public clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    get length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    get lengthSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    static clone(original: Vector2 | undefined): Vector2 | null {
        if (original == null) return null;
        return new Vector2(original.x, original.y);
    }

    public static cloneNullToZero(source: Vector2 | null | undefined): Vector2 {
        if (!source) return new Vector2(0, 0);
        return new Vector2(source.x, source.y);
    }

    public static zero(): Vector2 {
        return new Vector2(0, 0);
    }

    public static one(): Vector2 {
        return new Vector2(1, 1);
    }

    // Static readonly properties
    static readonly Zero = new Vector2(0, 0);
    static readonly One = new Vector2(1, 1);
    static readonly Left = new Vector2(-1, 0);
    static readonly Right = new Vector2(1, 0);
    static readonly Up = new Vector2(0, 1);
    static readonly Down = new Vector2(0, -1);

    public equals(v: Vector2): boolean {
        return this.x === v.x && this.y === v.y;
    }

    public static compare(v1?: Vector2, v2?: Vector2): boolean {
        if (v1 == null && v2 == null) return true;
        if (v1 == null || v2 == null) return false;
        return v1.equals(v2);
    }
}