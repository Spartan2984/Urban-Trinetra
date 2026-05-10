import { connectDb } from './config/db.js';
import { Department } from './models/Department.js';
import { User } from './models/User.js';
import { Complaint } from './models/Complaint.js';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { env } from './config/env.js';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret
});

const departments = [
  { name: 'Roads and Transport', code: 'ROADS', description: 'Potholes, road damage, and street infrastructure' },
  { name: 'Water Works', code: 'WATER', description: 'Water leakage and sewage overflow' },
  { name: 'Sanitation', code: 'SAN', description: 'Garbage, drainage, and public sanitation' },
  { name: 'Electrical', code: 'ELEC', description: 'Streetlight and electrical infrastructure' },
  { name: 'Parks', code: 'PARKS', description: 'Park maintenance issues' }
];

const run = async () => {
  await connectDb();
  
  console.log('Dropping existing database...');
  await mongoose.connection.dropDatabase();
  console.log('Database dropped.');

  // 1. Upload Images
  const imgDir = path.resolve('../imgs');
  const imgFiles = fs.readdirSync(imgDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
  const uploadedImages = [];

  console.log(`Uploading ${imgFiles.length} images to Cloudinary...`);
  for (const file of imgFiles) {
    const result = await cloudinary.uploader.upload(path.join(imgDir, file), {
      folder: 'fixcity_demo/profiles'
    });
    uploadedImages.push({ url: result.secure_url, public_id: result.public_id });
  }

  // 2. Create Departments
  const createdDepartments = [];
  for (const dept of departments) {
    const d = await Department.create(dept);
    createdDepartments.push(d);
  }

  // 3. Create Staff
  const staff = [];
  
  // Admin
  const admin = new User({
    name: 'Chief Administrator',
    email: 'admin@fixmycity.local',
    role: 'admin',
    phone: '9876543210'
  });
  await admin.setPassword('AdminPass123');
  await admin.save();

  // Supervisors (1 per dept)
  for (let i = 0; i < 5; i++) {
    const sup = new User({
      name: `Supervisor ${i + 1}`,
      email: `supervisor${i + 1}@fixmycity.local`,
      role: 'supervisor',
      department: createdDepartments[i]._id,
      phone: `900000000${i}`,
      profileImage: uploadedImages[i % uploadedImages.length],
      reputationScore: 100 + (Math.random() * 50 - 25)
    });
    await sup.setPassword('StaffPass123');
    await sup.save();
    staff.push(sup);
  }

  // Officers (2 per dept)
  for (let i = 0; i < 10; i++) {
    const deptIdx = Math.floor(i / 2);
    const off = new User({
      name: `Officer ${i + 1}`,
      email: `officer${i + 1}@fixmycity.local`,
      role: 'officer',
      department: createdDepartments[deptIdx]._id,
      phone: `800000000${i}`,
      profileImage: uploadedImages[(i + 5) % uploadedImages.length],
      reputationScore: 100 + (Math.random() * 100 - 60) // Some will be on loserboard
    });
    await off.setPassword('StaffPass123');
    await off.save();
    staff.push(off);
  }

  // 4. Citizens (20)
  const citizens = [];
  for (let i = 0; i < 20; i++) {
    const cit = new User({
      name: `Citizen User ${i + 1}`,
      email: `citizen${i + 1}@example.com`,
      role: 'citizen',
      phone: `700000000${i}`,
      reputationScore: 100 + (Math.random() * 200 - 50) // Some high auditors, some low
    });
    await cit.setPassword('UserPass123');
    await cit.save();
    citizens.push(cit);
  }

  // 5. Complaints (40)
  const statuses = ['NEW', 'ALLOCATED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_COMPLETION', 'PENDING_VERIFICATION', 'PENDING_AUDIT', 'CLOSED', 'REJECTED', 'ESCALATED'];
  const categories = ['pothole', 'garbage', 'water_leakage', 'streetlight', 'drainage', 'sanitation', 'road_damage'];

  console.log('Creating 40 complaints...');
  for (let i = 0; i < 40; i++) {
    const citizen = citizens[Math.floor(Math.random() * citizens.length)];
    const dept = createdDepartments[Math.floor(Math.random() * createdDepartments.length)];
    const status = statuses[i % statuses.length];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    const complaint = new Complaint({
      complaintId: `COMP-${1000 + i}`,
      title: `${category.replace('_', ' ')} near Sector ${i % 10}`,
      description: `Detailed report of ${category.replace('_', ' ')} that needs immediate attention. This is a seeded demo complaint for verification.`,
      category,
      citizen: citizen._id,
      department: dept._id,
      status,
      location: {
        address: `${100 + i} Main St, City Central`,
        coordinates: { type: 'Point', coordinates: [77.1025 + (Math.random() * 0.1), 28.7041 + (Math.random() * 0.1)] }
      },
      images: [{ url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80', public_id: 'seed/1' }],
      dueAt: new Date(Date.now() + (Math.random() * 10 - 5) * 24 * 60 * 60 * 1000)
    });

    if (status !== 'NEW') {
      const officer = staff.filter(s => s.role === 'officer' && s.department.equals(dept._id))[0];
      if (officer) complaint.assignedTo = officer._id;
    }

    if (status === 'PENDING_AUDIT') {
      complaint.vetoed = true;
      complaint.auditors = citizens.slice(0, 3).map(c => ({
        auditor: c._id,
        stakedPoints: 10,
        assignedAt: new Date(),
        dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000)
      }));
    }

    complaint.statusHistory.push({
      status: 'SUBMITTED',
      note: 'Complaint registered by citizen',
      changedBy: citizen._id
    });

    await complaint.save();
  }

  console.log('Seed complete');
  console.log('Admin login: admin@fixmycity.local / AdminPass123');
  console.log('Officer login: officer1@fixmycity.local / StaffPass123');
  console.log('Citizen login: citizen1@example.com / UserPass123');
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
