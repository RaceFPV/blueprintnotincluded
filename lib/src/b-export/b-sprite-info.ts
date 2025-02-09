import { Vector2 } from "../vector2";

export class BSpriteInfo
{
  name: string = '';
  textureName: string = '';
  isIcon: boolean = false;
  isInputOutput: boolean = false;

  uvMin: Vector2 = new Vector2();
  uvSize: Vector2 = new Vector2();
  realSize: Vector2 = new Vector2();
  pivot: Vector2 = new Vector2();

  // Used when repacking textures
  static clone(source: BSpriteInfo): BSpriteInfo
  {
    let returnValue: BSpriteInfo = new BSpriteInfo();

    returnValue.name = source.name;
    returnValue.textureName = source.textureName;
    returnValue.isIcon = source.isIcon;
    returnValue.isInputOutput = source.isInputOutput;

    returnValue.uvMin = source.uvMin ? new Vector2(source.uvMin.x, source.uvMin.y) : Vector2.zero();
    returnValue.uvSize = Vector2.cloneNullToZero(source.uvSize);
    returnValue.realSize = Vector2.cloneNullToZero(source.realSize);
    returnValue.pivot = Vector2.cloneNullToZero(source.pivot);

    return returnValue;
  }

  public copyFrom(source: BSpriteInfo): void {
    let returnValue = new BSpriteInfo();
    returnValue.uvMin = source.uvMin ? new Vector2(source.uvMin.x, source.uvMin.y) : Vector2.zero();
    returnValue.textureName = source.textureName;
    returnValue.isIcon = source.isIcon;
    returnValue.isInputOutput = source.isInputOutput;
    returnValue.uvSize = Vector2.cloneNullToZero(source.uvSize);
    returnValue.realSize = Vector2.cloneNullToZero(source.realSize);
    returnValue.pivot = Vector2.cloneNullToZero(source.pivot);
  }
}