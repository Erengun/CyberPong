// Cyberpunk Neon Pong with Enhanced Visuals, Sound, Difficulty Scaling, and Countdown

const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

// --- Sound System ---
// Simple synth sounds using Web Audio API
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playBeep(freq, duration = 0.07, gain = 0.25, type = 'sine', pan = 0) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    let panNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    if (panNode) {
        panNode.pan.value = pan;
        g.connect(panNode);
        panNode.connect(audioCtx.destination);
    } else {
        g.connect(audioCtx.destination);
    }
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
    osc.onended = () => osc.disconnect();
}

function beepPaddle(isPlayer) { playBeep(isPlayer ? 350 : 600, 0.05, 0.18, 'triangle', isPlayer ? -0.8 : 0.8); }
function beepWall() { playBeep(1200, 0.03, 0.12, 'square'); }
function beepScore(isPlayer) { playBeep(isPlayer ? 880 : 220, 0.17, 0.22, 'sawtooth'); }
function beepCountdown(n) { playBeep(220 + n * 100, 0.12, 0.18, 'triangle'); }
function beepSkill() { playBeep(1600, 0.08, 0.16, 'triangle'); }
function beepWin(isPlayer) {
    for (let i = 0; i < 4; i++) setTimeout(() => playBeep(isPlayer ? 1300 : 170, 0.07, 0.22, 'triangle'), i * 80);
}

// --- Visuals/State ---
function createFloatingParticles() {
    const container = document.querySelector('.floating-particles');
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        container.appendChild(particle);
    }
}
createFloatingParticles();

let playAgainBtn = document.getElementById('pong-play-again');
if (!playAgainBtn) {
    playAgainBtn = document.createElement('button');
    playAgainBtn.id = 'pong-play-again';
    playAgainBtn.textContent = 'PLAY AGAIN';
    playAgainBtn.style.display = 'none';
    playAgainBtn.style.position = 'absolute';
    playAgainBtn.style.left = '50%';
    playAgainBtn.style.top = '100px';
    playAgainBtn.style.transform = 'translateX(-50%)';
    playAgainBtn.style.padding = '15px 40px';
    playAgainBtn.style.fontSize = '20px';
    playAgainBtn.style.cursor = 'pointer';
    playAgainBtn.style.zIndex = '10';
    document.body.appendChild(playAgainBtn);
}
function centerPlayAgainBtn() {
    const rect = canvas.getBoundingClientRect();
    playAgainBtn.style.top = `${rect.top + 50}px`;
    playAgainBtn.style.left = `${rect.left + rect.width / 2}px`;
}
window.addEventListener('resize', centerPlayAgainBtn);

playAgainBtn.onclick = () => {
    resetGame(true);
    playAgainBtn.style.display = 'none';
};

// --- Colors and Settings ---
const neonColorSets = [
    ["#00f0ff", "#ff00ea", "#39ff14", "#f7e600", "#ff006e", "#aaffff", "#fff700"],
    ["#ff00cc", "#00ffea", "#fffb00", "#08f7fe", "#f5f7fa", "#f6019d", "#00ff99"],
    ["#00fff7", "#ff2bff", "#ffe400", "#ff3c38", "#18f9c9", "#00e0ff", "#ffb6ff"]
];
let neonColors = [...neonColorSets[0]];

// --- Game Settings ---
let PADDLE_WIDTH = 14;
let PADDLE_HEIGHT = 80;
const BALL_SIZE = 16;
const PLAYER_X = 32;
let AI_X = 0;
const BASE_AI_SPEED = 3.5;
const MAX_AI_SPEED = 18;
const PADDLE_MIN_HEIGHT = 28;
const PADDLE_MAX_HEIGHT = 160;
const BALLS_MAX = 5;
const WIN_SCORE = 3;

canvas.width = 760;
canvas.height = 420;
AI_X = canvas.width - PLAYER_X - PADDLE_WIDTH;

