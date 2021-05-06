const fs = require('fs');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

const createTree = async (dest) => {

    let zoom = 5;

    while (zoom >= 0) {
        const divisions = 2 ** zoom; // Courtesy of Thomas
        const zoomSize = divisions * 256;
        console.log(`Zoom ${zoom}, divisions ${divisions}, full image size ${zoomSize}`);
        fs.mkdirSync(`${dest}/${zoom}`);
        const fullPath = `${dest}/${zoom}/${zoomSize}x${zoomSize}.png`;
        await sharp(`${dest}/9216x9216.png`)
            .resize(zoomSize)
            .toFile(fullPath);
        console.log(`Written ${fullPath}`);
        const toExtract = sharp(fullPath);
	process.stdout.write('Row ');
        for (let row = 0; row < divisions; row++) {
	    process.stdout.write(`${row} `);
            for (let col = 0; col < divisions; col++) {
                await toExtract
                    .extract({
                        left: col * 256,
                        top: row * 256,
                        width: 256,
                        height: 256
                    })
                    .toFile(`${dest}/${zoom}/map_${col}_${row}.png`);
            }
        }
	process.stdout.write('\n');
        try {
            await fs.unlinkSync(fullPath);
        } catch (err) {
            fs.unlinkSync(dest, { recursive: true });
            throw err;
        }
        zoom--;
    }
    fs.unlinkSync(`${dest}/9216x9216.png`);
};

const createMaps = async (base, dest) => {
    if (!base) {
        return Promise.reject('Must pass a source path');
    }

    if (!dest) {
        return Promise.reject('Must pass a destination path');
    }

    // Make sure our destination exists
    fs.mkdirSync(dest, { recursive: true });

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
    return new Promise((resolve, reject) => {
        const baseOut = fs.createWriteStream(`${dest}/9216x9216.png`);
        const stream = canvas.createPNGStream();
        stream.pipe(baseOut);
        baseOut.on(
            'close',
            () => createTree(dest)
                .then(() => resolve(true))
                .catch((err) => reject(err))
        );
    });
}

module.exports = { createMaps };
