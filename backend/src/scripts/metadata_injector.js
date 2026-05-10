import fs from 'fs';
import path from 'path';
import piexif from 'piexifjs';

// Configuration
const IMAGE_DIR = path.resolve('../images');
const OUTPUT_DIR = path.resolve('../images/processed');

// Mumbai Locations
const LOCATIONS = [
    { name: "Bandstand, Bandra", lat: 19.0433, lon: 72.8185 },
    { name: "Bandstand, Bandra", lat: 19.0435, lon: 72.8187 }, // Second pair near Bandstand
    { name: "Marine Drive", lat: 18.9430, lon: 72.8230 },
    { name: "Gateway of India", lat: 18.9220, lon: 72.8347 },
    { name: "Juhu Beach", lat: 19.1075, lon: 72.8263 },
    { name: "Dadar Chowpatty", lat: 19.0250, lon: 72.8360 },
    { name: "Worli Sea Face", lat: 19.0000, lon: 72.8150 }
];

/**
 * Convert decimal degrees to EXIF rational format
 */
function toRational(decimal) {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutes = Math.floor((abs - degrees) * 60);
    const seconds = Math.round((abs - degrees - minutes / 60) * 3600 * 100) / 100;
    
    return [
        [degrees, 1],
        [minutes, 1],
        [Math.round(seconds * 100), 100]
    ];
}

/**
 * Inject EXIF data into a JPG
 */
function injectMetadata(filename, lat, lon, isAfter = false) {
    try {
        const filePath = path.join(IMAGE_DIR, filename);
        const fileContent = fs.readFileSync(filePath);
        const jpegData = fileContent.toString("binary");
        
        const zeroth = {};
        const exif = {};
        const gps = {};
        
        // Before photo: 24 hours ago
        // After photo: Now
        const now = new Date();
        const date = isAfter ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const dateStr = date.getFullYear() + ":" + 
                       String(date.getMonth() + 1).padStart(2, '0') + ":" + 
                       String(date.getDate()).padStart(2, '0') + " " + 
                       String(date.getHours()).padStart(2, '0') + ":" + 
                       String(date.getMinutes()).padStart(2, '0') + ":" + 
                       String(date.getSeconds()).padStart(2, '0');
                       
        zeroth[piexif.ImageIFD.DateTime] = dateStr;
        exif[piexif.ExifIFD.DateTimeOriginal] = dateStr;
        
        gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
        gps[piexif.GPSIFD.GPSLatitude] = toRational(lat);
        gps[piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? "E" : "W";
        gps[piexif.GPSIFD.GPSLongitude] = toRational(lon);
        
        const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
        const exifBytes = piexif.dump(exifObj);
        
        const newJpegData = piexif.insert(exifBytes, jpegData);
        const buffer = Buffer.from(newJpegData, "binary");
        
        const prefix = isAfter ? "after_" : "before_";
        const outputFilename = `${prefix}${filename}`;
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        
        fs.writeFileSync(path.join(OUTPUT_DIR, outputFilename), buffer);
        console.log(`✅ Processed: ${filename} -> ${outputFilename}`);
        console.log(`   Type: ${isAfter ? 'AFTER' : 'BEFORE'} | Location: ${lat}, ${lon} | Time: ${dateStr}`);
    } catch (err) {
        console.error(`❌ Failed to process ${filename}:`, err.message);
    }
}

// Run
console.log(`Scanning ${IMAGE_DIR}...`);
const files = fs.readdirSync(IMAGE_DIR).filter(f => f.match(/\.(jpg|jpeg)$/i));

if (files.length < 2) {
    console.log("Need at least 2 images to create a before/after pair.");
} else {
    // Process in pairs
    for (let i = 0; i < files.length - 1; i += 2) {
        const locationIdx = Math.floor(i / 2) % LOCATIONS.length;
        const loc = LOCATIONS[locationIdx];
        
        const beforeFile = files[i];
        const afterFile = files[i+1];
        
        console.log(`\nPairing for ${loc.name}:`);
        injectMetadata(beforeFile, loc.lat, loc.lon, false);
        injectMetadata(afterFile, loc.lat, loc.lon, true);
    }
    console.log(`\nSuccess! Check the '${OUTPUT_DIR}' folder.`);
}
