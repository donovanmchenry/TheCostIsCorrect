const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

const games = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.post('/create-game', (req, res) => {
  const roomCode = generateRoomCode();
  games.set(roomCode, { 
    players: [], 
    currentRound: null, 
    roundNumber: 0,
    totalRounds: 5,
    isStarted: false
  });
  res.json({ roomCode });
});

async function fetchRandomProduct() {
  try {
    const response = await axios.get('https://fakestoreapi.com/products');
    const products = response.data;
    return products[Math.floor(Math.random() * products.length)];
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

function startNewRound(roomCode) {
  const game = games.get(roomCode);
  game.roundNumber++;

  if (game.roundNumber <= game.totalRounds) {
    fetchRandomProduct().then(product => {
      if (product) {
        game.currentRound = {
          product: product,
          guesses: {},
          roundEnded: false
        };
        io.to(roomCode).emit('newRound', { 
          title: product.title, 
          image: product.image,
          roundNumber: game.roundNumber,
          totalRounds: game.totalRounds
        });
        setTimeout(() => endRound(roomCode), 10000); // End round after 10 seconds
      }
    });
  } else {
    endGame(roomCode);
  }
}

function endRound(roomCode) {
  const game = games.get(roomCode);
  if (game && game.currentRound && !game.currentRound.roundEnded) {
    game.currentRound.roundEnded = true;
    const actualPrice = game.currentRound.product.price;
    let closestGuess = Infinity;
    let winners = [];

    for (let [playerId, guess] of Object.entries(game.currentRound.guesses)) {
      const difference = Math.abs(guess - actualPrice);
      if (difference < closestGuess) {
        closestGuess = difference;
        winners = [playerId];
      } else if (difference === closestGuess) {
        winners.push(playerId);
      }
    }

    // Update scores
    game.players.forEach(player => {
      if (winners.includes(player.id)) {
        player.score += 1000;
      } else if (game.currentRound.guesses[player.id]) {
        const accuracy = 1 - Math.abs(game.currentRound.guesses[player.id] - actualPrice) / actualPrice;
        player.score += Math.round(accuracy * 500);
      }
    });

    // Sort players by score
    game.players.sort((a, b) => b.score - a.score);

    io.to(roomCode).emit('roundEnd', { 
      actualPrice: actualPrice, 
      winners: winners,
      leaderboard: game.players.map(p => ({ username: p.username, score: p.score }))
    });

    setTimeout(() => {
      // Start new round after 5 seconds
      startNewRound(roomCode);
    }, 5000);
  }
}

function endGame(roomCode) {
  const game = games.get(roomCode);
  io.to(roomCode).emit('gameEnd', {
    leaderboard: game.players.map(p => ({ username: p.username, score: p.score }))
  });
  games.delete(roomCode);
}

io.on('connection', (socket) => {
  console.log('New player connected');

  socket.on('joinRoom', ({ username, roomCode }) => {
    if (games.has(roomCode)) {
      socket.join(roomCode);
      const game = games.get(roomCode);
      game.players.push({ id: socket.id, username, score: 0 });
      socket.emit('joinedRoom', { roomCode, players: game.players });
      socket.to(roomCode).emit('playerJoined', { players: game.players });
      
      if (game.players.length === 1) {
        socket.emit('hostGame');
      }
    } else {
      socket.emit('error', { message: 'Invalid room code' });
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const game = games.get(roomCode);
    if (game && !game.isStarted) {
      game.isStarted = true;
      io.to(roomCode).emit('gameStarted');
      startNewRound(roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected');
    games.forEach((game, roomCode) => {
      game.players = game.players.filter(player => player.id !== socket.id);
      if (game.players.length === 0) {
        games.delete(roomCode);
      } else {
        io.to(roomCode).emit('playerLeft', { players: game.players });
      }
    });
  });

  socket.on('guess', ({ roomCode, guess }) => {
    const game = games.get(roomCode);
    if (game && game.currentRound && !game.currentRound.roundEnded) {
      game.currentRound.guesses[socket.id] = parseFloat(guess);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));