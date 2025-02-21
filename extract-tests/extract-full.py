import json
import os
from PIL import Image
import logging
from tqdm import tqdm  # For progress bar

def setup_logging():
    """Setup logging to both file and console."""
    # First, suppress PIL debug logging
    pil_logger = logging.getLogger('PIL')
    pil_logger.setLevel(logging.INFO)
    
    log_file = "extract-full.log"
    
    # Setup file logging with detailed output
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()  # This will be replaced for console
        ]
    )
    
    # Setup console logging with minimal output
    console = logging.StreamHandler()
    console.setLevel(logging.WARNING)  # Only show warnings and errors in console
    formatter = logging.Formatter('%(message)s')
    console.setFormatter(formatter)
    
    # Remove default console handler and add our custom one
    logging.getLogger().handlers = [logging.FileHandler(log_file), console]

def load_database(json_path):
    """Loads the JSON database and extracts sprite metadata."""
    with open(json_path, 'r') as file:
        data = json.load(file)
    return data

def get_sprites_for_texture(database, texture_name):
    """Gets all sprites that use a specific texture, sorted by their order in the sprite sheet."""
    sprites = []
    
    # Get all sprites for this texture first
    for sprite in database.get("uiSprites", []):
        if sprite.get("textureName") == texture_name:
            sprites.append(sprite)
    
    for sprite in database.get("sprites", []):
        if sprite.get("textureName") == texture_name:
            sprites.append(sprite)
    
    # Sort sprites by their vertical position (top to bottom)
    sprites.sort(key=lambda s: float(s["uvMin"]["y"]))
    return sprites

def get_sprite_layer_order(database, texture_name):
    """Gets sprites in the correct layering order based on the _base sprite's relatedSprites array."""
    sprites = get_sprites_for_texture(database, texture_name)
    
    # Find the base sprite (ends with _base)
    base_sprite = None
    for sprite in sprites:
        if sprite["name"].endswith("_base"):
            base_sprite = sprite
            break
    
    if not base_sprite:
        # Try finding a sprite with relatedSprites
        for sprite in sprites:
            if sprite.get("relatedSprites"):
                base_sprite = sprite
                break
    
    if not base_sprite:
        logging.debug(f"Warning: No base sprite or related sprites found for {texture_name}, using default ordering")
        return sprites
    
    # Get the related sprites array which defines the layering order (bottom to top)
    ordered_names = base_sprite.get("relatedSprites", [])
    ordered_names.append(base_sprite["name"])
    
    # Get all sprites in the correct order
    ordered_sprites = []
    for name in reversed(ordered_names):  # Keep reversed() to maintain back-to-front order
        sprite_found = False
        for sprite in sprites:
            if sprite["name"] == name:
                ordered_sprites.append(sprite)
                sprite_found = True
                break
        if not sprite_found:
            logging.debug(f"Warning: Related sprite {name} not found in texture {texture_name}")
    
    # Add any sprites that weren't in the relatedSprites list
    for sprite in sprites:
        if sprite not in ordered_sprites:
            logging.debug(f"Info: Adding unrelated sprite {sprite['name']} to {texture_name}")
            ordered_sprites.append(sprite)
    
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
    
    # If no exact match, try without the _0 suffix for UI sprites
    if sprite_name.endswith('_0'):
        base_name = sprite_name[:-2]  # Remove _0
        for modifier in database.get("spriteModifiers", []):
            if modifier["name"] == base_name:
                return {
                    "rotation": float(modifier["rotation"]),
                    "scale": modifier["scale"],
                    "translation": modifier["translation"]
                }
    
    # If no modifier found, use defaults
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
        
        # Special handling for UI/icon sprites with 0 size
        if (sprite.get("isIcon") or "_ui_" in sprite.get("name", "")) and (
            float(uv_size["x"]) == 0 or float(uv_size["y"]) == 0):
            logging.debug(f"UI sprite {sprite['name']} has 0 size, using full image")
            return base_image.copy()
        
        x_min = int(float(uv_min["x"]))
        y_min = int(float(uv_min["y"]))
        width = int(float(uv_size["x"]))
        height = abs(int(float(uv_size["y"])))
        
        if float(uv_size["y"]) < 0:
            y_min += int(float(uv_size["y"]))
        
        x_max = x_min + width
        y_max = y_min + height
        
        logging.debug(f"Extracting region for {sprite['name']}:")
        logging.debug(f"  - UV Min: ({uv_min['x']}, {uv_min['y']})")
        logging.debug(f"  - UV Size: ({uv_size['x']}, {uv_size['y']})")
        logging.debug(f"  - Calculated coordinates: ({x_min}, {y_min}, {x_max}, {y_max})")
        logging.debug(f"  - Image size: {base_image.width}x{base_image.height}")
        
        # For 0-sized UI sprites, use the full image
        if width == 0 or height == 0:
            if sprite.get("isIcon") or "_ui_" in sprite.get("name", ""):
                logging.debug(f"UI sprite {sprite['name']} has 0 size, using full image")
                return base_image.copy()
        
        # Ensure coordinates are within bounds
        x_min = max(0, min(x_min, base_image.width - 1))
        y_min = max(0, min(y_min, base_image.height - 1))
        x_max = max(0, min(x_max, base_image.width))
        y_max = max(0, min(y_max, base_image.height))
        
        if x_min >= x_max or y_min >= y_max:
            logging.warning(f"Invalid crop region for {sprite['name']}")
            return None
            
        region = base_image.crop((x_min, y_min, x_max, y_max))
        logging.debug(f"  - Extracted region size: {region.width}x{region.height}")
        return region
        
    except Exception as e:
        logging.error(f"Error extracting region for {sprite['name']}: {str(e)}")
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

