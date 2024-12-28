export class Vector2 {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    public clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    public add(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    public subtract(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    public multiply(scalar: number): Vector2 {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    public divide(scalar: number): Vector2 {
        if (scalar === 0) {
            throw new Error('Division by zero');
        }
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    public length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public normalize(): Vector2 {
        const len = this.length();
        if (len === 0) {
            return new Vector2();
        }
        return this.divide(len);
    }

    public equals(other: Vector2): boolean {
        return this.x === other.x && this.y === other.y;
    }

    public toString(): string {
        return `Vector2(${this.x}, ${this.y})`;
    }
} 