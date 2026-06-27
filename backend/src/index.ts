import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/migrations.js';
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';

// ----------------------------------------------------------------
// Bootstrap DB
// ----------------------------------------------------------------
initDatabase();

// ----------------------------------------------------------------
// App
// ----------------------------------------------------------------
const app = express();
const PORT = process.env.PORT ?? 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

// ----------------------------------------------------------------
// Global middleware
// ----------------------------------------------------------------
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);

// ----------------------------------------------------------------
// 404 fallback
// ----------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
});

// ----------------------------------------------------------------
// Global error handler
// ----------------------------------------------------------------
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
  });
});

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   CORS origin: ${CORS_ORIGIN}`);
});

export default app;
