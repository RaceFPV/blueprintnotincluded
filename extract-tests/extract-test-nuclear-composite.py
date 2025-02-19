import json
import os
from PIL import Image

def load_database(json_path):
    """Loads the JSON database and extracts sprite metadata."""
    with open(json_path, 'r') as file:
        data = json.load(file)
    return data

def get_sprites_for_texture(database, texture_name):
    """Gets all sprites that use a specific texture, sorted by their order in the sprite sheet."""
    sprites = []
    for sprite in database.get("uiSprites", []):
        if sprite.get("textureName") == texture_name:
            sprites.append(sprite)
    
    # Sort sprites by their vertical position (top to bottom)
    # This helps ensure proper layering
    sprites.sort(key=lambda s: float(s["uvMin"]["y"]))
    return sprites

def get_sprite_layer_order(database, texture_name):
    """Gets sprites in the correct layering order based on the _base sprite's relatedSprites array."""
    # Find the base sprite (ends with _base)
    base_sprite = None
    for sprite in database.get("uiSprites", []):
        if sprite.get("textureName") == texture_name and sprite["name"].endswith("_base"):
            base_sprite = sprite
            break
    
    if not base_sprite:
        print("Warning: No base sprite found, using default ordering")
        return get_sprites_for_texture(database, texture_name)
    
    # Get the related sprites array which defines the layering order (bottom to top)
    ordered_names = base_sprite.get("relatedSprites", [])
    ordered_names.append(base_sprite["name"])
    
    # Get all sprites in the correct order
    ordered_sprites = []
    for name in reversed(ordered_names):
        for sprite in database.get("uiSprites", []):
            if sprite["name"] == name:
                ordered_sprites.append(sprite)
                break
    
    return ordered_sprites

def get_sprite_modifier(database, sprite_name):
    """Gets the sprite modifier data for a sprite."""
    for modifier in database.get("spriteModifiers", []):
        if modifier["name"] == sprite_name:
            return {
                "rotation": float(modifier["rotation"]),
                "scale": modifier["scale"],
                "translation": modifier["translation"]
            }
    
    # If no modifier found, use defaults
    print(f"Warning: No sprite modifier found for {sprite_name}, using defaults")
    return {
        "rotation": 0,
        "scale": {"x": 1, "y": 1},
        "translation": {"x": 0, "y": 0}
    }

def get_building_data(database, texture_name):
    """Gets the building data that uses this texture."""
    for building in database.get("buildings", []):
        if building.get("textureName") == texture_name:
            return building
    return None

def extract_sprite_region(base_image, sprite):
    """Extracts a region from the base image using sprite UV coordinates."""
    try:
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
        
        # Ensure coordinates are within bounds
        x_min = max(0, min(x_min, base_image.width - 1))
        y_min = max(0, min(y_min, base_image.height - 1))
        x_max = max(0, min(x_max, base_image.width))
        y_max = max(0, min(y_max, base_image.height))
        
        if x_min >= x_max or y_min >= y_max:
            print(f"Invalid crop region for {sprite['name']}")
            return None
            
        return base_image.crop((x_min, y_min, x_max, y_max))
    except Exception as e:
        print(f"Error extracting region for {sprite['name']}: {str(e)}")
        return None

def calculate_sprite_position(sprite, region):
    """Calculates the sprite position using pivot and realSize."""
    pivot = sprite.get("pivot", {"x": 0.5, "y": 0.5})
    real_size = sprite.get("realSize", {"x": region.width, "y": region.height})
    
    # Calculate initial position based on pivot (like sprite.anchor in PIXI)
    pivot_x = float(pivot["x"])
    pivot_y = 1 - float(pivot["y"])  # Flip Y like in original
    
    # Initial position is negative pivot * size
    pos_x = -pivot_x * float(real_size["x"])
    pos_y = -pivot_y * float(real_size["y"])
    
    return pos_x, pos_y