// --- State ---
let playerY = (canvas.height - PADDLE_HEIGHT) / 2;
let aiY = (canvas.height - PADDLE_HEIGHT) / 2;
function randomBetween(a, b) { return a + Math.random() * (b - a); }
function randomSign() { return Math.random() < 0.5 ? 1 : -1; }
let gameState = 'ready'; // 'ready', 'playing', 'paused', 'countdown', 'gameover'
let countdownTimer = 3;
let countdownFrames = 0;
let playerScore = 0, aiScore = 0, matchFinished = false, matchWinner = null;
let balls = [];
let prevBallPos = [];
let particles = [];
let effects = {
    bgColor: "#13072e",
    ballColors: [...neonColors],
    paddleColor: "#00f0ff",
    netColor: "#00f0ff99",
    shadow: true,
    glow: true,
    trail: true
};
let frame = 0;
let hitCount = 0;
let paddleShrinkTimer = 0, paddleGrowTimer = 0;
let aiPowerUps = 0, aiBoards = 1, aiPaddleHeight = PADDLE_HEIGHT;
let aiDuplicationGap = 44;
let aiSpeed = BASE_AI_SPEED, aiFrameCount = 0;
let scalingLevel = 0;

// --- Particles ---
function createParticle(x, y, color, type = 'spark') {
    particles.push({
        x, y,
        vx: randomBetween(-3, 3),
        vy: randomBetween(-3, 3),
        life: 30 + Math.random() * 20,
        maxLife: 30 + Math.random() * 20,
        color,
        type,
        size: randomBetween(1, 3)
    });
}
function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vx *= 0.98;
        p.vy *= 0.98;
        return p.life > 0;
    });
}
function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    });
}

// --- Colors ---
function gentlyChangeColors() {
    if (frame % 240 === 0) {
        neonColors = [...neonColorSets[Math.floor(Math.random() * neonColorSets.length)]];
        effects.ballColors = [...neonColors];
        effects.paddleColor = neonColors[(playerScore + aiScore) % neonColors.length];
        effects.netColor = neonColors[(playerScore + aiScore + 1) % neonColors.length] + "cc";
    }
}

// --- Skills ---
const skillCooldowns = [0, 0, 0, 0];
const skillMaxCooldowns = [600, 900, 800, 1200];
let skillVisuals = [0, 0, 0, 0];
let slowTimeActive = false, slowTimeTimer = 0, wallActive = false, wallTimer = 0;
const SLOWTIME_FACTOR = 0.5, SLOWTIME_LENGTH = 240;
const WALL_LENGTH = 360, WALL_WIDTH = 16, WALL_HEIGHT = 160;
let wallY = 0;

function teleportEnemy() {
    aiY = randomBetween(0, canvas.height - aiPaddleHeight - (aiBoards - 1) * aiDuplicationGap);
    skillVisuals[0] = 40;
    beepSkill();
    for (let i = 0; i < 15; i++) createParticle(AI_X + PADDLE_WIDTH/2, aiY + aiPaddleHeight/2, '#00f0ff', 'teleport');
}
function activateSlowTime() {
    slowTimeActive = true;
    slowTimeTimer = SLOWTIME_LENGTH;
    skillVisuals[1] = 60;
    beepSkill();
    for (let i = 0; i < 25; i++) createParticle(randomBetween(0, canvas.width), randomBetween(0, canvas.height), '#39ff14', 'time');
}
function activateWall() {
    wallActive = true;
    wallTimer = WALL_LENGTH;
    wallY = randomBetween(40, canvas.height - WALL_HEIGHT - 40);
    skillVisuals[2] = 1;
    beepSkill();
    for (let i = 0; i < 20; i++) createParticle(canvas.width/2, wallY + WALL_HEIGHT/2, '#f7e600', 'wall');
}
function addRandomBall() {
    if (balls.length < BALLS_MAX) {
        let newBall = spawnBall();
        newBall.vx *= randomSign();
        newBall.vy *= randomSign();
        balls.push(newBall);
        skillVisuals[3] = 60;
        beepSkill();
        for (let i = 0; i < 12; i++) createParticle(newBall.x, newBall.y, newBall.color, 'spawn');
    }
}

