const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;

// Secret for JWT
const JWT_SECRET = 'your_secret_key';

// Middleware
app.use(cors(
  {origin: 'http://localhost:4200', // Your Angular frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Include Authorization header
  }
));
app.use(express.json());

// In-memory storage for users and chat messages
let users = [{ username: 'user', password: bcrypt.hashSync('user', 8), role: 'customer' },
             { username: 'support', password: bcrypt.hashSync('support', 8), role: 'support' }];
let chatHistory = [];

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization']; // Extract Authorization header
  if (!authHeader) return res.status(403).send({ auth: false, message: 'No token provided.' });

  // Ensure the token is in the format 'Bearer <token>'
  const token = authHeader.split(' ')[1]; // Split the header to get the token part
  if (!token) return res.status(403).send({ auth: false, message: 'No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send({ success: false, message: 'User not found.' });

  const passwordIsValid = bcrypt.compareSync(password, user.password);
  if (!passwordIsValid) return res.status(401).send({ success: false, message: 'Invalid password.' });

  const token = jwt.sign({ id: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: 86400 // 24 hours
  });

  res.status(200).send({ success: true, token });
});

// HTTP endpoint to send a message (requires auth)
app.post('/api/chat', verifyToken, (req, res) => {
    const messageObject = {
    sender: req.userId, // Use the decoded userId (username) from JWT
    role: req.userRole, // Use the decoded user role from JWT
    message: req.body.message,
    timestamp: new Date().toISOString(), // Add a timestamp for reference
  };

  // Store the message in chat history
  chatHistory.push(messageObject);

  // Broadcast the message object to all WebSocket clients
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(messageObject)); // Send as JSON string
    }
  });

  res.status(200).json({ success: true });
});

// HTTP endpoint to get chat history (requires auth)
app.get('/api/chat/history', verifyToken, (req, res) => {
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