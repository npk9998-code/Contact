require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const { errorHandler } = require('./middleware/errorHandler');

const authRouter  = require('./modules/auth/auth.router');
const linesRouter = require('./modules/lines/lines.router');

const app = express();

// ─── Security ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Line-ID'],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'طلبات كثيرة جداً، حاول مرة أخرى بعد قليل' },
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة
  max: 5,
  message: { error: 'عدد كبير من طلبات رمز التحقق، حاول بعد ساعة' },
  keyGenerator: (req) => req.body?.phone || req.ip,
});

app.use('/api', globalLimiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
}

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth/login',       otpLimiter);
app.use('/api/auth/resend-otp',  otpLimiter);
app.use('/api/auth', authRouter);
app.use('/api/lines', linesRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ error: 'المسار غير موجود' });
});

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🚀 Hatif Backend (v1: Auth + Lines) running on port ${PORT}`);
  logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
