import fs from 'fs';
import path from 'path';
import piexif from 'piexifjs';
import { execSync } from 'child_process';

const IMAGE_DIR = path.resolve('../images');
const VARIANT_DIR = path.resolve('../images/variants');
const DEMO_DIR = path.resolve('../images/demo_suite');

// Mumbai Locations
const LOCATIONS = [
    { name: "Bandstand", lat: 19.0433, lon: 72.8185 },
    { name: "MarineDrive", lat: 18.9430, lon: 72.8230 },
    { name: "Gateway", lat: 18.9220, lon: 72.8347 },
    { name: "JuhuBeach", lat: 19.1075, lon: 72.8263 },
    { name: "DadarChowpatty", lat: 19.0250, lon: 72.8360 },
    { name: "WorliSeaFace", lat: 19.0000, lon: 72.8150 }
];

function toRational(decimal) {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutes = Math.floor((abs - degrees) * 60);
    const seconds = Math.round((abs - degrees - minutes / 60) * 3600 * 100) / 100;
    return [[degrees, 1], [minutes, 1], [Math.round(seconds * 100), 100]];
}

function injectMetadata(inputPath, outputPath, lat, lon, isAfter = false) {
    const jpegData = fs.readFileSync(inputPath).toString("binary");
    const now = new Date();
    const date = isAfter ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dateStr = date.getFullYear() + ":" + 
                   String(date.getMonth() + 1).padStart(2, '0') + ":" + 
                   String(date.getDate()).padStart(2, '0') + " " + 
                   String(date.getHours()).padStart(2, '0') + ":" + 
                   String(date.getMinutes()).padStart(2, '0') + ":" + 
                   String(date.getSeconds()).padStart(2, '0');

    const exifObj = {
        "0th": { [piexif.ImageIFD.DateTime]: dateStr },
        "Exif": { [piexif.ExifIFD.DateTimeOriginal]: dateStr },
        "GPS": {
            [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? "N" : "S",
            [piexif.GPSIFD.GPSLatitude]: toRational(lat),
            [piexif.GPSIFD.GPSLongitudeRef]: lon >= 0 ? "E" : "W",
            [piexif.GPSIFD.GPSLongitude]: toRational(lon)
        }
    };
    const exifBytes = piexif.dump(exifObj);
    const newJpegData = piexif.insert(exifBytes, jpegData);
    fs.writeFileSync(outputPath, Buffer.from(newJpegData, "binary"));
}

async function run() {
    console.log("1. Generating Visual Variants using Python/OpenCV...");
    execSync('python src/scripts/create_variants.py', { stdio: 'inherit' });

    if (!fs.existsSync(DEMO_DIR)) fs.mkdirSync(DEMO_DIR, { recursive: true });

    const variantFiles = fs.readdirSync(VARIANT_DIR).filter(f => f.endsWith('.jpg'));
    
    console.log("2. Injecting GPS and Organizing Demo Suite...");
    
    LOCATIONS.forEach((loc, index) => {
        const baseName = `img${index}`;
        const originalPath = path.join(VARIANT_DIR, `${baseName}_original.jpg`);
        const fixedPath = path.join(VARIANT_DIR, `${baseName}_fixed.jpg`);
        const identicalPath = path.join(VARIANT_DIR, `${baseName}_identical.jpg`);

        if (!fs.existsSync(originalPath)) return;

        // Case 1: Citizen Before (Success)
        injectMetadata(originalPath, path.join(DEMO_DIR, `${loc.name}_Citizen_BEFORE.jpg`), loc.lat, loc.lon, false);

        // Case 2: Officer Fail - No Change (AI Score ~1.0)
        injectMetadata(identicalPath, path.join(DEMO_DIR, `${loc.name}_Officer_FAIL_NoChange.jpg`), loc.lat, loc.lon, true);

        // Case 3: Officer Fail - Wrong GPS (EXIF Mismatch)
        // We use a distant location (New Delhi) for this one
        injectMetadata(fixedPath, path.join(DEMO_DIR, `${loc.name}_Officer_FAIL_WrongGPS.jpg`), 28.6139, 77.2090, true);

        // Case 4: Officer Pass - Success
        injectMetadata(fixedPath, path.join(DEMO_DIR, `${loc.name}_Officer_PASS_Success.jpg`), loc.lat, loc.lon, true);

        console.log(`✅ Processed Suite for ${loc.name}`);
    });

    console.log("\n🚀 Demo Suite is ready in 'images/demo_suite/'");
}

run();
