import "dotenv/config";

import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { getEventService } from "./services/EventService";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Create HTTP server with Express app
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

// Attach io instance to app for route access
app.locals.io = io;

// Initialize Event Service
const eventService = getEventService();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Send current middleware status to newly connected client
  if (eventService.isConnected()) {
    console.log(`[Socket.IO] Sending middleware status to client ${socket.id}: connected`);
    socket.emit('system:middleware-connected');
  } else {
    console.log(`[Socket.IO] Sending middleware status to client ${socket.id}: disconnected`);
    socket.emit('system:middleware-disconnected');
  }

  // Subscribe to events when client connects
  socket.on('subscribe:posts', async () => {
    console.log(`[Socket.IO] Client ${socket.id} subscribed to posts`);
    socket.join('posts');
    try {
      await eventService.subscribeToPostCreated();
    } catch (err) {
      console.error('[Socket.IO] Error subscribing to posts:', err);
    }
  });

  socket.on('subscribe:topics', async () => {
    console.log(`[Socket.IO] Client ${socket.id} subscribed to topics`);
    socket.join('topics');
    try {
      await eventService.subscribeToTopicCreated();
    } catch (err) {
      console.error('[Socket.IO] Error subscribing to topics:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Listen for events from EventService and broadcast to clients
eventService.on('event', (event) => {
  console.log(`[Index] Broadcasting event: ${event.topic}`);
  if (event.topic === 'post_created') {
    io.to('posts').emit('post:created', event.data);
  } else if (event.topic === 'topic_created') {
    io.to('topics').emit('topic:created', event.data);
  }
});

eventService.on('middleware:connected', () => {
  console.log('[Index] Middleware connected');
  io.emit('system:middleware-connected');
});

eventService.on('middleware:disconnected', () => {
  console.log('[Index] Middleware disconnected');
  io.emit('system:middleware-disconnected');
});

// Initialize event service
eventService.initialize()
  .then(() => {
    console.log('[Index] Event service initialized');
  })
  .catch((err) => {
    console.error('[Index] Failed to initialize event service:', err);
    console.log('[Index] Continuing without middleware...');
  });

// Start server
server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
