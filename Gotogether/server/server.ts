if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore if .env is missing or already loaded
  }
}

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Server } from 'socket.io';
import { matchesRouter } from './routes/matches';
import { listingsRouter } from './routes/listings';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { conversationsRouter } from './routes/conversations';
import { registerChatHandlers } from './sockets/chatSocket';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api', matchesRouter);
app.use('/api', listingsRouter);

// Serve Vite production build when deployed
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));

  // Send index.html for any non-API route (React Router support)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

registerChatHandlers(io);

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 4000;

httpServer.listen(PORT, () => {
  console.log(`GoTogether API + Socket.IO listening on port ${PORT}`);
});
