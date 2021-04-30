const fs = require('fs');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

const createTree = async (base) => {

    let zoom = 5;

    while (zoom >= 0) {
        console.log(`Zoom ${zoom}...`);
        const divisions = 2 ** zoom; // Courtesy of Thomas
        console.log(`Divisions ${divisions}`);
        const zoomSize = divisions * 256;
        console.log(`Full image size ${zoomSize}`);
        fs.mkdirSync(`${base}/${zoom}`);
        const fullPath = `${base}/${zoom}/${zoomSize}x${zoomSize}.png`;
        console.log(`About to write to ${fullPath}`);
        await sharp(`${base}/9216x9216.png`)
            .resize(zoomSize)
            .toFile(fullPath);
        console.log(`Written ${fullPath}`);
        const toExtract = sharp(fullPath);
        for (let row = 0; row < divisions; row++) {
            console.log(`..Row ${row}`);
            for (let col = 0; col < divisions; col++) {
                console.log(`....Col ${col}`);
                await toExtract
                    .extract({
                        left: col * 256,
                        top: row * 256,
                        width: 256,
                        height: 256
                    })
                    .toFile(`${base}/${zoom}/map_${col}_${row}.png`);
                console.log(`Written ./${zoom}/map_${col}_${row}.png`);
            }
        }
        try {
            await fs.unlinkSync(fullPath);
        } catch (err) {
            console.log(err);
        }
        zoom--;
    }
    fs.unlinkSync(`${base}/9216x9216.png`);
};

const createMaps = async (base) => {
    if (!base) {
        console.log('Must pass a path');
        return;
    }

    const images = [
        { src: `${base}/bWluaW1hcF9zZWFfMF8wLnBuZw==`, x: 1536, y: 0 },    // minimap_sea_0_0.png
        { src: `${base}/bWluaW1hcF9zZWFfMF8xLnBuZw==`, x: 4608, y: 0 },    // minimap_sea_0_1.png
        { src: `${base}/bWluaW1hcF9zZWFfMV8wLnBuZw==`, x: 1536, y: 3072 }, // minimap_sea_1_0.png
        { src: `${base}/bWluaW1hcF9zZWFfMV8xLnBuZw==`, x: 4608, y: 3072 }, // minimap_sea_1_1.png
        { src: `${base}/bWluaW1hcF9zZWFfMl8wLnBuZw==`, x: 1536, y: 6142 }, // minimap_sea_2_0.png
        { src: `${base}/bWluaW1hcF9zZWFfMl8xLnBuZw==`, x: 4608, y: 6142 }  // minimap_sea_2_1.png
    ];

    const canvas = createCanvas(9216, 9216);
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < images.length; i++) {
        console.log(`Processing image ${images[i].src}...`);
        const img = await loadImage(images[i].src);
        ctx.drawImage(img, images[i].x, images[i].y);
    }
    const baseOut = fs.createWriteStream(`${base}/9216x9216.png`);
    const stream = canvas.createPNGStream();
    stream.pipe(baseOut);
    baseOut.on('close', () => createTree(base));
}

module.exports = { createMaps };