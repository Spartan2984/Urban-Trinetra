import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Complaint } from '../models/Complaint.js';
import { User } from '../models/User.js';

async function wipe() {
    try {
        await connectDb();
        console.log("Connected to Database.");

        console.log("Wiping all complaints...");
        await Complaint.deleteMany({});
        
        console.log("Resetting Officer active task counts...");
        await User.updateMany(
            { role: 'officer' },
            { $set: { activeTaskCount: 0 } }
        );

        console.log("✅ Database Wiped. Ready for a clean demo.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Wipe failed:", err.message);
        process.exit(1);
    }
}

wipe();
