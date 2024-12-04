const socket = io();

const usernameScreen = document.getElementById('username-screen');
const menuScreen = document.getElementById('menu-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const endScreen = document.getElementById('end-screen');

const usernameInput = document.getElementById('username');
const submitUsernameBtn = document.getElementById('submit-username');
const userWelcome = document.getElementById('user-welcome');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const roomCodeDisplay = document.getElementById('room-code');
const roomCodeInput = document.getElementById('room-code-input');
const lobbyRoomCodeDisplay = document.getElementById('lobby-room-code-display');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const startGameBtn = document.getElementById('start-game-btn');
const gameRoomCodeDisplay = document.getElementById('game-room-code-display');
const leaderboardRoomCodeDisplay = document.getElementById('leaderboard-room-code-display');
const productImage = document.getElementById('product-image');
const productTitle = document.getElementById('product-title');
const guessInput = document.getElementById('guess-input');
const submitGuess = document.getElementById('submit-guess');
const timeLeft = document.getElementById('time-left');
const result = document.getElementById('result');
const leaderboardList = document.getElementById('leaderboard-list');
const finalLeaderboard = document.getElementById('final-leaderboard');
const returnToMenuBtn = document.getElementById('return-to-menu');
const currentRoundSpan = document.getElementById('current-round');
const totalRoundsSpan = document.getElementById('total-rounds');

let currentRoomCode = '';
let username = '';
let isHost = false;
let countdown;

submitUsernameBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    if (username) {
        usernameScreen.style.display = 'none';
        menuScreen.style.display = 'block';
        userWelcome.textContent = username;
    }
});

createGameBtn.addEventListener('click', () => {
    fetch('/create-game', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            currentRoomCode = data.roomCode;
            roomCodeDisplay.textContent = `Room Code: ${currentRoomCode}`;
            isHost = true;
            socket.emit('joinRoom', { username, roomCode: currentRoomCode });
        });
});

joinGameBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (roomCode) {
        currentRoomCode = roomCode;
        socket.emit('joinRoom', { username, roomCode });
    }
});

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomCode: currentRoomCode });
});

returnToMenuBtn.addEventListener('click', () => {
    endScreen.style.display = 'none';
    menuScreen.style.display = 'block';
    isHost = false;
});

socket.on('joinedRoom', (data) => {
    currentRoomCode = data.roomCode;
    lobbyRoomCodeDisplay.textContent = currentRoomCode;
    gameRoomCodeDisplay.textContent = currentRoomCode;
    leaderboardRoomCodeDisplay.textContent = currentRoomCode;
    menuScreen.style.display = 'none';
    lobbyScreen.style.display = 'block';
    updateLobbyPlayerList(data.players);
    if (isHost) {
        startGameBtn.style.display = 'block';
    }
});

socket.on('playerJoined', (data) => {
    updateLobbyPlayerList(data.players);
});

socket.on('gameStarted', () => {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
});

socket.on('error', (data) => {
    alert(data.message);
});

socket.on('newRound', (data) => {
    leaderboardScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    productImage.src = data.image;
    productTitle.textContent = data.title;
    guessInput.value = '';
    result.textContent = '';
    currentRoundSpan.textContent = data.roundNumber;
    totalRoundsSpan.textContent = data.totalRounds;
    startTimer(10);
});

socket.on('roundEnd', (data) => {
    clearInterval(countdown);
    const actualPrice = data.actualPrice.toFixed(2);
    const winnerText = data.winners.includes(socket.id) ? 'You win!' : 'You lose!';
    result.textContent = `Round ended. Actual price: $${actualPrice}. ${winnerText}`;
    updateLeaderboard(data.leaderboard);
    gameScreen.style.display = 'none';
    leaderboardScreen.style.display = 'block';
});

socket.on('gameEnd', (data) => {
    leaderboardScreen.style.display = 'none';
    endScreen.style.display = 'block';
    updateFinalLeaderboard(data.leaderboard);
});

submitGuess.addEventListener('click', () => {
    const guess = guessInput.value;
    if (guess) {
        socket.emit('guess', { roomCode: currentRoomCode, guess: guess });
        submitGuess.disabled = true;
    }
});

function startTimer(duration) {
    let timer = duration;
    submitGuess.disabled = false;
    countdown = setInterval(() => {
        timeLeft.textContent = timer;
        timer--;
        if (timer < 0) {
            clearInterval(countdown);
            submitGuess.disabled = true;
        }
    }, 1000);
}

function updateLobbyPlayerList(players) {
    lobbyPlayerList.innerHTML = '';
    players.forEach((player, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${player.username}`;
        lobbyPlayerList.appendChild(li);
    });
}

function updateLeaderboard(leaderboard) {
    leaderboardList.innerHTML = '';
    leaderboard.forEach((player, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${player.username}: ${player.score}`;
        leaderboardList.appendChild(li);
    });
}

function updateFinalLeaderboard(leaderboard) {
    finalLeaderboard.innerHTML = '';
    leaderboard.forEach((player, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${player.username}: ${player.score}`;
        finalLeaderboard.appendChild(li);
    });
}