// --- Input ---
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // First input: start audio context if not started
    if (!audioCtx) {
        try { audioCtx = new AudioContext(); } catch (err) {}
    }

    // Start game when ready
    if (gameState === 'ready' && key === ' ') {
        gameState = 'countdown';
        countdownTimer = 3;
        countdownFrames = 0;
        beepCountdown(3); // First beep
        return;
    }

    // Pause/unpause during gameplay
    if (key === ' ') {
        if (gameState === 'playing') {
            gameState = 'paused';
            beepCountdown(1);
        } else if (gameState === 'paused') {
            gameState = 'playing';
            beepCountdown(2);
        }
        return;
    }

    // Skills only work during gameplay
    if (gameState !== 'playing') return;
    if (key === 'q' && skillCooldowns[0] <= 0) {
        teleportEnemy();
        skillCooldowns[0] = skillMaxCooldowns[0];
    }
    if (key === 'w' && skillCooldowns[1] <= 0 && !slowTimeActive) {
        activateSlowTime();
        skillCooldowns[1] = skillMaxCooldowns[1];
    }
    if (key === 'e' && skillCooldowns[2] <= 0 && !wallActive) {
        activateWall();
        skillCooldowns[2] = skillMaxCooldowns[2];
    }
    if (key === 'r' && skillCooldowns[3] <= 0) {
        addRandomBall();
        skillCooldowns[3] = skillMaxCooldowns[3];
    }
});

// --- Countdown ---
function updateCountdown() {
    if (gameState === 'countdown') {
        countdownFrames++;
        if (countdownFrames >= 60) { // 1 second at 60fps
            countdownTimer--;
            countdownFrames = 0;
            if (countdownTimer > 0) beepCountdown(countdownTimer);
            if (countdownTimer <= 0) {
                gameState = 'playing';
                beepCountdown(1);
            }
        }
    }
}

// --- Difficulty Scaling ---
function updateDifficultyScaling() {
    scalingLevel = playerScore;
    aiPaddleHeight = Math.max(50, PADDLE_HEIGHT - scalingLevel * 12 + aiPowerUps * 15);
    aiSpeed = Math.min(MAX_AI_SPEED, BASE_AI_SPEED + aiPowerUps * 1.5 + scalingLevel * 1.2);
    aiBoards = (playerScore >= 2) ? 2 : 1;
}

// --- Game Logic ---
function resetGame(full = true) {
    if (full) {
        playerScore = 0;
        aiScore = 0;
        matchFinished = false;
        matchWinner = null;
        aiPowerUps = 0;
        aiBoards = 1;
        for (let i = 0; i < 4; ++i) skillCooldowns[i] = 0;
        slowTimeActive = false;
        wallActive = false;
        scalingLevel = 0;
        gameState = 'ready';
    } else {
        gameState = 'countdown';
        countdownTimer = 3;
        countdownFrames = 0;
        beepCountdown(3);
    }
    PADDLE_HEIGHT = 80;
    playerY = (canvas.height - PADDLE_HEIGHT) / 2;
    aiY = (canvas.height - aiPaddleHeight) / 2;
    balls = [spawnBall(true)];
    prevBallPos = [];
    particles = [];
    hitCount = 0;
    paddleShrinkTimer = 0;
    paddleGrowTimer = 0;
    updateDifficultyScaling();
    centerPlayAgainBtn();
}

// --- Slow ball at serve ---
function spawnBall(isServe = false) {
    let speedBoost = scalingLevel * 1.0;
    let baseSpeed = isServe ? 3.5 : randomBetween(6, 8 + aiPowerUps) + speedBoost;
    return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: randomSign() * baseSpeed,
        vy: randomBetween(-3, 3),
        size: BALL_SIZE,
        color: neonColors[Math.floor(Math.random() * neonColors.length)]
    };
}

