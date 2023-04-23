const { spawnSync } = require('child_process');
const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config()

const { createMaps } = require('./createmaps');

const base = process.env.MAP_SERVE_DIR;
const uploadDir = process.env.MAP_UPLOAD_DIR;

// Keep track of our progress
let progress = {};

const requiredFilenames = [
    'bWluaW1hcF9zZWFfMF8wLnBuZw==',
    'bWluaW1hcF9zZWFfMF8xLnBuZw==',
    'bWluaW1hcF9zZWFfMV8wLnBuZw==',
    'bWluaW1hcF9zZWFfMV8xLnBuZw==',
    'bWluaW1hcF9zZWFfMl8wLnBuZw==',
    'bWluaW1hcF9zZWFfMl8xLnBuZw=='
];

const start = new Date();
console.log(`Map processing running ${start.toISOString()}`);

// Abort if we're already running
if (fs.existsSync('/tmp/map_process_running')) {
    console.log('Aborting - process already running');
    return;
}
fs.closeSync(fs.openSync('/tmp/map_process_running', 'w'));

const createDbConnection = () => {
    // Get the DB config for this instance
    const client = new Client({
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        host: 'db',
        database: 'cadvanced'
    });
    client.connect();
    return client;
};

const prepareMap = async (map) => {
    console.log(`Processing map "${map.name}"`);
    const buff = Buffer.from(map.name, 'base64');
    const mapId = buff.toString('ascii');
    // Note that we've not successfully processed this map yet
    progress[map.name] = false;
    // Check we've got what we're expecting
    let error = false;
    const mapPath = `${uploadDir}/${map.name}`;
    const mapContents = fs.readdirSync(mapPath, { withFileTypes: true });
    const files = mapContents.filter(mc => mc.isFile());
    const fileNames = mapContents.map(mc => mc.name);
    // Has this map already been processed
    const dest = `${base}/${map.name}`;
    if (fs.existsSync(dest)) {
        error = `Destination directory ${dest} already exists`;
    }
    // Have we got 6 files
    if (files.length !== 6) {
        error = 'Not supplied with 6 files';
    }
    // Do all files have the correct names
    const sortedRequired = requiredFilenames.sort();
    const sortedProvided = fileNames.sort();
    const gotAllFiles = sortedRequired.length === sortedProvided.length &&
        sortedProvided.every((val, index) => val === sortedRequired[index]);
    if (!gotAllFiles) {
        error = `Map ${map.name}: Files are not named as expected`;
    }
    // Are all files PNG files?
    const needle = /PNG image data/;
    fileNames.forEach((fileName) => {
        const output = spawnSync(
            '/usr/bin/file',
            [`${mapPath}/${fileName}`],
            { encoding: 'UTF-8' }
        );
        if (!output.stdout.match(needle)) {
            error = 'Non PNG files found';
        }
    });
    if (error) {
        console.log(`Problem found: ${error}`);
        return;
    }
    // We're happy we've got what we expect, so we can process
    await createMaps(mapPath, dest)
        .then(result => {
            progress[map.name] = true;
            // Update our map entry to say it is processed
            const client = createDbConnection();
            const sql = `UPDATE "Maps" SET processed = 't' WHERE id = '${mapId}'`;
            client.query(sql, (err) => {
                //  We've successfully processed this map, so we can remove
                // the map source directory
                fs.rmdirSync(mapPath, { recursive: true });
                client.end();
            });
        })
        .catch(error => {
            console.log(error);
        });
};

const iterate = async () => {
    progress = {};
    const contents = fs.readdirSync(uploadDir, { withFileTypes: true });
    // All pending uploaded map IDs
    const maps = contents.filter(sc => sc.isDirectory());
    for (let mi = 0; mi < maps.length; mi++) {
        const map = maps[mi];
        await prepareMap(map);
    }
    // If we've processed all maps, we can remove the uploaded files
	const mapsQueued = Object.keys(progress);
        const mapsNotDone = mapsQueued.filter((m) => !progress[m]);
        if (mapsQueued.length > 0 && mapsNotDone.length === 0) {
            console.log(`Removing contents of ${uploadDir}`);
            fs.rmdirSync(`${uploadDir}/*`, { recursive: true });
        }
};

iterate().then(() => {
    fs.unlinkSync('/tmp/map_process_running');
    const end = new Date();
    console.log(`Map ending running ${end.toISOString()}`);
});
