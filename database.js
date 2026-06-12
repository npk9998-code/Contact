const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
  errorFormat: 'minimal',
});

prisma.$connect()
  .then(() => logger.info('✅ Database connected'))
  .catch((err) => {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  });

module.exports = prisma;