// --- Mouse control ---
canvas.addEventListener('mousemove', (e) => {
    if (gameState !== 'playing' && gameState !== 'paused') return;
    const rect = canvas.getBoundingClientRect();
    let mouseY = e.clientY - rect.top;
    playerY = mouseY - PADDLE_HEIGHT / 2;
    if (playerY < 0) playerY = 0;
    if (playerY + PADDLE_HEIGHT > canvas.height) playerY = canvas.height - PADDLE_HEIGHT;
});

function updateAI() {
    if (gameState !== 'playing') return;
    let targetBall = balls[balls.length - 1];
    let inaccuracy = randomBetween(-6, 6) / (1 + aiPowerUps * 0.28 + scalingLevel * 0.1);
    let trueSpeed = slowTimeActive ? aiSpeed * SLOWTIME_FACTOR : aiSpeed;
    if (aiFrameCount % 24 === 0) {
        aiSpeed = Math.min(MAX_AI_SPEED,
            BASE_AI_SPEED + aiPowerUps * 1.5 + scalingLevel * 1.2 + randomBetween(1, 4 + aiPowerUps)
        );
    }
    aiFrameCount++;
    let targetY = targetBall.y + inaccuracy - aiPaddleHeight / 2;
    if (aiY < targetY) {
        aiY += trueSpeed;
        if (aiY > targetY) aiY = targetY;
    } else if (aiY > targetY) {
        aiY -= trueSpeed;
        if (aiY < targetY) aiY = targetY;
    }
    if (aiY < 0) aiY = 0;
    if (aiY + aiPaddleHeight > canvas.height - (aiBoards - 1) * aiDuplicationGap)
        aiY = canvas.height - aiPaddleHeight - (aiBoards - 1) * aiDuplicationGap;
}

