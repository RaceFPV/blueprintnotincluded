import json
import os
from PIL import Image

def load_database(json_path):
    """Loads the JSON database and extracts sprite metadata."""
    with open(json_path, 'r') as file:
        data = json.load(file)
    return data

def extract_ui_sprites(database):
    """Finds only sprites marked with 'isIcon: true' by matching their textureName field to the actual image file names."""
    ui_sprites = []
    for sprite in database.get("uiSprites", []):
        texture_name = sprite.get("textureName", "")
        if texture_name and sprite.get("isIcon", True) and "icon_category" in texture_name:  # Ensure only sprites marked as 'isIcon' are selected
            ui_sprites.append(sprite)
    
    print("Found UI Sprites:")
    for sprite in ui_sprites:
        print(f"- {sprite['name']} (texture: {sprite['textureName']}, uvMin: {sprite['uvMin']}, uvSize: {sprite['uvSize']})")
    
    return ui_sprites

def extract_single_sprite(image_path, sprite, output_path):
    """Extracts a single sprite component from the sprite sheet based on metadata."""
    if not os.path.exists(image_path):
        print(f"Error: Source image not found for {sprite['name']} ({image_path})")
        return
    
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

def process_all_sprites(database_path, image_folder, output_folder):
    """Processes only UI sprites marked as 'isIcon' and extracts them from their respective image files."""
    os.makedirs(output_folder, exist_ok=True)
    database = load_database(database_path)
    sprites = extract_ui_sprites(database)
    
    for sprite in sprites:
        texture_name = sprite.get("textureName", "unknown")
        image_path = os.path.join(image_folder, f"{texture_name}.png")
        output_path = os.path.join(output_folder, f"{sprite['name']}.png")
        
        if os.path.exists(image_path):
            extract_single_sprite(image_path, sprite, output_path)
        else:
            print(f"Warning: Image file {image_path} not found, skipping {sprite['name']}")




if __name__ == "__main__":
    database_path = "../assets/database/database.json"  # Path to database
    image_folder = "../assets/images"  # Folder containing sprite sheets
    output_folder = "icons"  # Folder to store extracted sprites
    
    process_all_sprites(database_path, image_folder, output_folder)