def process_ui_sprite(base_image, sprite, modifier):
    """Process UI sprites similar to generate-icons.ts."""
    try:
        # For icon sprites with uvSize of 0, just copy the full image
        if sprite.get("isIcon") and float(sprite["uvSize"]["x"]) == 0 and float(sprite["uvSize"]["y"]) == 0:
            logging.debug(f"Icon sprite with 0 size, copying full image for: {sprite['name']}")
            return base_image.copy()
            
        # For non-icon UI sprites, continue with existing square container logic
        size = max(base_image.width, base_image.height)
        container = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        
        # Center the image in the container
        paste_x = 0
        paste_y = 0
        if base_image.width > base_image.height:
            paste_y = (base_image.width // 2) - (base_image.height // 2)
        if base_image.height > base_image.width:
            paste_x = (base_image.height // 2) - (base_image.width // 2)
        
        container.paste(base_image, (paste_x, paste_y), base_image)
        
        # Apply transformations
        if modifier["scale"]["x"] != 1 or modifier["scale"]["y"] != 1:
            new_width = int(container.width * abs(modifier["scale"]["x"]))
            new_height = int(container.height * abs(modifier["scale"]["y"]))
            container = container.resize((new_width, new_height), Image.LANCZOS)
            
            if modifier["scale"]["y"] < 0:
                container = container.transpose(Image.FLIP_TOP_BOTTOM)
            if modifier["scale"]["x"] < 0:
                container = container.transpose(Image.FLIP_LEFT_RIGHT)
        
        if modifier["rotation"] != 0:
            container = container.rotate(-modifier["rotation"], expand=True, resample=Image.BICUBIC)
        
        return container
        
    except Exception as e:
        logging.error(f"Error processing UI sprite: {str(e)}")
        return None

def composite_texture_sprites(image_path, sprites, output_path, database):
    """Composites all sprites from a texture into a single image."""
    if not os.path.exists(image_path):
        logging.debug(f"Source image not found: {image_path}")
        return
    
    try:
        base_image = Image.open(image_path).convert("RGBA")
        
        # Match generate-icons.ts logic for finding UI sprites
        ui_sprites = [s for s in sprites if 
            s.get("isIcon") or 
            s.get("isInputOutput") or 
            "_ui_" in s.get("name", "")]
            
        if ui_sprites:
            output_dir = os.path.dirname(output_path)
            
            for sprite in ui_sprites:
                try:
                    # For UI sprites, use the special processing function
                    modifier = get_sprite_modifier(database, sprite["name"])
                    processed_sprite = process_ui_sprite(base_image, sprite, modifier)
                    
                    if processed_sprite is None:
                        continue
                    
                    # Save individual UI sprite - but remove _ui from the name
                    sprite_name = sprite["name"]
                    if "_ui_" in sprite_name:
                        # Convert something like "Granite_ui_0" to "Granite_0"
                        sprite_name = sprite_name.replace("_ui_", "_")
                    elif sprite_name.endswith('_ui'):
                        sprite_name = sprite_name[:-3]
                    ui_output_path = os.path.join(output_dir, f"{sprite_name}.png")
                    processed_sprite.save(ui_output_path, "PNG")
                    logging.debug(f"Extracted: {sprite_name}")
                    
                except Exception as e:
                    logging.error(f"Error with {sprite['name']}: {str(e)}")
        
        # For all other sprites, composite them together
        regular_sprites = [s for s in sprites if s.get("isIcon") is not True]  # Everything that's not an icon
        if regular_sprites:
            # First pass: extract regions and calculate total bounds
            sprite_regions = []
            min_x = float('inf')
            min_y = float('inf')
            max_x = float('-inf')
            max_y = float('-inf')
            
            for sprite in regular_sprites:
                try:
                    region = extract_sprite_region(base_image, sprite)
                    if region is None:
                        continue
                    
                    pos_x, pos_y = calculate_sprite_position(sprite, region)
                    modifier = get_sprite_modifier(database, sprite["name"])
                    region = process_sprite_transformations(region, modifier)
                    
                    pos_x += modifier["translation"]["x"]
                    pos_y -= modifier["translation"]["y"]
                    
                    sprite_info = {
                        "name": sprite["name"],
                        "region": region,
                        "pos_x": pos_x,
                        "pos_y": pos_y
                    }
                    sprite_regions.append(sprite_info)
                    
                    min_x = min(min_x, pos_x)
                    min_y = min(min_y, pos_y)
                    max_x = max(max_x, pos_x + region.width)
                    max_y = max(max_y, pos_y + region.height)
                    
                except Exception as e:
                    logging.error(f"Error processing sprite {sprite['name']}: {str(e)}")
            
            if sprite_regions:
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
                logging.debug(f"Saved composite image to {output_path}")
        
    except Exception as e:
        logging.error(f"Error creating composite: {str(e)}")

def cleanup_output_folders(output_folder):
    """Clean up old output files and logs before starting."""
    # Clear log file
    with open("extract-full.log", 'w') as f:
        f.write("")  # Write empty string to clear file
    
    # Remove and recreate output folder
    if os.path.exists(output_folder):
        for file in os.listdir(output_folder):
            file_path = os.path.join(output_folder, file)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error: Failed to delete {file_path}: {str(e)}")
    
    # Ensure output folder exists
    os.makedirs(output_folder, exist_ok=True)

def process_textures(database_path, image_folder, output_folder):
    """Process all textures from the full database."""
    try:
        cleanup_output_folders(output_folder)
        setup_logging()
        
        logging.debug(f"Loading database from {database_path}...")
        database = load_database(database_path)
        
        # First handle icon category sprites
        logging.debug("Processing icon category sprites...")
        for sprite in database.get("uiSprites", []):
            texture_name = sprite.get("textureName", "")
            if texture_name and sprite.get("isIcon", True) and "icon_category" in texture_name:
                try:
                    image_path = os.path.join(image_folder, f"{texture_name}.png")
                    output_path = os.path.join(output_folder, f"{sprite['name']}.png")
                    
                    if not os.path.exists(image_path):
                        logging.warning(f"Source image not found: {image_path}")
                        continue
                    
                    base_image = Image.open(image_path).convert("RGBA")
                    img_width, img_height = base_image.size
                    
                    uv_min = sprite.get("uvMin", {"x": 0, "y": 0})
                    uv_size = sprite.get("uvSize", {"x": 0, "y": 0})
                    
                    x_min = int(float(uv_min["x"]))
                    y_min = int(float(uv_min["y"]))
                    width = int(float(uv_size["x"]))
                    height = abs(int(float(uv_size["y"])))
                    
                    if float(uv_size["y"]) < 0:
                        y_min += int(float(uv_size["y"]))
                    
                    x_max = x_min + width
                    y_max = y_min + height
                    
                    x_min = max(0, min(x_min, img_width - 1))
                    y_min = max(0, min(y_min, img_height - 1))
                    x_max = max(0, min(x_max, img_width))
                    y_max = max(0, min(y_max, img_height))
                    
                    if x_min >= x_max or y_min >= y_max:
                        logging.warning(f"Invalid crop region for icon: {sprite['name']}")
                        continue
                    
                    extracted_sprite = base_image.crop((x_min, y_min, x_max, y_max))
                    extracted_sprite.save(output_path, "PNG")
                    logging.debug(f"Extracted icon category sprite: {sprite['name']}")
                    
                except Exception as e:
                    logging.error(f"Error processing icon category sprite {sprite['name']}: {str(e)}")
        
        # Then process all other textures as before
        texture_names = set()
        for building in database.get("buildings", []):
            if building.get("textureName"):
                texture_names.add(building["textureName"])
        
        for category in ['uiSprites', 'sprites']:
            for sprite in database.get(category, []):
                if sprite.get("textureName"):
                    texture_names.add(sprite["textureName"])
        
        logging.debug(f"Processing {len(texture_names)} textures...")
        
        # Process each texture with progress bar
        with tqdm(total=len(texture_names), unit='texture') as pbar:
            for texture_name in sorted(texture_names):
                # Skip icon_category textures as we've already processed them
                if "icon_category" in texture_name:
                    pbar.update(1)
                    continue
                    
                try:
                    image_path = os.path.join(image_folder, f"{texture_name}.png")
                    output_path = os.path.join(output_folder, f"{texture_name}.png")
                    
                    if not os.path.exists(image_path):
                        logging.warning(f"Source image not found: {image_path}")
                        pbar.update(1)
                        continue
                    
                    sprites = get_sprite_layer_order(database, texture_name)
                    if not sprites:
                        logging.debug(f"No sprites found for texture: {texture_name}")
                        pbar.update(1)
                        continue
                    
                    logging.debug(f"Processing {texture_name} ({len(sprites)} sprites)")
                    composite_texture_sprites(image_path, sprites, output_path, database)
                    pbar.update(1)
                    
                except Exception as e:
                    logging.error(f"Error processing texture {texture_name}: {str(e)}")
                    pbar.update(1)
                    continue
        
        logging.info("Processing complete! Check extract-full.log for details")
        
    except Exception as e:
        logging.error(f"Error during processing: {str(e)}")

if __name__ == "__main__":
    # Use the actual paths
    database_path = "database.json"
    image_folder = "images"
    output_folder = "groups-output"
    
    process_textures(database_path, image_folder, output_folder)