function updateBalls() {
    if (gameState !== 'playing') return;

    if (effects.trail) {
        prevBallPos.unshift(balls.map(b => ({ x: b.x, y: b.y, color: b.color, size: b.size })));
        if (prevBallPos.length > 15) prevBallPos.length = 15;
    }

    balls.forEach((ball, idx) => {
        if (Math.random() < 0.3) createParticle(ball.x, ball.y, ball.color, 'trail');
        let speedFactor = slowTimeActive ? SLOWTIME_FACTOR : 1;
        ball.x += ball.vx * speedFactor;
        ball.y += ball.vy * speedFactor;

        // Wall collision
        if (ball.y - ball.size / 2 < 0) {
            ball.y = ball.size / 2;
            ball.vy *= -1 * randomBetween(0.96, 1.05);
            ball.vx *= randomBetween(0.97, 1.04);
            beepWall();
            for (let i = 0; i < 5; i++) createParticle(ball.x, 0, ball.color, 'impact');
        }
        if (ball.y + ball.size / 2 > canvas.height) {
            ball.y = canvas.height - ball.size / 2;
            ball.vy *= -1 * randomBetween(0.96, 1.05);
            ball.vx *= randomBetween(0.97, 1.04);
            beepWall();
            for (let i = 0; i < 5; i++) createParticle(ball.x, canvas.height, ball.color, 'impact');
        }

        // Wall skill collision
        if (wallActive) {
            let wallX = canvas.width / 2 - WALL_WIDTH / 2;
            if (
                ball.x + ball.size / 2 > wallX &&
                ball.x - ball.size / 2 < wallX + WALL_WIDTH &&
                ball.y + ball.size / 2 > wallY &&
                ball.y - ball.size / 2 < wallY + WALL_HEIGHT
            ) {
                if (ball.x < wallX) {
                    ball.x = wallX - ball.size / 2;
                } else {
                    ball.x = wallX + WALL_WIDTH + ball.size / 2;
                }
                ball.vx *= -1 * randomBetween(0.9, 1.08);
                ball.vy *= randomBetween(0.97, 1.04);
                beepWall();
                for (let i = 0; i < 8; i++) createParticle(ball.x, ball.y, '#f7e600', 'impact');
            }
        }

        // Paddle collision (player)
        if (
            ball.x - ball.size / 2 < PLAYER_X + PADDLE_WIDTH &&
            ball.x + ball.size / 2 > PLAYER_X &&
            ball.y + ball.size / 2 > playerY &&
            ball.y - ball.size / 2 < playerY + PADDLE_HEIGHT
        ) {
            ball.x = PLAYER_X + PADDLE_WIDTH + ball.size / 2;
            let baseSpeed = Math.abs(ball.vx);
            let boost = scalingLevel * 0.8;
            ball.vx = (baseSpeed + boost) * randomBetween(1.14, 1.21);
            if (ball.vx > 17 + scalingLevel * 0.8) ball.vx = 17 + scalingLevel * 0.8;
            let collidePoint = (ball.y - (playerY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
            ball.vy = 6 * collidePoint + randomBetween(-2, 2) + boost * 0.3;
            ball.vx *= randomBetween(0.98, 1.07);
            ball.color = effects.ballColors[(idx + hitCount) % effects.ballColors.length];
            hitCount++;
            beepPaddle(true);
            for (let i = 0; i < 10; i++) createParticle(PLAYER_X + PADDLE_WIDTH, ball.y, effects.paddleColor, 'paddle');
        }

        // Paddle collision (AI)
        for (let i = 0; i < aiBoards; i++) {
            let thisY = aiY + i * aiDuplicationGap;
            if (
                ball.x + ball.size / 2 > AI_X &&
                ball.x - ball.size / 2 < AI_X + PADDLE_WIDTH &&
                ball.y + ball.size / 2 > thisY &&
                ball.y - ball.size / 2 < thisY + aiPaddleHeight
            ) {
                ball.x = AI_X - ball.size / 2;
                let baseSpeed = Math.abs(ball.vx);
                let boost = scalingLevel * 0.8;
                ball.vx = -(baseSpeed + boost) * randomBetween(1.14, 1.22);
                if (ball.vx < -(17 + scalingLevel * 0.8)) ball.vx = -(17 + scalingLevel * 0.8);
                let collidePoint = (ball.y - (thisY + aiPaddleHeight / 2)) / (aiPaddleHeight / 2);
                ball.vy = 6 * collidePoint + randomBetween(-2, 2) + boost * 0.3;
                ball.vx *= randomBetween(0.99, 1.07);
                ball.color = effects.ballColors[(idx + hitCount + 2 + i) % effects.ballColors.length];
                hitCount++;
                beepPaddle(false);
                for (let j = 0; j < 10; j++) createParticle(AI_X, ball.y, effects.paddleColor, 'paddle');
            }
        }
    });

    // Ball splitting
    if (hitCount > 0 && hitCount % 5 === 0 && balls.length < BALLS_MAX) {
        let baseBall = balls[balls.length - 1];
        let newBall = Object.assign({}, baseBall);
        newBall.vx = -newBall.vx * randomBetween(0.88, 1.12);
        newBall.vy = -newBall.vy * randomBetween(0.9, 1.1);
        newBall.size = BALL_SIZE * randomBetween(0.9, 1.1);
        newBall.color = effects.ballColors[balls.length % effects.ballColors.length];
        balls.push(newBall);
        hitCount = 0;
        beepWall();
        for (let i = 0; i < 15; i++) createParticle(baseBall.x, baseBall.y, baseBall.color, 'split');
    }

    // Paddle shrink/grow
    if (paddleShrinkTimer > 0) paddleShrinkTimer--;
    if (paddleGrowTimer > 0) paddleGrowTimer--;
    if (hitCount > 0 && hitCount % 3 === 0 && PADDLE_HEIGHT > PADDLE_MIN_HEIGHT && paddleShrinkTimer === 0) {
        PADDLE_HEIGHT -= 7;
        paddleShrinkTimer = 48;
    }
    if (Math.random() < 0.01 && PADDLE_HEIGHT < 120 && paddleGrowTimer === 0) {
        PADDLE_HEIGHT += 7;
        paddleGrowTimer = 48;
    }

    // Scoring
    let lastBall = balls[balls.length - 1];
    if (lastBall.x < 0) {
        aiScore++;
        updateDifficultyScaling();
        beepScore(false);
        if (aiScore >= WIN_SCORE) {
            matchFinished = true;
            matchWinner = "AI";
            gameState = 'gameover';
            beepWin(false);
            playAgainBtn.style.display = 'block';
        } else {
            aiPowerUps++;
            updateDifficultyScaling();
        }
        resetGame(false);
    } else if (lastBall.x > canvas.width) {
        playerScore++;
        updateDifficultyScaling();
        beepScore(true);
        if (playerScore >= WIN_SCORE) {
            matchFinished = true;
            matchWinner = "Player";
            gameState = 'gameover';
            beepWin(true);
            playAgainBtn.style.display = 'block';
        } else {
            updateDifficultyScaling();
        }
        resetGame(false);
    }
}

function updateSkillTimers() {
    if (gameState !== 'playing') return;
    for (let i = 0; i < 4; ++i) {
        if (skillCooldowns[i] > 0) skillCooldowns[i]--;
        if (skillVisuals[i] > 0) skillVisuals[i]--;
    }
    if (slowTimeActive) {
        slowTimeTimer--;
        if (slowTimeTimer <= 0) slowTimeActive = false;
    }
    if (wallActive) {
        wallTimer--;
        if (wallTimer <= 0) wallActive = false;
    }
}

// --- Drawing functions ---
function draw() {
    ctx.save();
    // Enhanced background with animated gradient
    let gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
    gradient.addColorStop(0, "#2a0047");
    gradient.addColorStop(0.5, "#1d0036");
    gradient.addColorStop(1, "#13072e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Slow time visual effect
    if (slowTimeActive) {
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = "#39ff14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Neon net
    ctx.save();
    ctx.setLineDash([8, 16]);
    ctx.strokeStyle = effects.netColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 20 + Math.sin(frame * 0.1) * 5;
    for (let i = 0; i < canvas.height; i += 28) {
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, i);
        ctx.lineTo(canvas.width / 2, i + 14);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Wall w/ animated effects
    if (wallActive) {
        ctx.save();
        ctx.shadowColor = "#f7e600";
        ctx.shadowBlur = 30 + Math.sin(frame * 0.15) * 10;
        ctx.globalAlpha = 0.9;
        let wallGradient = ctx.createLinearGradient(0, wallY, 0, wallY + WALL_HEIGHT);
        wallGradient.addColorStop(0, "#f7e600");
        wallGradient.addColorStop(0.5, "#ff00ea");
        wallGradient.addColorStop(1, "#f7e600");
        ctx.fillStyle = wallGradient;
        ctx.fillRect(canvas.width / 2 - WALL_WIDTH / 2, wallY, WALL_WIDTH, WALL_HEIGHT);
        ctx.restore();
    }

    // --- Scoreboard ---
    ctx.save();
    ctx.font = "bold 40px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = neonColors[2];
    ctx.shadowColor = neonColors[2];
    ctx.shadowBlur = 25 + Math.sin(frame * 0.1) * 5;
    ctx.fillText(playerScore, canvas.width * 0.25, 14);
    ctx.fillStyle = neonColors[3];
    ctx.shadowColor = neonColors[3];
    ctx.shadowBlur = 25 + Math.sin(frame * 0.1) * 5;
    ctx.fillText(aiScore, canvas.width * 0.75, 14);
    ctx.font = "22px 'Orbitron', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = neonColors[0];
    ctx.shadowBlur = 15;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("First to 3 wins!", canvas.width / 2, 14);
    ctx.restore();

    // --- Paddles ---
    function drawEnhancedPaddle(x, y, h, color, glowColor, flash) {
        ctx.save();
        ctx.shadowColor = glowColor || color;
        ctx.shadowBlur = flash ? 40 + Math.sin(frame * 0.2) * 10 : 30;
        ctx.lineJoin = "round";
        let paddleGradient = ctx.createLinearGradient(x, y, x + PADDLE_WIDTH, y + h);
        paddleGradient.addColorStop(0, color);
        paddleGradient.addColorStop(0.5, "#fff");
        paddleGradient.addColorStop(1, color);
        ctx.globalAlpha = flash ? 1 : 0.9;
        ctx.fillStyle = paddleGradient;
        ctx.fillRect(x, y, PADDLE_WIDTH, h);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, PADDLE_WIDTH - 4, h - 4);
        ctx.restore();
    }
    drawEnhancedPaddle(PLAYER_X, playerY, PADDLE_HEIGHT, effects.paddleColor, neonColors[1], skillVisuals[0] > 0);

    for (let i = 0; i < aiBoards; i++) {
        let thisY = aiY + i * aiDuplicationGap;
        drawEnhancedPaddle(AI_X, thisY, aiPaddleHeight, effects.paddleColor, neonColors[0], skillVisuals[0] > 0);
    }

    // --- Trails ---
    if (effects.trail && prevBallPos.length > 0) {
        for (let i = prevBallPos.length - 1; i >= 0; i--) {
            let ballsTrail = prevBallPos[i];
            ballsTrail.forEach(ball => {
                ctx.save();
                ctx.globalAlpha = 0.08 + (i * 0.012);
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ball.size / 2, 0, 2 * Math.PI);
                ctx.fillStyle = ball.color;
                ctx.shadowColor = ball.color;
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.restore();
            });
        }
    }

    // --- Balls ---
    balls.forEach((ball, idx) => {
        ctx.save();
        ctx.shadowColor = ball.color;
        ctx.shadowBlur = 35 + Math.sin(frame * 0.1 + idx) * 8;
        let ballGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.size);
        ballGradient.addColorStop(0, "#fff");
        ballGradient.addColorStop(0.3, ball.color);
        ballGradient.addColorStop(1, ball.color);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.size / 2, 0, 2 * Math.PI);
        ctx.fillStyle = ballGradient;
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.restore();
    });

    // --- Particles ---
    drawParticles();

    // --- Game state overlays ---
    drawGameStateOverlay();

    // --- Skills UI ---
    if (gameState === 'playing' || gameState === 'paused') {
        drawEnhancedSkillsUI();
    }
    ctx.restore();
}

