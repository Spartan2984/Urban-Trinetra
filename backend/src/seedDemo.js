import { connectDb } from './config/db.js';
import { AuditLog } from './models/AuditLog.js';
import { Complaint, CATEGORY_SLA_HOURS } from './models/Complaint.js';
import { Department } from './models/Department.js';
import { ForumComment } from './models/ForumComment.js';
import { ForumTopic } from './models/ForumTopic.js';
import { Notification } from './models/Notification.js';
import { User } from './models/User.js';

const password = 'DemoPass123';

const departments = [
  { name: 'Roads and Transport', code: 'ROADS', description: 'Potholes, road damage, and street infrastructure' },
  { name: 'Water Works', code: 'WATER', description: 'Water leakage and sewage overflow' },
  { name: 'Sanitation', code: 'SAN', description: 'Garbage, drainage, and public sanitation' },
  { name: 'Electrical', code: 'ELEC', description: 'Streetlight and electrical infrastructure' },
  { name: 'Parks', code: 'PARKS', description: 'Park maintenance issues' }
];

const people = [
  { name: 'Meera Supervisor', email: 'supervisor@fixmycity.local', phone: '9000000001', role: 'supervisor', department: 'ROADS' },
  { name: 'Ravi Roads Officer', email: 'roads.officer@fixmycity.local', phone: '9000000002', role: 'officer', department: 'ROADS' },
  { name: 'Nisha Water Officer', email: 'water.officer@fixmycity.local', phone: '9000000003', role: 'officer', department: 'WATER' },
  { name: 'Imran Sanitation Officer', email: 'sanitation.officer@fixmycity.local', phone: '9000000004', role: 'officer', department: 'SAN' },
  { name: 'Asha Citizen', email: 'asha@example.com', phone: '9876543210', role: 'citizen' },
  { name: 'Vikram Citizen', email: 'vikram@example.com', phone: '9876543211', role: 'citizen' },
  { name: 'Priya Citizen', email: 'priya@example.com', phone: '9876543212', role: 'citizen' },
  { name: 'Daniel Citizen', email: 'daniel@example.com', phone: '9876543213', role: 'citizen' }
];

const demoComplaints = [
  {
    title: 'Large pothole outside school gate',
    category: 'pothole',
    citizen: 'asha@example.com',
    department: 'ROADS',
    officer: 'roads.officer@fixmycity.local',
    status: 'IN_PROGRESS',
    priorityHint: 'high',
    address: 'Government High School Gate, MG Road',
    description: 'A large pothole has formed outside the school gate and vehicles swerve suddenly during morning traffic.',
    createdDaysAgo: 5,
    dueHoursFromNow: 18,
    comments: ['This stretch gets dangerous when buses stop here.', 'Roads team has inspected the spot and work is ongoing.']
  },
  {
    title: 'Streetlight not working near park entrance',
    category: 'streetlight',
    citizen: 'vikram@example.com',
    department: 'ELEC',
    status: 'SUBMITTED',
    priorityHint: 'medium',
    address: 'Lake View Park Main Entrance',
    description: 'The streetlight near the park entrance has not worked for several nights, making the walkway unsafe.',
    createdDaysAgo: 1,
    dueHoursFromNow: 42,
    comments: ['Several evening walkers have noticed this too.', 'Please fix before the weekend footfall increases.']
  },
  {
    title: 'Water leakage from main pipeline',
    category: 'water_leakage',
    citizen: 'priya@example.com',
    department: 'WATER',
    officer: 'water.officer@fixmycity.local',
    status: 'ALLOCATED',
    priorityHint: 'urgent',
    address: '12th Cross, Indiranagar',
    description: 'Water has been leaking continuously from the main pipeline and the road is becoming slippery.',
    createdDaysAgo: 2,
    dueHoursFromNow: 10,
    comments: ['The leakage is wasting a lot of water.', 'Allocated to Water Works for urgent action.']
  },
  {
    title: 'Garbage not collected for four days',
    category: 'garbage',
    citizen: 'daniel@example.com',
    department: 'SAN',
    officer: 'sanitation.officer@fixmycity.local',
    status: 'PENDING_COMPLETION',
    priorityHint: 'high',
    address: 'Market Road, Ward 14',
    description: 'Garbage bins around the market have overflowed and waste has spilled onto the footpath.',
    createdDaysAgo: 4,
    dueHoursFromNow: -8,
    comments: ['Smell is becoming unbearable near the shops.', 'Cleanup proof has been submitted for supervisor review.']
  },
  {
    title: 'Drain blocked after heavy rain',
    category: 'drainage',
    citizen: 'asha@example.com',
    department: 'SAN',
    officer: 'sanitation.officer@fixmycity.local',
    status: 'CLOSED',
    priorityHint: 'medium',
    address: '3rd Main, Koramangala',
    description: 'The roadside drain was blocked after heavy rain and water was collecting near residential entrances.',
    createdDaysAgo: 14,
    dueHoursFromNow: -240,
    completedInTime: true,
    comments: ['The drain was cleared and water flow is normal now.', 'Thanks for the quick resolution.']
  },
  {
    title: 'Sewage overflow behind apartment block',
    category: 'sewage_overflow',
    citizen: 'vikram@example.com',
    department: 'WATER',
    officer: 'water.officer@fixmycity.local',
    status: 'CLOSED',
    priorityHint: 'urgent',
    address: 'Palm Residency Back Lane',
    description: 'Sewage overflow has been reported behind the apartment block and residents are concerned about sanitation.',
    createdDaysAgo: 12,
    dueHoursFromNow: -180,
    completedInTime: false,
    comments: ['This was resolved but took longer than expected.', 'Residents want preventive maintenance scheduled.']
  },
  {
    title: 'Broken bench and damaged pathway in park',
    category: 'park_maintenance',
    citizen: 'priya@example.com',
    department: 'PARKS',
    status: 'REJECTED',
    priorityHint: 'low',
    address: 'Central Park Children Area',
    description: 'A bench is broken and one pathway tile is loose near the children play area.',
    createdDaysAgo: 7,
    dueHoursFromNow: -20,
    comments: ['This was rejected as duplicate of a maintenance work order.', 'Citizens still want a public update.']
  },
  {
    title: 'Illegal construction blocking footpath',
    category: 'illegal_construction',
    citizen: 'daniel@example.com',
    department: 'ROADS',
    status: 'ESCALATED',
    priorityHint: 'urgent',
    address: 'Old Airport Road Service Lane',
    description: 'Temporary construction materials are blocking the footpath and pedestrians are forced onto the road.',
    createdDaysAgo: 8,
    dueHoursFromNow: -12,
    comments: ['This needs enforcement action soon.', 'Escalated because the obstruction remains unresolved.']
  }
];

