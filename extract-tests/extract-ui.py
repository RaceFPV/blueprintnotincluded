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
        if (sprite.get("isIcon") is True and 
            sprite.get("textureName") and 
            "_ui" in sprite.get("name", "") and
            float(sprite["uvSize"]["x"]) > 0 and 
            float(sprite["uvSize"]["y"]) != 0):
            ui_sprites.append(sprite)
    
    print(f"Found {len(ui_sprites)} UI sprites to process")
    return ui_sprites

def extract_single_sprite(image_path, sprite, output_path):
    """Extracts a single sprite component from the sprite sheet based on metadata."""
    if not os.path.exists(image_path):
        print(f"Error: Image not found: {image_path}")
        return
    
    try:
        base_image = Image.open(image_path).convert("RGBA")
        
        uv_min = sprite["uvMin"]
        uv_size = sprite["uvSize"]
        
        x_min = int(float(uv_min["x"]))
        y_min = int(float(uv_min["y"]))
        width = int(float(uv_size["x"]))
        height = abs(int(float(uv_size["y"])))
        
        if float(uv_size["y"]) < 0:
            y_min += int(float(uv_size["y"]))
        
        x_max = x_min + width
        y_max = y_min + height
        
        x_min = max(0, min(x_min, base_image.width - 1))
        y_min = max(0, min(y_min, base_image.height - 1))
        x_max = max(0, min(x_max, base_image.width))
        y_max = max(0, min(y_max, base_image.height))
        
        if x_min >= x_max or y_min >= y_max:
            print(f"Error: Invalid crop region for {sprite['name']}")
            return
        
        extracted_sprite = base_image.crop((x_min, y_min, x_max, y_max))
        extracted_sprite.save(output_path, "PNG")
        print(f"Extracted: {sprite['name']}")
        
    except Exception as e:
        print(f"Error processing {sprite['name']}: {str(e)}")

def process_all_sprites(database_path, image_folder, output_folder):
    """Processes only UI sprites marked as 'isIcon' and extracts them from their respective image files."""
    try:
        os.makedirs(output_folder, exist_ok=True)
        print(f"Loading database from {database_path}...")
        database = load_database(database_path)
        
        sprites = extract_ui_sprites(database)
        processed = 0
        errors = 0
        
        print("\nExtracting sprites...")
        for sprite in sprites:
            texture_name = sprite.get("textureName", "")
            image_path = os.path.join(image_folder, f"{texture_name}.png")
            output_path = os.path.join(output_folder, f"{sprite['name']}.png")
            
            if os.path.exists(image_path):
                extract_single_sprite(image_path, sprite, output_path)
                processed += 1
            else:
                print(f"Error: Missing image file for {sprite['name']}")
                errors += 1
        
        print(f"\nComplete! Processed {processed} sprites ({errors} errors)")
    
    except Exception as e:
        print(f"Error during processing: {str(e)}")

if __name__ == "__main__":
    database_path = "../assets/database/database.json"
    image_folder = "../assets/images"
    output_folder = "output"
    
    process_all_sprites(database_path, image_folder, output_folder)