function drawGameStateOverlay() {
    ctx.save();
    if (gameState === 'ready') {
        ctx.globalAlpha = 0.9;
        let overlayGradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/2);
        overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.3)");
        overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.font = "bold 48px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 30 + Math.sin(frame * 0.1) * 10;
        ctx.fillText("READY TO PLAY", canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = "24px 'Orbitron', sans-serif";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#ff00ea";
        ctx.shadowBlur = 20;
        ctx.fillText("Press SPACEBAR to start", canvas.width / 2, canvas.height / 2 + 20);
        ctx.font = "18px 'Orbitron', sans-serif";
        ctx.fillStyle = "#aaffff";
        ctx.shadowBlur = 15;
        ctx.fillText("Skills: Q(Teleport) W(Slow Time) E(Wall) R(+Ball)", canvas.width / 2, canvas.height / 2 + 60);
    }
    else if (gameState === 'countdown') {
        ctx.globalAlpha = 0.7;
        let overlayGradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/2);
        overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.1)");
        overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.font = "bold 80px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        let countColor = countdownTimer === 3 ? "#ff00ea" : countdownTimer === 2 ? "#f7e600" : "#39ff14";
        ctx.fillStyle = countColor;
        ctx.shadowColor = countColor;
        ctx.shadowBlur = 40 + Math.sin(frame * 0.2) * 15;
        ctx.fillText(countdownTimer > 0 ? countdownTimer : "GO!", canvas.width / 2, canvas.height / 2 + 20);
    }
    else if (gameState === 'paused') {
        ctx.globalAlpha = 0.8;
        let overlayGradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/2);
        overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.2)");
        overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.font = "bold 48px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#f7e600";
        ctx.shadowColor = "#f7e600";
        ctx.shadowBlur = 30 + Math.sin(frame * 0.1) * 10;
        ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "24px 'Orbitron', sans-serif";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 20;
        ctx.fillText("Press SPACEBAR to resume", canvas.width / 2, canvas.height / 2 + 30);
    }
    else if (gameState === 'gameover') {
        ctx.globalAlpha = 0.9;
        let overlayGradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/2);
        overlayGradient.addColorStop(0, "rgba(0, 0, 0, 0.3)");
        overlayGradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.font = "bold 48px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = matchWinner === "Player" ? "#39ff14" : "#ff006e";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 30 + Math.sin(frame * 0.1) * 10;
        ctx.fillText(
            matchWinner === "Player" ? "VICTORY!" : "GAME OVER!",
            canvas.width / 2,
            canvas.height / 2 - 20
        );
        ctx.font = "24px 'Orbitron', sans-serif";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 20;
        ctx.fillText("Press PLAY AGAIN to continue", canvas.width / 2, canvas.height / 2 + 40);
        centerPlayAgainBtn();
    }
    ctx.restore();
}