const standaloneTopics = [
  {
    title: 'Weekend cleanliness drive near the lake',
    body: 'Several residents want to organize a weekend cleanliness drive near the lake trail. Staff suggestions are welcome.',
    author: 'asha@example.com',
    comments: ['Sanitation staff can help coordinate waste pickup after the drive.', 'I can bring volunteers from my apartment block.']
  },
  {
    title: 'Which streets need better night lighting?',
    body: 'Please list streets where poor lighting causes safety issues so the electrical department can inspect priorities.',
    author: 'supervisor@fixmycity.local',
    comments: ['Lake View Park road should be on the list.', 'The bus stop near 12th Cross is also very dark.']
  }
];

const locationFor = (index) => [77.55 + index * 0.012, 12.92 + index * 0.01];

const upsertUser = async (person, departmentMap) => {
  let user = await User.findOne({ email: person.email });
  if (!user) user = new User({ email: person.email });

  user.name = person.name;
  user.phone = person.phone;
  user.role = person.role;
  user.department = person.department ? departmentMap[person.department]._id : null;
  user.isActive = true;
  await user.setPassword(password);
  await user.save();
  return user;
};

const image = (name) => ({
  url: `https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?auto=format&fit=crop&w=900&q=80&demo=${name}`,
  filename: `${name}.jpg`,
  mimetype: 'image/jpeg',
  size: 128000
});

const seedVotes = (users, offset = 0) => {
  const voters = users.slice(offset, offset + 5);
  return voters.map((user, index) => ({ user: user._id, value: index === 4 ? -1 : 1 }));
};

