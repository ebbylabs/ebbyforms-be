import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { sequelize } from './db.js';
import { User } from './models/User.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Attach Clerk auth context to every request.
app.use(clerkMiddleware());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected endpoint: returns the DB record for the signed-in Clerk user.
// On first login the user is upserted/linked to their record via clerkId.
app.get('/api/me', async (req, res) => {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let user = await User.findOne({ where: { clerkId: userId } });

    // Link a legacy in-site registration (matched by email) to this Clerk login.
    if (!user && sessionClaims?.email) {
      const legacy = await User.findOne({ where: { email: sessionClaims.email } });
      if (legacy) {
        legacy.clerkId = userId;
        await legacy.save();
        user = legacy;
      }
    }

    // First Clerk login with no matching record: create one.
    if (!user) {
      user = await User.create({
        clerkId: userId,
        email: sessionClaims?.email ?? null,
        firstName: sessionClaims?.firstName ?? null,
        lastName: sessionClaims?.lastName ?? null,
        imageUrl: sessionClaims?.imageUrl ?? null
      });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

try {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Database connected, schema synced.');
} catch (err) {
  console.error('Unable to connect to the database:', err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`formic-server listening on http://localhost:${PORT}`);
});
