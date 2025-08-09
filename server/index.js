const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Optional: simple health route
app.get('/', (req, res) => res.send('Realtime Whiteboard Server is running'));

io.on('connection', socket => {
  console.log('client connected', socket.id);

  // join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined ${roomId}`);
  });

  // broadcast drawing data to room (other clients)
  socket.on('draw', ({ roomId, line }) => {
    socket.to(roomId).emit('draw', line);
  });

  // clear board
  socket.on('clear-board', (roomId) => {
    socket.to(roomId).emit('clear-board');
  });

  // optional: sync full canvas image (e.g., for late joiners)
  socket.on('full-image', ({ roomId, dataUrl }) => {
    socket.to(roomId).emit('full-image', dataUrl);
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
