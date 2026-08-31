import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth';
import uploadRouter from './routes/upload';
import loansRouter from './routes/loans';
import exceptionsRouter from './routes/exceptions';
import aiRouter from './routes/ai';
import verifiedRouter from './routes/verified';
import auditRouter from './routes/audit';
import summaryRouter from './routes/summary';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Routes
app.use('/auth', authRouter);
app.use('/upload', uploadRouter);
app.use('/loans', loansRouter);
app.use('/exceptions', exceptionsRouter);
app.use('/ai', aiRouter);
app.use('/verified-loans', verifiedRouter);
app.use('/audit', auditRouter);
app.use('/summary', summaryRouter);

// 404 + error handlers
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Loan Verification API running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL}`);
  console.log(`🤖 AI: ${process.env.ANTHROPIC_API_KEY?.includes('your-key') ? '⚠️  Mock mode (no API key)' : '✅ Anthropic connected'}`);
});

export default app;
