import json
import os
from PIL import Image

def load_database(json_path):
    """Loads the JSON database and extracts sprite metadata."""
    with open(json_path, 'r') as file:
        data = json.load(file)
    return data

def extract_ui_sprite(database, texture_name):
    """Finds the '_ui' sprite metadata for a given texture name from uiSprites."""
    for sprite in database.get("uiSprites", []):
        if sprite.get("textureName") == texture_name and "_ui" in sprite.get("name", ""):
            return sprite
    return None

def extract_single_sprite(image_path, sprite, output_path):
    """Extracts a single sprite component from the sprite sheet based on metadata."""
    base_image = Image.open(image_path).convert("RGBA")
    img_width, img_height = base_image.size
    
    uv_min = sprite.get("uvMin", {"x": 0, "y": 0})
    uv_size = sprite.get("uvSize", {"x": 0, "y": 0})
    
    x_min = int(uv_min["x"])
    y_min = int(uv_min["y"])
    width = int(uv_size["x"])
    height = abs(int(uv_size["y"]))  # Ensure height is always positive
    
    # Adjust y_min correctly if uvSize.y is negative
    if uv_size["y"] < 0:
        y_min += uv_size["y"]
    
    x_max = x_min + width
    y_max = y_min + height
    
    # Ensure cropping bounds stay within the image dimensions
    x_min = max(0, min(x_min, img_width - 1))
    y_min = max(0, min(y_min, img_height - 1))
    x_max = max(0, min(x_max, img_width))
    y_max = max(0, min(y_max, img_height))
    
    print(f"Extracting sprite at ({x_min}, {y_min}) to ({x_max}, {y_max}) from {image_path}")
    
    if x_min >= x_max or y_min >= y_max:
        print(f"Error: Adjusted crop coordinates are invalid ({x_min}, {y_min}, {x_max}, {y_max})")
        return
    
    extracted_sprite = base_image.crop((x_min, y_min, x_max, y_max))
    extracted_sprite.save(output_path, "PNG")
    print(f"Extracted UI sprite saved to {output_path}")

if __name__ == "__main__":
    database_path = "database-mini.json"  # Using smaller debug database
    sprite_image_path = "medicine_nuclear_0.png"  # Update with correct path
    output_image_path = "medicine_nuclear_ui.png"
    
    db = load_database(database_path)
    ui_sprite = extract_ui_sprite(db, "medicine_nuclear_0")
    
    if ui_sprite:
        extract_single_sprite(sprite_image_path, ui_sprite, output_image_path)
    else:
        print("Error: No '_ui' sprite found for the given texture.")