const run = async () => {
  await connectDb();

  const departmentMap = {};
  for (const department of departments) {
    departmentMap[department.code] = await Department.findOneAndUpdate({ code: department.code }, department, { upsert: true, new: true });
  }

  const usersByEmail = {};
  for (const person of people) {
    usersByEmail[person.email] = await upsertUser(person, departmentMap);
  }
  const allDemoUsers = Object.values(usersByEmail);

  const demoUserIds = allDemoUsers.map((user) => user._id);
  await ForumComment.deleteMany({ author: { $in: demoUserIds } });
  await ForumTopic.deleteMany({ author: { $in: demoUserIds } });
  await Complaint.deleteMany({ citizen: { $in: demoUserIds } });
  await Notification.deleteMany({ user: { $in: demoUserIds } });
  await AuditLog.deleteMany({ actor: { $in: demoUserIds } });

  const createdComplaints = [];
  for (const [index, item] of demoComplaints.entries()) {
    const citizen = usersByEmail[item.citizen];
    const officer = item.officer ? usersByEmail[item.officer] : null;
    const department = departmentMap[item.department];
    const createdAt = new Date(Date.now() - item.createdDaysAgo * 24 * 60 * 60 * 1000);
    const dueAt = new Date(Date.now() + item.dueHoursFromNow * 60 * 60 * 1000);
    const [longitude, latitude] = locationFor(index);
    const slaHours = CATEGORY_SLA_HOURS[item.category] || 72;
    const now = new Date();

    const complaint = await Complaint.create({
      citizen: citizen._id,
      category: item.category,
      title: item.title,
      description: item.description,
      priorityHint: item.priorityHint,
      contactName: citizen.name,
      contactPhone: citizen.phone,
      location: {
        address: item.address,
        coordinates: { type: 'Point', coordinates: [longitude, latitude] }
      },
      images: [image(`complaint-${index + 1}`)],
      department: department?._id,
      assignedTo: officer?._id,
      status: item.status,
      slaHours,
      dueAt,
      escalatedAt: item.status === 'ESCALATED' ? now : undefined,
      completionRequestedAt: item.status === 'PENDING_COMPLETION' ? now : undefined,
      completedInTime: item.completedInTime,
      resolvedAt: ['CLOSED', 'PENDING_COMPLETION'].includes(item.status) ? now : undefined,
      closedAt: item.status === 'CLOSED' ? now : undefined,
      resolutionImages: ['CLOSED', 'PENDING_COMPLETION'].includes(item.status) ? [image(`resolution-${index + 1}`)] : [],
      statusHistory: [
        { status: 'SUBMITTED', note: 'Complaint submitted by citizen', changedBy: citizen._id, changedAt: createdAt },
        ...(officer
          ? [{ status: 'ALLOCATED', note: `Allocated to ${officer.name}`, changedBy: usersByEmail['supervisor@fixmycity.local']._id, changedAt: createdAt }]
          : []),
        ...(item.status !== 'SUBMITTED' && item.status !== 'ALLOCATED'
          ? [{ status: item.status, note: `Demo status: ${item.status}`, changedBy: officer?._id || usersByEmail['supervisor@fixmycity.local']._id, changedAt: now }]
          : [])
      ],
      createdAt,
      updatedAt: now
    });

    const topicVotes = seedVotes(allDemoUsers, index % 3);
    const topic = await ForumTopic.create({
      title: item.title,
      body: item.description,
      author: citizen._id,
      relatedComplaint: complaint._id,
      votes: topicVotes,
      score: topicVotes.reduce((sum, vote) => sum + vote.value, 0),
      createdAt,
      updatedAt: now
    });

    complaint.forumTopic = topic._id;
    await complaint.save();

    for (const [commentIndex, body] of item.comments.entries()) {
      const author = allDemoUsers[(index + commentIndex + 1) % allDemoUsers.length];
      const votes = seedVotes(allDemoUsers, commentIndex);
      await ForumComment.create({
        topic: topic._id,
        author: author._id,
        body,
        votes,
        score: votes.reduce((sum, vote) => sum + vote.value, 0),
        createdAt: new Date(createdAt.getTime() + (commentIndex + 1) * 60 * 60 * 1000),
        updatedAt: now
      });
    }

    createdComplaints.push(complaint);
  }

  for (const [index, item] of standaloneTopics.entries()) {
    const author = usersByEmail[item.author];
    const votes = seedVotes(allDemoUsers, index + 1);
    const topic = await ForumTopic.create({
      title: item.title,
      body: item.body,
      author: author._id,
      votes,
      score: votes.reduce((sum, vote) => sum + vote.value, 0)
    });

    for (const [commentIndex, body] of item.comments.entries()) {
      const commentAuthor = allDemoUsers[(index + commentIndex + 2) % allDemoUsers.length];
      await ForumComment.create({
        topic: topic._id,
        author: commentAuthor._id,
        body,
        votes: seedVotes(allDemoUsers, commentIndex + 2),
        score: 3
      });
    }
  }

  await Notification.insertMany(
    createdComplaints.map((complaint) => ({
      user: complaint.citizen,
      type: 'demo_complaint_update',
      title: 'Complaint update',
      message: `Demo complaint ${complaint.complaintId} is currently ${complaint.status}.`,
      relatedComplaint: complaint._id
    }))
  );

  console.log('Demo seed complete');
  console.log(`Created/updated ${allDemoUsers.length} demo users`);
  console.log(`Created ${createdComplaints.length} demo complaints with linked forum topics`);
  console.log('Demo password for all seeded non-admin users: DemoPass123');
  console.log('Useful logins:');
  console.log('  supervisor@fixmycity.local / DemoPass123');
  console.log('  roads.officer@fixmycity.local / DemoPass123');
  console.log('  asha@example.com / DemoPass123');
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
