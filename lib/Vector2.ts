export class Vector2 {
    constructor(public x: number = 0, public y: number = 0) {}

    public clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }
} 