const { io } = require('socket.io-client');
const axios = require('axios');

// Configuration for the EDC device
const CONFIG = {
  SERVER_URL: 'http://localhost:3000',
  EDC_SERVER_URL: 'http://your-edc-backend-server/api', // Change this to your actual EDC backend
  DEVICE_ID: 'edc-terminal-001',
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10
};

// Connection state
let socket = null;
let reconnectAttempts = 0;
let isConnecting = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Connect to Socket.IO server with retry mechanism
function connectWithRetry() {
  if (isConnecting) return;
  
  isConnecting = true;
  console.log(`Connecting to server (attempt ${reconnectAttempts + 1}/${CONFIG.MAX_RECONNECT_ATTEMPTS})...`);
  
  // Create socket connection with auto-reconnect disabled (we'll handle it ourselves)
  socket = io(CONFIG.SERVER_URL, {
    reconnection: false,
    timeout: 10000
  });
  
  // Connection established
  socket.on('connect', () => {
    console.log('Connected to server!');
    reconnectAttempts = 0;
    isConnecting = false;
    
    // Register the device
    socket.emit('register', {
      id: CONFIG.DEVICE_ID,
      type: 'EDC',
      capabilities: ['payment', 'identification'],
      version: '1.0.0'
    });
  });
  
  // Handle registration confirmation
  socket.on('registration_confirmed', (data) => {
    console.log(`Registration confirmed by server at ${data.serverTime}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from server: ${reason}`);
    socket.close();
    scheduleReconnect();
  });
  
  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
    socket.close();
    scheduleReconnect();
  });
  
  // Handle tasks from server
  socket.on('execute_task', async (task) => {
    console.log(`Received task: ${task.taskId}`);
    
    try {
      // Process the task by calling the EDC backend server
    //   const response = await axios.post(`${CONFIG.EDC_SERVER_URL}/process`, {
    //     taskId: task.taskId,
    //     ...task.data
    //   });


      await delay(3000)

      const response = {
        data: {
            success: true
        }
      }
      
      // Send the result back to the server
      socket.emit('task_complete', {
        deviceId: CONFIG.DEVICE_ID,
        taskId: task.taskId,
        result: response.data,
        status: 'success',
        timestamp: new Date().toISOString()
      });
      
      console.log(`Task ${task.taskId} completed successfully`);
    } catch (error) {
      console.error(`Error processing task ${task.taskId}:`, error.message);
      
      // Send error back to server
      socket.emit('task_complete', {
        deviceId: CONFIG.DEVICE_ID,
        taskId: task.taskId,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Schedule reconnection with exponential backoff
function scheduleReconnect() {
  if (isConnecting) return;
  
  reconnectAttempts++;
  
  if (reconnectAttempts <= CONFIG.MAX_RECONNECT_ATTEMPTS) {
    const delay = Math.min(
      CONFIG.RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1),
      60000 // Max 1 minute delay
    );
    
    console.log(`Scheduling reconnection in ${delay / 1000} seconds...`);
    
    setTimeout(() => {
      connectWithRetry();
    }, delay);
  } else {
    console.error('Max reconnection attempts reached. Please check server status.');
    
    // Reset the counter and try again after a longer delay
    reconnectAttempts = 0;
    setTimeout(() => {
      connectWithRetry();
    }, 120000); // 2 minutes
  }
}

// Start the connection
connectWithRetry();

// Handle process termination
process.on('SIGINT', () => {
  console.log('Process terminated. Closing connection...');
  if (socket) {
    socket.close();
  }
  process.exit(0);
});