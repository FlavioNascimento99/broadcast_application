const defaultOrigins = ['http://localhost:3001', 'http://127.0.0.1:3001'];

export const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
  : defaultOrigins;