def process_sprite_transformations(region, modifier):
    """Applies transformations in the correct order: scale, then rotate."""
    # Apply scale first
    if modifier["scale"]["x"] != 1 or modifier["scale"]["y"] != 1:
        new_width = int(region.width * abs(modifier["scale"]["x"]))
        new_height = int(region.height * abs(modifier["scale"]["y"]))
        region = region.resize((new_width, new_height), Image.LANCZOS)
        
        # If negative scale, flip the image
        if modifier["scale"]["y"] < 0:
            region = region.transpose(Image.FLIP_TOP_BOTTOM)
        if modifier["scale"]["x"] < 0:
            region = region.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Then apply rotation
    if modifier["rotation"] != 0:
        region = region.rotate(-modifier["rotation"], expand=True, resample=Image.BICUBIC)
    
    return region

def composite_texture_sprites(image_path, sprites, output_path, database):
    """Composites all sprites from a texture into a single image."""
    if not os.path.exists(image_path):
        print(f"Error: Source image not found: {image_path}")
        return
    
    try:
        base_image = Image.open(image_path).convert("RGBA")
        print(f"Processing texture: {image_path}")
        
        # First pass: extract regions and calculate total bounds
        sprite_regions = []
        min_x = float('inf')
        min_y = float('inf')
        max_x = float('-inf')
        max_y = float('-inf')
        
        for sprite in sprites:
            try:
                # Extract base sprite data
                region = extract_sprite_region(base_image, sprite)
                if region is None:
                    continue
                
                # Get initial position from pivot
                pos_x, pos_y = calculate_sprite_position(sprite, region)
                
                # Get sprite modifier data and apply translations
                modifier = get_sprite_modifier(database, sprite["name"])
                
                # Apply transformations
                region = process_sprite_transformations(region, modifier)
                
                # Apply translations last
                pos_x += modifier["translation"]["x"]
                pos_y -= modifier["translation"]["y"]
                
                sprite_info = {
                    "name": sprite["name"],
                    "region": region,
                    "pos_x": pos_x,
                    "pos_y": pos_y
                }
                sprite_regions.append(sprite_info)
                
                # Update bounds
                min_x = min(min_x, pos_x)
                min_y = min(min_y, pos_y)
                max_x = max(max_x, pos_x + region.width)
                max_y = max(max_y, pos_y + region.height)
                
            except Exception as e:
                print(f"Error processing sprite {sprite['name']}: {str(e)}")
        
        if not sprite_regions:
            print("No valid sprites to composite")
            return
            
        # Create composite with calculated dimensions
        total_width = int(max_x - min_x)
        total_height = int(max_y - min_y)
        composite = Image.new("RGBA", (total_width, total_height), (0, 0, 0, 0))
        
        # Place each sprite
        for sprite_info in sprite_regions:
            paste_x = int(sprite_info["pos_x"] - min_x)
            paste_y = int(sprite_info["pos_y"] - min_y)
            
            composite.paste(
                sprite_info["region"],
                (paste_x, paste_y),
                sprite_info["region"]
            )
        
        composite.save(output_path)
        print(f"Saved composite image to {output_path}")
        
    except Exception as e:
        print(f"Error creating composite: {str(e)}")

def process_textures(database_path, image_folder, output_folder):
    """Process textures and create composite images."""
    try:
        os.makedirs(output_folder, exist_ok=True)
        print(f"Loading database from {database_path}...")
        database = load_database(database_path)
        
        # For testing, just process medicine_nuclear_0
        texture_name = "medicine_nuclear_0"
        image_path = os.path.join(image_folder, f"{texture_name}.png")
        output_path = os.path.join(output_folder, f"{texture_name}.png")
        
        sprites = get_sprite_layer_order(database, texture_name)
        print(f"\nFound {len(sprites)} sprites for {texture_name}")
        
        composite_texture_sprites(image_path, sprites, output_path, database)
        
    except Exception as e:
        print(f"Error during processing: {str(e)}")

if __name__ == "__main__":
    database_path = "database-mini.json"
    image_folder = "."  # Assuming medicine_nuclear_0.png is in the current directory
    output_folder = "groups-output"
    
    process_textures(database_path, image_folder, output_folder)
