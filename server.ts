import express from 'express';
import cors from 'cors';
import { MongoClient, Db, ObjectId } from 'mongodb';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'prizes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `prize-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

const MONGODB_URI = process.env.MONGODB_URI || '';
let cachedDb: Db | null = null;

async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedDb = client.db('lucky-dice');
  return cachedDb;
}

const DEFAULT_PRIZES = [
  { id: 1, name: 'Gold Trophy', description: 'A shiny gold trophy', icon: '🏆', inventory: 10 },
  { id: 2, name: 'Silver Medal', description: 'A prestigious silver medal', icon: '🥈', inventory: 15 },
  { id: 3, name: 'Bronze Star', description: 'A bronze star award', icon: '⭐', inventory: 20 },
  { id: 4, name: 'Gift Card', description: '$50 gift card', icon: '🎁', inventory: 25 },
  { id: 5, name: 'Mystery Box', description: 'What could be inside?', icon: '📦', inventory: 30 },
  { id: 6, name: 'Lucky Charm', description: 'A lucky charm for good fortune', icon: '🍀', inventory: 50 },
];

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// GET /api/prizes
app.get('/api/prizes', async (req, res) => {
  try {
    const db = await getDb();
    const collection = db.collection('prizes');
    
    const count = await collection.countDocuments();
    if (count === 0) {
      const now = new Date();
      const prizes = DEFAULT_PRIZES.map(p => ({ ...p, createdAt: now, updatedAt: now }));
      await collection.insertMany(prizes);
    }

    const prizes = await collection.find({}).sort({ id: 1 }).toArray();
    const availableFaces = prizes.filter(p => p.inventory > 0).map(p => p.id);

    res.json({ prizes, availableFaces });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/prizes/:id
app.put('/api/prizes/:id', async (req, res) => {
  try {
    const prizeId = parseInt(req.params.id);
    const { name, description, icon, inventory } = req.body;
    
    const db = await getDb();
    const collection = db.collection('prizes');
    
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (inventory !== undefined) updates.inventory = Math.max(0, inventory);

    const result = await collection.findOneAndUpdate(
      { id: prizeId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Prize not found' });
    res.json({ success: true, prize: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/prizes/reset
app.post('/api/prizes/reset', async (req, res) => {
  try {
    const db = await getDb();
    const collection = db.collection('prizes');
    const now = new Date();

    for (const prize of DEFAULT_PRIZES) {
      await collection.updateOne(
        { id: prize.id },
        { $set: { ...prize, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
    }

    const prizes = await collection.find({}).sort({ id: 1 }).toArray();
    res.json({ success: true, prizes });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/roll
app.post('/api/roll', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email', code: 'INVALID_EMAIL' });
    }

    const db = await getDb();
    const prizesCollection = db.collection('prizes');
    const entriesCollection = db.collection('entries');

    // Check if email has already been used (confirmed entries only)
    const existingEntry = await entriesCollection.findOne({ 
      email: email.toLowerCase().trim(), 
      status: 'confirmed' 
    });
    if (existingEntry) {
      return res.status(400).json({ 
        success: false, 
        error: 'This email has already been used to roll. Each participant can only roll once.', 
        code: 'EMAIL_ALREADY_USED' 
      });
    }

    const availablePrizes = await prizesCollection.find({ inventory: { $gt: 0 } }).toArray();
    if (availablePrizes.length === 0) {
      return res.status(400).json({ success: false, error: 'No prizes available', code: 'NO_INVENTORY' });
    }

    const selectedPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    
    const updateResult = await prizesCollection.findOneAndUpdate(
      { id: selectedPrize.id, inventory: { $gt: 0 } },
      { $inc: { inventory: -1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      return res.status(409).json({ success: false, error: 'Inventory conflict', code: 'CONFLICT' });
    }

    const now = new Date();
    const entry = {
      email: email.toLowerCase().trim(),
      prizeId: selectedPrize.id,
      prizeName: selectedPrize.name,
      prizeIcon: selectedPrize.icon,
      collected: false,
      status: 'reserved',
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await entriesCollection.insertOne(entry);

    res.json({
      success: true,
      entryId: insertResult.insertedId.toString(),
      winningFace: selectedPrize.id,
      prize: { id: selectedPrize.id, name: selectedPrize.name, description: selectedPrize.description, icon: selectedPrize.icon },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'DB_ERROR' });
  }
});

// POST /api/roll/confirm
app.post('/api/roll/confirm', async (req, res) => {
  try {
    const { entryId } = req.body;
    if (!entryId || !ObjectId.isValid(entryId)) {
      return res.status(400).json({ success: false, error: 'Invalid entry ID' });
    }

    const db = await getDb();
    const result = await db.collection('entries').findOneAndUpdate(
      { _id: new ObjectId(entryId), status: 'reserved' },
      { $set: { status: 'confirmed', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ success: false, error: 'Entry not found or already confirmed' });
    res.json({ success: true, entry: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/roll/release
app.post('/api/roll/release', async (req, res) => {
  try {
    const { entryId } = req.body;
    if (!entryId || !ObjectId.isValid(entryId)) {
      return res.status(400).json({ success: false, error: 'Invalid entry ID' });
    }

    const db = await getDb();
    const entry = await db.collection('entries').findOne({ _id: new ObjectId(entryId), status: 'reserved' });
    
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found or not reserved' });

    await db.collection('entries').updateOne(
      { _id: new ObjectId(entryId) },
      { $set: { status: 'released', updatedAt: new Date() } }
    );

    await db.collection('prizes').updateOne(
      { id: entry.prizeId },
      { $inc: { inventory: 1 }, $set: { updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Entry released' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/entries
app.get('/api/entries', async (req, res) => {
  try {
    const db = await getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string || 'all';
    const search = (req.query.search as string || '').trim();

    const query: any = { status: 'confirmed' };
    if (status === 'collected') query.collected = true;
    else if (status === 'pending') query.collected = false;
    if (search) query.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const total = await db.collection('entries').countDocuments(query);
    const entries = await db.collection('entries')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    res.json({
      entries: entries.map(e => ({ ...e, _id: e._id.toString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/entries/:id
app.patch('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { collected } = req.body;
    
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid entry ID' });

    const db = await getDb();
    const result = await db.collection('entries').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { collected, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, entry: { ...result, _id: result._id.toString() } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    const db = await getDb();
    const [totalRolls, collected, prizes] = await Promise.all([
      db.collection('entries').countDocuments({ status: 'confirmed' }),
      db.collection('entries').countDocuments({ status: 'confirmed', collected: true }),
      db.collection('prizes').find({}).sort({ id: 1 }).toArray(),
    ]);

    const distribution = await db.collection('entries').aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$prizeId', count: { $sum: 1 } } },
    ]).toArray();

    const prizeDistribution = prizes.map(p => ({
      prizeId: p.id,
      name: p.name,
      icon: p.icon,
      count: distribution.find(d => d._id === p.id)?.count || 0,
      inventory: p.inventory,
    }));

    res.json({ totalRolls, collected, pending: totalRolls - collected, prizeDistribution });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/upload - Upload prize images
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const url = `/prizes/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
