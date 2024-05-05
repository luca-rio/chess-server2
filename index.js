const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  }
});

// Store game rooms
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createGame', () => {
    const roomId = generateRoomId();
    if (rooms.has(roomId)) {
      socket.emit('gameError', 'Room already exists.');
      return;
    }
    rooms.set(roomId, { players: { white: socket.id, black: null }, gameState: 'waiting' });
    socket.join(roomId);
    socket.emit('gameCreated', { roomId, color: 'black' }); // Send assigned color to the client
  });

  socket.on('move', (move) => {
    console.log('move detected ')
    console.log(move)
    console.log(move.move)
    io.to(move.roomId).emit('newMove', move.move);
  });

  socket.on('joinGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('gameError', 'The game room does not exist.');
      return;
    }
    if (room.players.black !== null) {
      // Room is full, handle accordingly
      return;
    }
    // Assign the joining player to the black side if available, otherwise to white
    const color = room.players.black === null ? 'black' : 'white';
    room.players[color] = socket.id;
    socket.join(roomId);
    console.log(JSON.stringify(room));
    socket.emit('gameStarted', { roomId, color:'white' });
    room.gameState = 'inProgress'; // Update game state
    console.log(`Player joined room: ${roomId} as ${color}`);
  });
  
  

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    let roomId;
    rooms.forEach((room, id) => {
      if (room.players.white === socket.id || room.players.black === socket.id) { // Check if the player is in either role
        roomId = id;
        delete rooms[id]; // Remove the room from the map
      }
    });
    if (roomId) {
      io.to(roomId).emit('playerDisconnected');
    }
  });
});

// Generate a unique room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('/', (req, res) => {
  res.send("Hello world!");
});

module.exports.handler = serverless(app);