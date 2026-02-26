const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', (roomId, username) => {
    socket.leaveAll();
    socket.join(roomId);
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        hostId: socket.id,
        currentTime: 0,
        isPlaying: false
      };
    }
    
    // 检查用户是否已在房间中
    const existingUserIndex = rooms[roomId].users.findIndex(u => u.id === socket.id);
    if (existingUserIndex !== -1) {
      // 更新用户名
      rooms[roomId].users[existingUserIndex].username = username;
    } else {
      // 添加新用户
      rooms[roomId].users.push({ id: socket.id, username });
    }
    
    io.to(roomId).emit('user-joined', rooms[roomId].users);
    socket.emit('room-state', {
      currentTime: rooms[roomId].currentTime,
      isPlaying: rooms[roomId].isPlaying,
      hostId: rooms[roomId].hostId,
      users: rooms[roomId].users
    });
    
    console.log(`User ${username} ${existingUserIndex !== -1 ? 'updated in' : 'joined'} room ${roomId}`);
  });

  socket.on('play', (roomId, time) => {
    if (rooms[roomId]) {
      rooms[roomId].isPlaying = true;
      rooms[roomId].currentTime = time;
      socket.to(roomId).emit('play', time);
    }
  });

  socket.on('pause', (roomId, time) => {
    if (rooms[roomId]) {
      rooms[roomId].isPlaying = false;
      rooms[roomId].currentTime = time;
      socket.to(roomId).emit('pause', time);
    }
  });

  socket.on('seek', (roomId, time) => {
    if (rooms[roomId]) {
      rooms[roomId].currentTime = time;
      socket.to(roomId).emit('seek', time);
    }
  });

  socket.on('chat-message', (roomId, message) => {
    socket.to(roomId).emit('chat-message', message);
  });

  socket.on('emoji', (roomId, emoji) => {
    socket.to(roomId).emit('emoji', emoji);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const userIndex = room.users.findIndex(u => u.id === socket.id);
      
      if (userIndex !== -1) {
        room.users.splice(userIndex, 1);
        
        if (room.users.length === 0) {
          delete rooms[roomId];
        } else {
          if (room.hostId === socket.id) {
            room.hostId = room.users[0].id;
          }
          io.to(roomId).emit('user-left', room.users, room.hostId);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
