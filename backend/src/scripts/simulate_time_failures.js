import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Complaint } from '../models/Complaint.js';

async function simulate() {
    try {
        await connectDb();
        const now = new Date();
        const pastDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

        console.log("Simulating SLA Breaches (Officers)...");
        const overdueResult = await Complaint.updateMany(
            { status: 'IN_PROGRESS' },
            { $set: { dueAt: pastDate } }
        );
        console.log(`- Flagged ${overdueResult.modifiedCount} tasks as Overdue.`);

        console.log("Simulating Late Audits (Citizens)...");
        // We find all complaints with auditors and set their individual due dates to the past
        const audits = await Complaint.find({ status: 'PENDING_AUDIT' });
        let auditorCount = 0;
        
        for (const comp of audits) {
            comp.auditors.forEach(a => {
                if (!a.vote) {
                    a.dueDate = pastDate;
                    auditorCount++;
                }
            });
            await comp.save();
        }
        console.log(`- Flagged ${auditorCount} auditor assignments as Tardy.`);

        console.log("✅ Time-warp complete. Refresh your dashboard to see the impact.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Simulation failed:", err.message);
        process.exit(1);
    }
}

simulate();
