const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for chat messages
let chatHistory = [];

// HTTP endpoint to send a message
app.post('/api/chat', (req, res) => {
  const message = req.body.message;
  chatHistory.push(message);

  // Broadcast the message to all WebSocket clients
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  res.status(200).json({ success: true });
});

// HTTP endpoint to get chat history
app.get('/api/chat/history', (req, res) => {
  res.status(200).json(chatHistory);
});

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`HTTP server running at http://localhost:${port}`);
});

// Create WebSocket server
const wsServer = new WebSocket.Server({ server });

// Handle WebSocket connections
wsServer.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // Send existing chat history to the new client
  chatHistory.forEach(message => {
    ws.send(message);
  });

  ws.on('message', (message) => {
    console.log('Received message:', message);

    // Broadcast the received message to all WebSocket clients
    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});