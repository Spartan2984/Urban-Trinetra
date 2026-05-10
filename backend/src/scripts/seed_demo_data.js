import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Complaint } from '../models/Complaint.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import path from 'path';
import fs from 'fs';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret
});

const DEMO_DIR = path.resolve('../images/demo_suite');

async function upload(filename) {
    console.log(`- Uploading ${filename}...`);
    const filePath = path.join(DEMO_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const result = await cloudinary.uploader.upload(filePath, { folder: 'fixcity_demo/demo_suite' });
    console.log(`  Done: ${result.secure_url}`);
    return { url: result.secure_url, public_id: result.public_id };
}

async function seed() {
    try {
        await connectDb();
        
        const citizen = await User.findOne({ role: 'citizen' });
        const officer = await User.findOne({ role: 'officer' });
        const supervisor = await User.findOne({ role: 'supervisor' });
        const depts = await Department.find();
        
        if (!citizen || !officer || !depts.length) {
            console.error("Missing base seed data (users/departments). Please run 'npm run seed' first.");
            process.exit(1);
        }

        console.log("Wiping existing complaints...");
        await Complaint.deleteMany({});
        await User.updateMany({ role: 'officer' }, { $set: { activeTaskCount: 0 } });

        console.log("Uploading Demo Suite images to Cloudinary (this may take a minute)...");
        
        // 1. NEW Complaint (Bandstand)
        const bandstandImg = await upload('Bandstand_Citizen_BEFORE.jpg');
        await Complaint.create({
            complaintId: `FMC-${new Date().getFullYear()}0501-NEW1`,
            citizen: citizen._id,
            category: 'pothole',
            title: 'Large Pothole near Bandstand Promenade',
            description: 'This pothole has been growing for weeks. Dangerous for bikers.',
            location: { address: 'Bandstand, Bandra West', coordinates: { type: 'Point', coordinates: [72.8185, 19.0433] } },
            images: [bandstandImg],
            department: depts[0]._id,
            status: 'NEW',
            priorityHint: 'high',
            dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        });

        // 2. IN_PROGRESS (Marine Drive)
        const marineImg = await upload('MarineDrive_Citizen_BEFORE.jpg');
        const marineComplaint = await Complaint.create({
            complaintId: `FMC-${new Date().getFullYear()}0501-PROC1`,
            citizen: citizen._id,
            category: 'road_damage',
            title: 'Damaged Pavement at Marine Drive',
            description: 'Pavement slabs are loose near the viewing gallery.',
            location: { address: 'Marine Drive, Mumbai', coordinates: { type: 'Point', coordinates: [72.8230, 18.9430] } },
            images: [marineImg],
            department: depts[0]._id,
            assignedTo: officer._id,
            status: 'IN_PROGRESS',
            priorityHint: 'medium',
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        await User.findByIdAndUpdate(officer._id, { $inc: { activeTaskCount: 1 } });

        // 3. PENDING_VERIFICATION (Gateway)
        const gatewayBefore = await upload('Gateway_Citizen_BEFORE.jpg');
        const gatewayAfter = await upload('Gateway_Officer_PASS_Success.jpg');
        await Complaint.create({
            complaintId: `FMC-${new Date().getFullYear()}0501-VERI1`,
            citizen: citizen._id,
            category: 'sanitation',
            title: 'Garbage Pile near Gateway of India',
            description: 'Overflowing bins attracting pests.',
            location: { address: 'Gateway of India, Colaba', coordinates: { type: 'Point', coordinates: [72.8347, 18.9220] } },
            images: [gatewayBefore],
            resolutionImages: [gatewayAfter],
            department: depts[2]._id,
            assignedTo: officer._id,
            status: 'PENDING_VERIFICATION',
            aiVerification: { score: 0.82, verified: true, message: 'Visual fix confirmed by AI.' },
            completionRequestedAt: new Date(),
            dueAt: new Date()
        });

        // 4. PENDING_AUDIT (Juhu Beach - Vetoed)
        const juhuBefore = await upload('JuhuBeach_Citizen_BEFORE.jpg');
        const juhuAfter = await upload('JuhuBeach_Officer_PASS_Success.jpg');
        const auditors = await User.find({ role: 'citizen', _id: { $ne: citizen._id } }).limit(3);
        
        await Complaint.create({
            complaintId: `FMC-${new Date().getFullYear()}0501-AUDT1`,
            citizen: citizen._id,
            category: 'streetlight',
            title: 'Non-functional Streetlights at Juhu Beach',
            description: 'Entire stretch is dark after 7 PM.',
            location: { address: 'Juhu Beach, Mumbai', coordinates: { type: 'Point', coordinates: [72.8263, 19.1075] } },
            images: [juhuBefore],
            resolutionImages: [juhuAfter],
            department: depts[3]._id,
            status: 'PENDING_AUDIT',
            vetoed: true,
            aiVerification: { score: 0.78, verified: true, message: 'Background matches.' },
            auditors: auditors.map(a => ({ auditor: a._id, assignedAt: new Date(), dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000) })),
            dueAt: new Date()
        });

        console.log("✅ Demo Seeding Complete. Dashboard is now populated with live test scenarios.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding failed:", err.message);
        process.exit(1);
    }
}

seed();
