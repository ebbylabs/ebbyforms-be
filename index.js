import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { clerkMiddleware } from '@clerk/express';
import { sequelize } from './db.js';
import { openapiSpec } from './openapi.js';
import { requireRole, requireUser, sanitizeUser } from './middleware/auth.js';
import internalRoutes from './routes/internal.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Attach Clerk auth context to every request (validates the session token).
app.use(clerkMiddleware());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Interactive API docs (Swagger UI) + raw OpenAPI spec.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get('/api-docs.json', (_req, res) => res.json(openapiSpec));

// Protected endpoint: returns the profile for the signed-in Clerk user,
// creating it from the session claims on the user's first request.
app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// Internal (staff) portal — Clerk-signed-in AND role=internal only.
app.use('/api/internal', requireUser, requireRole('internal'), internalRoutes);

try {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Database connected, schema synced.');
} catch (err) {
  console.error('Unable to connect to the database:', err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`ebbyforms-server listening on http://localhost:${PORT}`);
});
