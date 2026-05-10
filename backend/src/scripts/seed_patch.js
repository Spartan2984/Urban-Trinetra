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
    const result = await cloudinary.uploader.upload(filePath, { 
        folder: 'fixcity_demo/demo_suite',
        transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }]
    });
    console.log(`  Done.`);
    return { url: result.secure_url, public_id: result.public_id };
}

async function patch() {
    try {
        await connectDb();
        
        const citizen = await User.findOne({ role: 'citizen' });
        const officer = await User.findOne({ role: 'officer' });
        const depts = await Department.find();

        // --- PENDING_AUDIT: Juhu Beach Vetoed ---
        console.log("Creating PENDING_AUDIT complaint (Juhu Beach)...");
        const juhuBefore = await upload('JuhuBeach_Citizen_BEFORE.jpg');
        const juhuAfter = await upload('JuhuBeach_Officer_PASS_Success.jpg');
        const auditors = await User.find({ role: 'citizen', _id: { $ne: citizen._id } }).limit(3);

        await Complaint.create({
            complaintId: `FMC-DEMO-${Date.now()}-AUDT`,
            citizen: citizen._id,
            category: 'streetlight',
            title: 'Non-functional Streetlights at Juhu Beach',
            description: 'Entire stretch is dark after 7 PM. Several near-accident reports this week.',
            location: { address: 'Juhu Beach, Mumbai', coordinates: { type: 'Point', coordinates: [72.8263, 19.1075] } },
            images: [juhuBefore],
            resolutionImages: [juhuAfter],
            department: depts.length > 3 ? depts[3]._id : depts[0]._id,
            assignedTo: officer._id,
            status: 'PENDING_AUDIT',
            vetoed: true,
            vetoCount: 1,
            priorityHint: 'urgent',
            aiVerification: { score: 0.78, verified: true, message: 'Background context matches. Visual fix detected.' },
            auditors: auditors.map(a => ({ 
                auditor: a._id, 
                assignedAt: new Date(), 
                dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000) 
            })),
            dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // slightly overdue for drama
            completionRequestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        });
        console.log("- PENDING_AUDIT complaint created.");

        // --- CLOSED: Worli Sea Face (Success Story) ---
        console.log("Creating CLOSED complaint (Dadar)...");
        const dadarBefore = await upload('DadarChowpatty_Citizen_BEFORE.jpg');
        const dadarAfter = await upload('DadarChowpatty_Officer_PASS_Success.jpg');

        await Complaint.create({
            complaintId: `FMC-DEMO-${Date.now() + 1}-CLSD`,
            citizen: citizen._id,
            category: 'drainage',
            title: 'Clogged Drain at Dadar Chowpatty',
            description: 'Drain completely blocked causing flooding during rain.',
            location: { address: 'Dadar Chowpatty, Mumbai', coordinates: { type: 'Point', coordinates: [72.8360, 19.0250] } },
            images: [dadarBefore],
            resolutionImages: [dadarAfter],
            department: depts[0]._id,
            assignedTo: officer._id,
            status: 'CLOSED',
            priorityHint: 'high',
            aiVerification: { score: 0.81, verified: true, message: 'Background context matches. Visual fix detected.' },
            dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
            closedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        });
        console.log("- CLOSED complaint created.");

        console.log("\n✅ Patch complete. Database now has full demo scenarios.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Patch failed:", err.message);
        process.exit(1);
    }
}

patch();
