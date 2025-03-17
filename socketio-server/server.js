const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store connected EDC device
let connectedDevice = null;

// Middleware to handle JSON bodies
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`New connection established: ${socket.id}`);
  
  // Handle device registration
  socket.on('register', (deviceInfo) => {
    console.log(`Device registered: ${deviceInfo.id}`);
    
    // Store device information
    connectedDevice = {
      socketId: socket.id,
      info: deviceInfo,
      status: 'idle',
      lastActive: Date.now()
    };
    
    // Confirm registration
    socket.emit('registration_confirmed', {
      deviceId: deviceInfo.id,
      serverTime: new Date().toISOString()
    });
  });
  
  // Handle response from EDC device
  socket.on('task_complete', (data) => {
    console.log(`Task completed by device: ${data.deviceId}`);
    console.log(`Result:`, data.result);
    
    // Update device status
    if (connectedDevice && connectedDevice.socketId === socket.id) {
      connectedDevice.status = 'idle';
      connectedDevice.lastActive = Date.now();
    }
  });
  
  // Handle device status updates
  socket.on('status_update', (data) => {
    if (connectedDevice && connectedDevice.socketId === socket.id) {
      connectedDevice.status = data.status;
      connectedDevice.lastActive = Date.now();
      console.log(`Device status updated to ${data.status}`);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Connection closed: ${socket.id}`);
    
    // Clear device if it's the one that disconnected
    if (connectedDevice && connectedDevice.socketId === socket.id) {
      console.log(`Device ${connectedDevice.info.id} disconnected`);
      connectedDevice = null;
    }
  });
});

// API endpoint to get device status
app.get('/device', (req, res) => {
  if (!connectedDevice) {
    return res.status(404).json({ error: 'No device connected' });
  }
  
  res.json({
    id: connectedDevice.info.id,
    info: connectedDevice.info,
    status: connectedDevice.status,
    lastActive: new Date(connectedDevice.lastActive).toISOString()
  });
});

// API endpoint to request task execution
app.post('/request', (req, res) => {
  if (!connectedDevice) {
    return res.status(404).json({ error: 'No device connected' });
  }
  
  if (connectedDevice.status !== 'idle') {
    return res.status(409).json({ error: 'Device is busy', currentStatus: connectedDevice.status });
  }
  
  // Update device status
  connectedDevice.status = 'processing';
  
  // Send task to the EDC device
  const taskId = `task-${Date.now()}`;
  io.to(connectedDevice.socketId).emit('execute_task', {
    taskId,
    data: req.body
  });
  
  res.json({ 
    status: 'Task sent to device', 
    deviceId: connectedDevice.info.id,
    taskId 
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});