const jimp = require('jimp');
const path = require('path');

async function extractWireSprite() {
  try {
    console.log('Loading utilities_electric_0.png...');
    
    // Load the source image
    const sourcePath = './frontend/src/assets/images/utilities_electric_0.png';
    const image = await jimp.read(sourcePath);
    
    console.log(`Source image dimensions: ${image.getWidth()}x${image.getHeight()}`);
    
    // Wire_electric_place_6 sprite info from debug output:
    const uvMin = { x: 272, y: 0 };
    const uvSize = { x: 76, y: 38 };
    const realSize = { x: 75.5, y: 37.5 };
    const pivot = { x: 0.7357616, y: 0.548999965 };
    
    console.log('Extracting sprite with coordinates:');
    console.log(`  UV Min: (${uvMin.x}, ${uvMin.y})`);
    console.log(`  UV Size: ${uvSize.x} x ${uvSize.y}`);
    console.log(`  Real Size: ${realSize.x} x ${realSize.y}`);
    console.log(`  Pivot: (${pivot.x}, ${pivot.y})`);
    
    // Extract the sprite region
    const extractedSprite = image.clone().crop(
      uvMin.x,     // x position
      uvMin.y,     // y position  
      uvSize.x,    // width
      uvSize.y     // height
    );
    
    // Save the extracted sprite
    const outputPath = './frontend/src/assets/images/ui/wire_test.png';
    await extractedSprite.writeAsync(outputPath);
    
    console.log(`✅ Extracted sprite saved to: ${outputPath}`);
    console.log(`✅ Extracted sprite dimensions: ${extractedSprite.getWidth()}x${extractedSprite.getHeight()}`);
    
    // Also create a larger version for easier viewing
    const scaledSprite = extractedSprite.clone().scale(4); // 4x larger
    const scaledOutputPath = './frontend/src/assets/images/ui/wire_test_4x.png';
    await scaledSprite.writeAsync(scaledOutputPath);
    
    console.log(`✅ 4x scaled version saved to: ${scaledOutputPath}`);
    
  } catch (error) {
    console.error('❌ Error extracting sprite:', error);
  }
}

extractWireSprite(); 