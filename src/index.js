
'use strict';

const session = require('express-session');
const express = require('express');
const http = require('http');
const bodyParser = require("body-parser");
const WebSocket = require('ws');
const { uuid } = require('./models/utils');

const app = express();
const map = new Map();
const API_ROOT = "/api";
const PORT = 8060;

// list the models we expose to host through module federation
import * as models from './models';
Object.keys(models).forEach(key => console.log({ key, value: models[key] }))

// We need the same instance of the session parser in express and
// WebSocket server.
const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

// Serve static files from the 'public' folder.
app.use(express.static('public'));
app.use(express.static('dist')); // remoteEntry.js
app.use(sessionParser);
app.use(bodyParser.json());

app.post('/login', function (req, res) {
  // "Log in" user and set userId to session.
  const id = uuid();
  console.log(`Updating session for user ${id}`);
  req.session.userId = id;
  res.send({ result: 'OK', message: 'Session updated' });
});

app.delete('/logout', function (request, response) {
  const ws = map.get(request.session.userId);
  console.log('Destroying session');
  request.session.destroy(function () {
    if (ws) ws.close();
    response.send({ result: 'OK', message: 'Session destroyed' });
  });
});

app.get(
  `${API_ROOT}/fedmonserv`,
  (req, res) => res.send('Federated Monolith Service')
);

app.get(`${API_ROOT}/service1`, (req, res) => {
  console.log({ from: req.ip, url: req.originalUrl });
  res.status(200).send({
    "from": "fedmonserv",
    "ip": req.ip,
    "port": PORT,
    "url": req.originalUrl,
    "date": new Date().toUTCString()
  });
});

// Create HTTP server
const server = http.createServer(app);
const wss = new WebSocket.Server({ clientTracking: true, noServer: true });

// Send events emitted from host to any WS clients
app.post(`${API_ROOT}/publish`, (req, res) => {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: req.body }));
    }
  });
  console.log({ event: req.body });
  res.status(201).send({ "event": req.body, "date": new Date().toUTCString() });
});

// Handle request to upgrade to websocket protocol
server.on('upgrade', function (request, socket, head) {
  console.log('Parsing session from request...');

  sessionParser(request, {}, () => {
    if (!request.session.userId) {
      socket.destroy();
      return;
    }
    console.log('Session is parsed');
    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', function (ws, request) {
  const userId = request.session.userId;
  map.set(userId, ws);

  ws.on('message', function (message) {
    console.log(`Received message ${message} from user ${userId}`);
  });

  ws.on('close', function () {
    map.delete(userId);
  });
});

// Start the server.
server.listen(PORT, function () {
  console.log(`Listening on http://localhost:${PORT}`);
});