function drawEnhancedSkillsUI() {
    ctx.save();
    ctx.font = "bold 18px 'Orbitron', sans-serif";
    ctx.globalAlpha = gameState === 'paused' ? 0.5 : 0.9;
    let x0 = 30;
    let y = canvas.height - 28;
    let dx = 140;
    ctx.textAlign = "left";
    ctx.fillStyle = skillCooldowns[0] > 0 ? '#ff00ea66' : '#00f0ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText("Q: Teleport", x0, y);
    if (skillCooldowns[0] > 0) drawEnhancedCooldownBar(x0 + 90, y - 8, skillCooldowns[0], skillMaxCooldowns[0], '#ff00ea');
    ctx.fillStyle = skillCooldowns[1] > 0 ? '#39ff1466' : '#39ff14';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText("W: Slow Time", x0 + dx, y);
    if (skillCooldowns[1] > 0) drawEnhancedCooldownBar(x0 + dx + 100, y - 8, skillCooldowns[1], skillMaxCooldowns[1], '#39ff14');
    ctx.fillStyle = skillCooldowns[2] > 0 ? '#f7e60066' : '#f7e600';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText("E: Wall", x0 + 2 * dx, y);
    if (skillCooldowns[2] > 0) drawEnhancedCooldownBar(x0 + 2 * dx + 70, y - 8, skillCooldowns[2], skillMaxCooldowns[2], '#f7e600');
    ctx.fillStyle = skillCooldowns[3] > 0 ? '#00ffea66' : '#00ffea';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText("R: +Ball", x0 + 3 * dx - 20, y);
    if (skillCooldowns[3] > 0) drawEnhancedCooldownBar(x0 + 3 * dx + 50, y - 8, skillCooldowns[3], skillMaxCooldowns[3], '#00ffea');
    ctx.restore();
}

function drawEnhancedCooldownBar(x, y, val, max, color) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, 50, 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 50, 12);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillRect(x + 1, y + 1, 48 * (1 - val / max), 10);
    ctx.restore();
}

// --- Main loop ---
function gameLoop() {
    frame++;
    gentlyChangeColors();
    updateCountdown();
    updateDifficultyScaling();
    updateAI();
    updateBalls();
    updateSkillTimers();
    updateParticles();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Start! ---
resetGame();
gameLoop();