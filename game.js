// ===== KINDOM =====
// Main Game JavaScript

// ===== DIFFICULTY SYSTEM =====
let gameDifficulty = 5; // Default: 5 (middle of 1-10 scale) - set by slider

// Difficulty multipliers (1 = very easy, 10 = impossible)
// Wave adds exponential scaling on top of the base difficulty from slider
function getDifficultyMultipliers(wave = 1) {
    const d = gameDifficulty;
    
    // Wave-based scaling - gentler curve that ramps up gradually
    // Reduced exponent from 1.15 to 1.0 (linear) with smaller multiplier
    const waveScaling = 1 + (wave - 1) * 0.015;
    
    return {
        // Enemy health scales from 0.3x (easy) to 2.0x (hard), then multiplied by wave scaling
        enemyHealth: (0.3 + (d - 1) * 0.189) * waveScaling,
        // Enemy damage scales from 0.25x (easy) to 1.5x (hard), then multiplied by wave scaling  
        enemyDamage: (0.25 + (d - 1) * 0.139) * waveScaling,
        // Gold rewards scale from 2.0x (easy) to 0.7x (hard) - more gold on easy
        goldReward: 2.0 - (d - 1) * 0.144,
        // Spawn rate multiplier (higher = slower spawns) from 1.5x (easy) to 0.8x (hard)
        spawnRate: 1.5 - (d - 1) * 0.078,
        // Raw wave scaling for reference
        waveScaling: waveScaling
    };
}

// Calculate shop price multiplier based on wave (increases every 10 waves)
function getShopPriceMultiplier(wave = 1) {
    // Every 10 waves, prices increase exponentially
    // Wave 1-9: 1x, Wave 10-19: ~1.5x, Wave 20-29: ~2.25x, etc.
    const tier = Math.floor(wave / 10);
    return Math.pow(1.5, tier);
}

// ===== SOUND SYSTEM =====
let audioContext = null;
let soundEnabled = true;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playSound(type, volume = 0.3) {
    if (!soundEnabled || !audioContext) return;
    
    try {
        const now = audioContext.currentTime;
        
        switch(type) {
            case 'click':
                // Short click sound
                playTone(800, 0.05, 'square', volume * 0.5, 0, 0.02);
                break;
                
            case 'hover':
                // Soft hover sound
                playTone(600, 0.08, 'sine', volume * 0.2, 0, 0.04);
                break;
                
            case 'titleClick':
                // Majestic chord for title
                playTone(261.63, 0.4, 'sine', volume * 0.4, 0, 0.1); // C4
                playTone(329.63, 0.4, 'sine', volume * 0.3, 0.05, 0.1); // E4
                playTone(392.00, 0.4, 'sine', volume * 0.3, 0.1, 0.1); // G4
                playTone(523.25, 0.5, 'sine', volume * 0.4, 0.15, 0.15); // C5
                break;
                
            case 'waveStart':
                // Epic horn sound
                playTone(196, 0.6, 'sawtooth', volume * 0.3, 0, 0.2); // G3
                playTone(261.63, 0.5, 'sawtooth', volume * 0.25, 0.1, 0.2); // C4
                playTone(329.63, 0.4, 'sawtooth', volume * 0.2, 0.2, 0.15); // E4
                break;
                
            case 'bossWave':
                // Ominous bass for boss wave
                playTone(80, 0.8, 'sawtooth', volume * 0.5, 0, 0.3);
                playTone(100, 0.6, 'sawtooth', volume * 0.4, 0.2, 0.25);
                playTone(65, 0.7, 'sawtooth', volume * 0.5, 0.4, 0.3);
                break;
                
            case 'arrowShoot':
                // Whoosh sound
                playNoise(0.08, volume * 0.15, 2000, 500);
                break;
                
            case 'arrowHit':
                // Thunk impact
                playTone(150, 0.08, 'square', volume * 0.3, 0, 0.02);
                playNoise(0.05, volume * 0.2, 1000, 200);
                break;
                
            case 'enemyHit':
                // Quick hit sound
                playTone(200, 0.06, 'square', volume * 0.25, 0, 0.02);
                break;
                
            case 'enemyKill':
                // Satisfying kill sound
                playTone(400, 0.1, 'square', volume * 0.3, 0, 0.03);
                playTone(500, 0.08, 'square', volume * 0.25, 0.03, 0.03);
                playTone(600, 0.06, 'sine', volume * 0.2, 0.06, 0.04);
                break;
                
            case 'bossKill':
                // Epic kill sound
                playTone(200, 0.3, 'sawtooth', volume * 0.4, 0, 0.1);
                playTone(300, 0.25, 'sawtooth', volume * 0.35, 0.08, 0.1);
                playTone(400, 0.2, 'sawtooth', volume * 0.3, 0.15, 0.1);
                playTone(600, 0.3, 'sine', volume * 0.4, 0.2, 0.15);
                break;
                
            case 'castleHit':
                // Heavy thud
                playTone(80, 0.15, 'square', volume * 0.4, 0, 0.05);
                playTone(60, 0.1, 'sawtooth', volume * 0.3, 0.02, 0.05);
                break;
                
            case 'castleDestroyed':
                // Dramatic destruction
                playTone(100, 0.8, 'sawtooth', volume * 0.5, 0, 0.3);
                playTone(80, 0.6, 'sawtooth', volume * 0.4, 0.2, 0.25);
                playTone(60, 0.5, 'sawtooth', volume * 0.35, 0.4, 0.2);
                playTone(40, 0.4, 'sawtooth', volume * 0.3, 0.6, 0.2);
                playNoise(0.8, volume * 0.3, 500, 50);
                break;
                
            case 'upgrade':
                // Magical upgrade sound
                playTone(523.25, 0.15, 'sine', volume * 0.3, 0, 0.05); // C5
                playTone(659.25, 0.15, 'sine', volume * 0.3, 0.08, 0.05); // E5
                playTone(783.99, 0.2, 'sine', volume * 0.35, 0.15, 0.08); // G5
                playTone(1046.50, 0.25, 'sine', volume * 0.4, 0.22, 0.1); // C6
                break;
                
            case 'legendaryUpgrade':
                // Epic legendary fanfare
                playTone(392, 0.3, 'sine', volume * 0.4, 0, 0.1);
                playTone(523.25, 0.3, 'sine', volume * 0.4, 0.1, 0.1);
                playTone(659.25, 0.3, 'sine', volume * 0.4, 0.2, 0.1);
                playTone(783.99, 0.4, 'sine', volume * 0.5, 0.3, 0.15);
                playTone(1046.50, 0.5, 'sine', volume * 0.5, 0.45, 0.2);
                break;
                
            case 'mysteryBoxOpen':
                // Mysterious opening
                playTone(300, 0.2, 'sine', volume * 0.3, 0, 0.1);
                playTone(400, 0.2, 'sine', volume * 0.3, 0.15, 0.1);
                playTone(350, 0.15, 'sine', volume * 0.25, 0.3, 0.08);
                break;
                
            case 'mysteryBoxReveal':
                // Sparkly reveal
                for (let i = 0; i < 8; i++) {
                    playTone(800 + i * 100, 0.08, 'sine', volume * 0.2, i * 0.04, 0.05);
                }
                playTone(1200, 0.3, 'sine', volume * 0.4, 0.35, 0.15);
                break;
                
            case 'goldEarn':
                // Coin clink
                playTone(1200, 0.06, 'sine', volume * 0.25, 0, 0.02);
                playTone(1400, 0.05, 'sine', volume * 0.2, 0.04, 0.02);
                break;
                
            case 'purchase':
                // Cash register ding
                playTone(880, 0.1, 'sine', volume * 0.3, 0, 0.03);
                playTone(1108.73, 0.15, 'sine', volume * 0.35, 0.08, 0.05);
                break;
                
            case 'error':
                // Error buzz
                playTone(200, 0.15, 'square', volume * 0.25, 0, 0.05);
                playTone(150, 0.15, 'square', volume * 0.25, 0.08, 0.05);
                break;
                
            case 'cardHover':
                // Card slide sound
                playNoise(0.06, volume * 0.1, 3000, 1000);
                playTone(400, 0.05, 'sine', volume * 0.15, 0, 0.03);
                break;
                
            case 'cardUse':
                // Powerful activation
                playTone(300, 0.15, 'sawtooth', volume * 0.3, 0, 0.05);
                playTone(450, 0.15, 'sawtooth', volume * 0.3, 0.05, 0.05);
                playTone(600, 0.2, 'sawtooth', volume * 0.35, 0.1, 0.08);
                playNoise(0.15, volume * 0.2, 2000, 500);
                break;
                
            case 'heal':
                // Healing chime
                playTone(523.25, 0.15, 'sine', volume * 0.3, 0, 0.05);
                playTone(659.25, 0.15, 'sine', volume * 0.3, 0.1, 0.05);
                playTone(783.99, 0.2, 'sine', volume * 0.35, 0.18, 0.08);
                break;
                
            case 'fireball':
                // Whooshing fire
                playNoise(0.3, volume * 0.25, 800, 200);
                playTone(150, 0.25, 'sawtooth', volume * 0.3, 0, 0.1);
                break;
                
            case 'lightning':
                // Electric zap
                playNoise(0.1, volume * 0.35, 4000, 1000);
                playTone(1000, 0.08, 'square', volume * 0.3, 0, 0.02);
                playTone(1500, 0.06, 'square', volume * 0.25, 0.03, 0.02);
                break;
                
            case 'explosion':
                // Boom!
                playTone(80, 0.3, 'sawtooth', volume * 0.4, 0, 0.1);
                playNoise(0.25, volume * 0.35, 500, 100);
                break;
                
            case 'freeze':
                // Icy crystallize
                playTone(2000, 0.15, 'sine', volume * 0.2, 0, 0.05);
                playTone(2500, 0.12, 'sine', volume * 0.18, 0.05, 0.05);
                playTone(3000, 0.1, 'sine', volume * 0.15, 0.1, 0.05);
                break;
                
            case 'vampireBite':
                // Creepy bite
                playTone(150, 0.1, 'sawtooth', volume * 0.25, 0, 0.03);
                playTone(200, 0.15, 'sine', volume * 0.3, 0.05, 0.08);
                break;
                
            case 'ghostAttack':
                // Ethereal whoosh
                playNoise(0.2, volume * 0.15, 3000, 500);
                playTone(400, 0.25, 'sine', volume * 0.2, 0, 0.15);
                playTone(350, 0.2, 'sine', volume * 0.15, 0.1, 0.1);
                break;
                
            case 'demonFire':
                // Demonic flames
                playNoise(0.3, volume * 0.3, 600, 150);
                playTone(120, 0.3, 'sawtooth', volume * 0.35, 0, 0.1);
                playTone(180, 0.2, 'sawtooth', volume * 0.25, 0.1, 0.1);
                break;
                
            case 'golemSmash':
                // Heavy ground pound
                playTone(50, 0.4, 'square', volume * 0.5, 0, 0.15);
                playTone(40, 0.3, 'sawtooth', volume * 0.4, 0.1, 0.1);
                playNoise(0.3, volume * 0.35, 300, 50);
                break;
                
            case 'assassinStrike':
                // Quick blade
                playNoise(0.08, volume * 0.25, 5000, 1500);
                playTone(800, 0.06, 'sawtooth', volume * 0.3, 0, 0.02);
                break;
                
            case 'necroMagic':
                // Dark magic
                playTone(150, 0.3, 'sawtooth', volume * 0.3, 0, 0.1);
                playTone(200, 0.25, 'square', volume * 0.25, 0.1, 0.1);
                playTone(100, 0.2, 'sawtooth', volume * 0.2, 0.2, 0.1);
                break;
                
            case 'divineShield':
                // Angelic protection
                playTone(600, 0.2, 'sine', volume * 0.3, 0, 0.08);
                playTone(800, 0.2, 'sine', volume * 0.35, 0.1, 0.08);
                playTone(1000, 0.3, 'sine', volume * 0.4, 0.2, 0.15);
                playTone(1200, 0.4, 'sine', volume * 0.35, 0.3, 0.2);
                break;
                
            case 'timeWarp':
                // Time slow effect
                playTone(400, 0.5, 'sine', volume * 0.25, 0, 0.2);
                playTone(350, 0.4, 'sine', volume * 0.2, 0.1, 0.2);
                playTone(300, 0.3, 'sine', volume * 0.15, 0.2, 0.15);
                break;
                
            case 'powerUp':
                // Generic power up
                playTone(400, 0.1, 'square', volume * 0.25, 0, 0.03);
                playTone(600, 0.1, 'square', volume * 0.3, 0.05, 0.03);
                playTone(800, 0.15, 'square', volume * 0.35, 0.1, 0.05);
                break;
        }
    } catch (e) {
        console.warn('Sound playback failed:', e);
    }
}

function playTone(frequency, duration, type, volume, delay = 0, fadeOut = 0.1) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
    
    const startTime = audioContext.currentTime + delay;
    const endTime = startTime + duration;
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.setValueAtTime(volume, endTime - fadeOut);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
    
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.1);
}

function playNoise(duration, volume, highFreq = 2000, lowFreq = 200) {
    if (!audioContext) return;
    
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (highFreq + lowFreq) / 2;
    filter.Q.value = 0.5;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    noise.start();
    noise.stop(audioContext.currentTime + duration);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    updateSoundButtons();
    if (soundEnabled) {
        initAudio();
        playSound('click');
    }
}

function updateSoundButtons() {
    const homeBtn = document.getElementById('soundToggleHome');
    const pauseBtn = document.getElementById('soundTogglePause');
    
    if (homeBtn) {
        homeBtn.textContent = soundEnabled ? '🔊' : '🔇';
        homeBtn.classList.toggle('muted', !soundEnabled);
    }
    if (pauseBtn) {
        pauseBtn.textContent = soundEnabled ? '🔊 Sound: On' : '🔇 Sound: Off';
        pauseBtn.classList.toggle('muted', !soundEnabled);
    }
}

// ===== ENHANCED VISUAL EFFECTS SYSTEM =====

// Castle visual state management
function updateCastleVisuals() {
    // Guard against null castle element
    if (!castle) return;
    
    const healthPercent = (gameState.castle.health / gameState.stats.maxHealth) * 100;
    const upgradeCount = gameState.earnedUpgrades.length;
    
    // Remove all damage classes
    castle.classList.remove('damaged-light', 'damaged-medium', 'damaged-heavy', 'damaged-critical');
    
    // Add appropriate damage class based on health (only if below threshold)
    if (healthPercent <= 15) {
        castle.classList.add('damaged-critical');
    } else if (healthPercent <= 35) {
        castle.classList.add('damaged-heavy');
    } else if (healthPercent <= 60) {
        castle.classList.add('damaged-medium');
    } else if (healthPercent <= 85) {
        castle.classList.add('damaged-light');
    }
    // If healthPercent > 85, no damage class is added (healthy castle)
    
    // Update upgrade tier glow
    castle.classList.remove('upgraded-tier1', 'upgraded-tier2', 'upgraded-tier3', 'upgraded-tier4');
    if (upgradeCount >= 20) {
        castle.classList.add('upgraded-tier4');
    } else if (upgradeCount >= 12) {
        castle.classList.add('upgraded-tier3');
    } else if (upgradeCount >= 6) {
        castle.classList.add('upgraded-tier2');
    } else if (upgradeCount >= 3) {
        castle.classList.add('upgraded-tier1');
    }
    
    // Magic aura if has magic abilities
    if (gameState.stats.hasFireball || gameState.stats.hasLightning || gameState.stats.hasMeteor) {
        castle.classList.add('has-magic');
    } else {
        castle.classList.remove('has-magic');
    }
    
    // Update floating orbs based on abilities
    updateCastleOrbs();
}

function updateCastleOrbs() {
    const orbsContainer = document.getElementById('castleOrbs');
    if (!orbsContainer) return;
    
    orbsContainer.innerHTML = '';
    
    const orbs = [];
    if (gameState.stats.hasFireball) orbs.push({ type: 'fire', icon: '🔥' });
    if (gameState.stats.hasLightning) orbs.push({ type: 'lightning', icon: '⚡' });
    if (gameState.stats.hasMeteor) orbs.push({ type: 'meteor', icon: '☄️' });
    if (gameState.stats.freezeChance > 0) orbs.push({ type: 'ice', icon: '❄️' });
    if (gameState.stats.regen > 0) orbs.push({ type: 'heal', icon: '💚' });
    
    orbs.forEach((orb, index) => {
        const orbEl = document.createElement('div');
        orbEl.className = `floating-orb ${orb.type}`;
        orbEl.textContent = orb.icon;
        orbEl.style.setProperty('--angle', `${(360 / orbs.length) * index}deg`);
        orbsContainer.appendChild(orbEl);
    });
}

// Create visual effects at position
function createVisualEffect(x, y, type, options = {}) {
    const effectsLayer = document.getElementById('effectsLayer') || gameArena;
    if (!effectsLayer) return null;
    
    const effect = document.createElement('div');
    
    switch (type) {
        case 'lightning-strike':
            effect.className = 'lightning-strike';
            effect.style.left = x + 'px';
            effect.style.top = '0';
            effect.style.height = y + 'px';
            playSound('lightning');
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 500);
            return effect;
            
        case 'lightning-chain':
            // Draw line between two points
            const x2 = options.targetX || x;
            const y2 = options.targetY || y;
            const dx = x2 - x;
            const dy = y2 - y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            effect.className = 'lightning-chain';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            effect.style.width = length + 'px';
            effect.style.transform = `rotate(${angle}deg)`;
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 400);
            return effect;
            
        case 'meteor-impact':
            effect.className = 'meteor-impact';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            playSound('explosion');
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 700);
            return effect;
            
        case 'heal':
            effect.className = 'heal-effect';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            // Add floating particles
            for (let i = 0; i < 8; i++) {
                const particle = document.createElement('div');
                particle.className = 'heal-particles';
                particle.style.left = (x + (Math.random() - 0.5) * 60) + 'px';
                particle.style.top = (y + 20) + 'px';
                particle.style.animationDelay = (i * 0.1) + 's';
                effectsLayer.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 1100);
            return effect;
            
        case 'divine-aura':
            effect.className = 'divine-aura';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 2000);
            return effect;
            
        case 'freeze':
            effect.className = 'freeze-effect';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            playSound('freeze');
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 600);
            return effect;
            
        case 'poison-cloud':
            effect.className = 'poison-cloud';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            setTimeout(() => effect.remove(), options.duration || 3000);
            effectsLayer.appendChild(effect);
            return effect; // Return for poison tick management
            
        case 'screen-flash':
            effect.className = `card-flash-screen ${options.color || 'fire'}`;
            document.body.appendChild(effect);
            setTimeout(() => effect.remove(), 500);
            return effect;
            
        case 'energy-ring':
            effect.className = `energy-ring ${options.color || 'fire'}`;
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 700);
            return effect;
            
        case 'card-burst':
            effect.className = 'card-activation-burst';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            effect.setAttribute('data-icon', options.icon || '✨');
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 900);
            return effect;
            
        case 'dragon-breath':
            effect.className = 'dragon-breath-effect';
            effect.style.left = x + 'px';
            effect.style.top = y + 'px';
            effect.style.transform = `rotate(${options.angle || 0}deg)`;
            effectsLayer.appendChild(effect);
            setTimeout(() => effect.remove(), 1100);
            return effect;
            
        case 'time-warp':
            effect.className = 'time-warp-effect';
            document.body.appendChild(effect);
            setTimeout(() => effect.remove(), options.duration || 5000);
            return effect;
            
        default:
            return null;
    }
    
    effectsLayer.appendChild(effect);
    
    // Auto-remove after animation
    const duration = options.duration || 1000;
    setTimeout(() => effect.remove(), duration);
    
    return effect;
}

// Create enemy attack visual effects
function createEnemyAttackEffect(enemy, castleX, castleY) {
    const effectsLayer = document.getElementById('effectsLayer') || gameArena;
    if (!effectsLayer) return;
    
    const effect = document.createElement('div');
    
    const enemyType = enemy.type.replace('elite_', '').replace('boss_', '');
    
    switch (enemyType) {
        case 'orc':
            effect.className = 'enemy-attack-melee';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            break;
            
        case 'goblin':
            // Goblin shoots an arrow projectile
            createEnemyProjectile(enemy.x, enemy.y, castleX, castleY, 'arrow');
            return;
            
        case 'troll':
            effect.className = 'enemy-attack-smash';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            playSound('explosion');
            break;
            
        case 'vampire':
            effect.className = 'enemy-attack-bite';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            break;
            
        case 'ghost':
            effect.className = 'enemy-attack-phase';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            break;
            
        case 'demon':
            effect.className = 'enemy-attack-fire';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            playSound('fireball');
            break;
            
        case 'necromancer':
            effect.className = 'enemy-attack-dark';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            break;
            
        case 'golem':
            effect.className = 'enemy-attack-pound';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            playSound('explosion');
            break;
            
        case 'assassin':
            effect.className = 'enemy-attack-swift';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
            break;
            
        default:
            effect.className = 'enemy-attack-melee';
            effect.style.left = castleX + 'px';
            effect.style.top = castleY + 'px';
    }
    
    effectsLayer.appendChild(effect);
    setTimeout(() => effect.remove(), 600);
}

// Create enemy projectile (like goblin arrows)
function createEnemyProjectile(startX, startY, targetX, targetY, type) {
    if (!gameArena) return;
    
    const proj = document.createElement('div');
    proj.className = `enemy-projectile ${type}`;
    proj.style.left = startX + 'px';
    proj.style.top = startY + 'px';
    
    // Calculate angle
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    proj.style.transform = `rotate(${angle}deg)`;
    
    gameArena.appendChild(proj);
    
    // Animate projectile
    const speed = 8;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = dist / speed * 16; // ms
    
    let progress = 0;
    const animate = () => {
        progress += 16;
        const t = progress / duration;
        
        if (t >= 1) {
            proj.remove();
            return;
        }
        
        proj.style.left = (startX + dx * t) + 'px';
        proj.style.top = (startY + dy * t) + 'px';
        
        requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
    playSound('arrowShoot');
}

// Enhanced action card activation effects
function createCardActivationEffect(card, castleX, castleY) {
    // Full screen flash based on card type
    let flashType = 'fire';
    if (card.id.includes('heal') || card.id.includes('regen')) flashType = 'heal';
    else if (card.id.includes('lightning')) flashType = 'lightning';
    else if (card.id.includes('freeze') || card.id.includes('ice')) flashType = 'freeze';
    else if (card.id.includes('invincib') || card.id.includes('divine')) flashType = 'divine';
    
    createVisualEffect(0, 0, 'screen-flash', { color: flashType });
    
    // Card icon burst at castle
    createVisualEffect(castleX, castleY, 'card-burst', { icon: card.icon });
    
    // Energy ring
    createVisualEffect(castleX, castleY, 'energy-ring', { color: flashType });
}

// ===== PATCH NOTES DATA =====
const PATCH_NOTES = [
    {
        version: "1.4.0",
        title: "Visual Spectacle Update",
        date: "January 9, 2026",
        changes: [
            "🏰 Castle now visually changes with upgrades - glowing auras, floating orbs, and tier effects!",
            "🔥 Castle shows damage states - cracks, fire, and smoke as health drops!",
            "⚡ Enhanced lightning effects - visible chain lightning arcs between enemies",
            "☄️ Meteor impact effects for fireballs and explosive arrows",
            "💚 Healing magic now shows sparkles and healing rings",
            "✨ Divine aura effects for invincibility and shields",
            "❄️ Freeze effects with ice crystals on frozen enemies",
            "👹 Each enemy type now has unique attack visuals (demon fire, vampire bite, ghost phase, etc.)",
            "🃏 Dramatic action card activation effects with screen flashes and energy bursts",
            "🔊 New sound effects for all enemy attacks and abilities",
            "🎇 Dragon breath cone effect and time warp visual distortion"
        ]
    },
    {
        version: "1.3.0",
        title: "Curses & Chaos Update",
        date: "January 9, 2026",
        changes: [
            "💀 New debuff card system - 15% chance per wave to face a curse instead of upgrades!",
            "🔮 Devastating debuffs - 5% chance mystery boxes contain a powerful curse",
            "👻 6 new enemy types: Vampire, Ghost, Demon, Necromancer, Golem, Assassin",
            "⚔️ 15+ new upgrades across all rarities (Gold Find, Poison, Dodge, Splash, and more)",
            "🃏 4 new action cards: Gold Rush, Battle Cry, Poison Cloud, Summon Knight",
            "🎁 Mystery box limit reduced to 3 per wave for balanced gameplay",
            "💀 Menacing curse animations with dark particles and skull effects",
            "⚡ New devastating debuffs: Cursed Gold, Shattered Walls, Doom Curse, and more"
        ]
    },
    {
        version: "1.2.0",
        title: "Difficulty & Strategy Update",
        date: "January 9, 2026",
        changes: [
            "🎚️ New difficulty slider on homescreen (1-10 scale for balanced gameplay)",
            "📈 Wave-based exponential difficulty scaling - enemies get stronger every wave",
            "🎯 Manual targeting system - click and hold on the map to prioritize targets",
            "💰 Shop prices scale exponentially every 10 waves (waves 10+, 20+, etc.)",
            "👹 More enemies spawn every 5 waves (waves 5, 10, 15...)",
            "⏱️ Waves take longer every 5 waves - enemies spawn more spread out",
            "🎁 Mystery box limit: max 5 per wave (resets each wave)",
            "🎨 Enhanced UI with pulsing target indicator and smoother animations"
        ]
    },
    {
        version: "1.1.0",
        title: "Sound & Polish Update",
        date: "January 9, 2026",
        changes: [
            "🔊 Added comprehensive sound effects for all actions",
            "🎵 Procedurally generated audio using Web Audio API",
            "🔇 Added sound toggle button on homescreen and pause menu",
            "🃏 Action cards now have hover and activation sounds",
            "💥 Enemy attacks now have visual and audio feedback",
            "⚡ Improved difficulty scaling for later waves",
            "🎯 Arrows now point toward their targets",
            "🛠️ Various UI and polish improvements"
        ]
    },
    {
        version: "1.0.0",
        title: "Launch Day",
        date: "January 9, 2026",
        changes: [
            "🏰 Welcome to Kindom! Defend your castle against endless enemy hordes!",
            "⚔️ Auto-attacking castle with upgradeable weapons",
            "🎁 Choose from 30+ unique upgrades with 5 rarity tiers",
            "🃏 Collect and use powerful one-time Action Cards",
            "👹 More enemy types and larger hordes as waves climb",
            "🔮 Magic abilities including Fireball and Chain Lightning",
            "🛡️ Defensive upgrades including shields and armor",
            "🛒 Shop system with repairs and mystery box gambling",
            "🎨 Beautiful dark rustic medieval theme"
        ]
    }
];

// ===== LOADING MESSAGES =====
const LOADING_MESSAGES = [
    "Forging weapons...",
    "Sharpening swords...",
    "Raising the drawbridge...",
    "Summoning defenders...",
    "Preparing the armory...",
    "Lighting the torches...",
    "Fortifying the walls...",
    "Training archers...",
    "Brewing potions...",
    "Awakening the castle..."
];

// ===== RARITY DEFINITIONS =====
const RARITIES = {
    common: { name: 'Common', color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.2)', borderColor: '#6B7280' },
    uncommon: { name: 'Uncommon', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#16A34A' },
    rare: { name: 'Rare', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#2563EB' },
    epic: { name: 'Epic', color: '#A855F7', bgColor: 'rgba(168, 85, 247, 0.2)', borderColor: '#9333EA' },
    legendary: { name: 'Legendary', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#D97706' }
};

// ===== ACTION CARDS (Consumable) =====
const ACTION_CARDS = {
    // Common Action Cards
    arrow_volley_c: { id: 'arrow_volley_c', name: 'Arrow Volley', icon: '🏹', rarity: 'common', desc: 'Fire 10 arrows at random enemies', effect: () => { useArrowVolley(10); } },
    quick_heal_c: { id: 'quick_heal_c', name: 'Quick Heal', icon: '💊', rarity: 'common', desc: 'Instantly heal 20 HP', effect: () => { healCastle(20); } },
    
    // Uncommon Action Cards
    arrow_storm_u: { id: 'arrow_storm_u', name: 'Arrow Storm', icon: '🌧️', rarity: 'uncommon', desc: 'Fire 20 arrows at random enemies', effect: () => { useArrowVolley(20); } },
    shield_bash_u: { id: 'shield_bash_u', name: 'Shield Bash', icon: '🛡️', rarity: 'uncommon', desc: 'Push all enemies back and stun for 2s', effect: () => { useShieldBash(); } },
    heal_wave_u: { id: 'heal_wave_u', name: 'Healing Wave', icon: '💚', rarity: 'uncommon', desc: 'Heal 40 HP instantly', effect: () => { healCastle(40); } },
    
    // Rare Action Cards
    flame_burst_r: { id: 'flame_burst_r', name: 'Flame Burst', icon: '🔥', rarity: 'rare', desc: 'Unleash 5 fireballs at nearest enemies', effect: () => { useMultiFireball(5); } },
    ice_storm_r: { id: 'ice_storm_r', name: 'Ice Storm', icon: '❄️', rarity: 'rare', desc: 'Freeze all enemies for 3 seconds', effect: () => { useFreezeAll(3000); } },
    lightning_storm_r: { id: 'lightning_storm_r', name: 'Lightning Storm', icon: '⚡', rarity: 'rare', desc: 'Strike 8 enemies with lightning', effect: () => { useLightningStorm(8); } },
    
    // Epic Action Cards
    dragons_breath_e: { id: 'dragons_breath_e', name: "Dragon's Breath", icon: '🐉', rarity: 'epic', desc: 'Massive fire wave dealing 150 damage to all', effect: () => { useDragonBreath(150); } },
    divine_shield_e: { id: 'divine_shield_e', name: 'Divine Shield', icon: '✨', rarity: 'epic', desc: 'Become invincible for 5 seconds', effect: () => { useInvincibility(5000); } },
    time_warp_e: { id: 'time_warp_e', name: 'Time Warp', icon: '⏰', rarity: 'epic', desc: 'Slow all enemies by 80% for 5 seconds', effect: () => { useTimeWarp(5000); } },
    
    // Legendary Action Cards
    apocalypse_l: { id: 'apocalypse_l', name: 'Apocalypse', icon: '☄️', rarity: 'legendary', desc: 'Rain meteors dealing 300 damage to all enemies', effect: () => { useApocalypse(300); } },
    phoenix_rebirth_l: { id: 'phoenix_rebirth_l', name: 'Phoenix Rebirth', icon: '🔆', rarity: 'legendary', desc: 'Fully heal and gain 50% damage boost for 10s', effect: () => { usePhoenixRebirth(); } },
    
    // More Action Cards
    gold_rush_c: { id: 'gold_rush_c', name: 'Gold Rush', icon: '💰', rarity: 'common', desc: 'Gain 30 gold instantly', effect: () => { gameState.gold += 30; updateGoldDisplay(); } },
    battle_cry_u: { id: 'battle_cry_u', name: 'Battle Cry', icon: '📯', rarity: 'uncommon', desc: '+30% damage for 8 seconds', effect: () => { useBattleCry(8000, 1.3); } },
    poison_cloud_r: { id: 'poison_cloud_r', name: 'Poison Cloud', icon: '☠️', rarity: 'rare', desc: 'All enemies take 5 damage per second for 5s', effect: () => { usePoisonCloud(5, 5000); } },
    summon_knight_e: { id: 'summon_knight_e', name: 'Summon Knight', icon: '🗡️', rarity: 'epic', desc: 'A knight fights for you for 10 seconds', effect: () => { useSummonKnight(10000); } }
};

// ===== DEBUFF CARDS (Curses) =====
// Regular debuffs (from wave selection)
const DEBUFF_CARDS = {
    // Minor debuffs
    rusty_arrows: { id: 'rusty_arrows', name: 'Rusty Arrows', icon: '🔩', desc: '-15% arrow damage', severity: 'minor', effect: () => { gameState.stats.damage *= 0.85; } },
    sluggish: { id: 'sluggish', name: 'Sluggish', icon: '🐌', desc: '-12% attack speed', severity: 'minor', effect: () => { gameState.stats.attackSpeed *= 0.88; } },
    cracked_walls: { id: 'cracked_walls', name: 'Cracked Walls', icon: '🧱', desc: '-20 max health', severity: 'minor', effect: () => { gameState.stats.maxHealth = Math.max(50, gameState.stats.maxHealth - 20); gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth); updateHealthBar(); } },
    weak_armor: { id: 'weak_armor', name: 'Weak Armor', icon: '🩹', desc: '+8% damage taken', severity: 'minor', effect: () => { gameState.stats.armor = Math.max(0, gameState.stats.armor - 0.08); } },
    blurry_vision: { id: 'blurry_vision', name: 'Blurry Vision', icon: '👁️', desc: '-8% critical chance', severity: 'minor', effect: () => { gameState.stats.critChance = Math.max(0, gameState.stats.critChance - 0.08); } },
    
    // Moderate debuffs
    enemy_haste: { id: 'enemy_haste', name: 'Enemy Haste', icon: '💨', desc: 'Enemies move 20% faster this run', severity: 'moderate', effect: () => { gameState.stats.enemySpeedDebuff = (gameState.stats.enemySpeedDebuff || 1) * 1.2; } },
    gold_tax: { id: 'gold_tax', name: 'Gold Tax', icon: '💸', desc: 'Lose 30% of current gold', severity: 'moderate', effect: () => { gameState.gold = Math.floor(gameState.gold * 0.7); updateGoldDisplay(); } },
    frail_castle: { id: 'frail_castle', name: 'Frail Castle', icon: '🏚️', desc: '-40 max health', severity: 'moderate', effect: () => { gameState.stats.maxHealth = Math.max(50, gameState.stats.maxHealth - 40); gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth); updateHealthBar(); } },
    dull_blades: { id: 'dull_blades', name: 'Dull Blades', icon: '🗡️', desc: '-25% arrow damage', severity: 'moderate', effect: () => { gameState.stats.damage *= 0.75; } },
    slow_reflexes: { id: 'slow_reflexes', name: 'Slow Reflexes', icon: '⏰', desc: '-20% attack speed', severity: 'moderate', effect: () => { gameState.stats.attackSpeed *= 0.8; } }
};

// Devastating debuffs (from mystery boxes only)
const DEVASTATING_DEBUFFS = {
    cursed_gold: { id: 'cursed_gold', name: 'Cursed Gold', icon: '💀', desc: 'Lose 60% of all gold', severity: 'devastating', effect: () => { gameState.gold = Math.floor(gameState.gold * 0.4); updateGoldDisplay(); } },
    shattered_walls: { id: 'shattered_walls', name: 'Shattered Walls', icon: '💔', desc: '-80 max health immediately', severity: 'devastating', effect: () => { gameState.stats.maxHealth = Math.max(50, gameState.stats.maxHealth - 80); gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth); updateHealthBar(); } },
    weakened_arms: { id: 'weakened_arms', name: 'Weakened Arms', icon: '😫', desc: '-40% arrow damage', severity: 'devastating', effect: () => { gameState.stats.damage *= 0.6; } },
    broken_bow: { id: 'broken_bow', name: 'Broken Bow', icon: '🏹', desc: '-35% attack speed', severity: 'devastating', effect: () => { gameState.stats.attackSpeed *= 0.65; } },
    enemy_fury: { id: 'enemy_fury', name: 'Enemy Fury', icon: '😡', desc: 'All enemies deal +30% damage', severity: 'devastating', effect: () => { gameState.stats.enemyDamageDebuff = (gameState.stats.enemyDamageDebuff || 1) * 1.3; } },
    doom_curse: { id: 'doom_curse', name: 'Doom Curse', icon: '☠️', desc: 'Take 50 damage immediately', severity: 'devastating', effect: () => { gameState.castle.health = Math.max(1, gameState.castle.health - 50); updateHealthBar(); } }
};

// ===== UPGRADE DEFINITIONS =====
const UPGRADES = {
    // === COMMON UPGRADES ===
    // Weapon - Common
    damage_c: { id: 'damage_c', name: 'Sharp Arrows', icon: '🏹', type: 'weapon', rarity: 'common', desc: '+10% arrow damage', effect: () => { gameState.stats.damage *= 1.1; }, repeatable: true },
    attackSpeed_c: { id: 'attackSpeed_c', name: 'Quick Hands', icon: '✋', type: 'weapon', rarity: 'common', desc: '+8% attack speed', effect: () => { gameState.stats.attackSpeed *= 1.08; }, repeatable: true },
    // Defense - Common
    health_c: { id: 'health_c', name: 'Wooden Planks', icon: '🪵', type: 'defense', rarity: 'common', desc: '+15 max health', effect: () => { gameState.stats.maxHealth += 15; gameState.castle.health += 15; }, repeatable: true },
    armor_c: { id: 'armor_c', name: 'Leather Padding', icon: '🧥', type: 'defense', rarity: 'common', desc: '-5% damage taken', effect: () => { gameState.stats.armor += 0.05; }, repeatable: true },
    // Magic - Common  
    slow_c: { id: 'slow_c', name: 'Chilling Touch', icon: '🌬️', type: 'magic', rarity: 'common', desc: '10% chance to slow enemies', effect: () => { gameState.stats.freezeChance = Math.min(0.5, gameState.stats.freezeChance + 0.1); }, repeatable: true },

    // === UNCOMMON UPGRADES ===
    // Weapon - Uncommon
    damage_u: { id: 'damage_u', name: 'Steel Tips', icon: '🗡️', type: 'weapon', rarity: 'uncommon', desc: '+20% arrow damage', effect: () => { gameState.stats.damage *= 1.2; }, repeatable: true },
    attackSpeed_u: { id: 'attackSpeed_u', name: 'Quick Draw', icon: '⚡', type: 'weapon', rarity: 'uncommon', desc: '+15% attack speed', effect: () => { gameState.stats.attackSpeed *= 1.15; }, repeatable: true },
    critChance_u: { id: 'critChance_u', name: 'Keen Eye', icon: '👁️', type: 'weapon', rarity: 'uncommon', desc: '+5% critical chance', effect: () => { gameState.stats.critChance += 0.05; }, repeatable: true },
    // Defense - Uncommon
    health_u: { id: 'health_u', name: 'Fortify Walls', icon: '🧱', type: 'defense', rarity: 'uncommon', desc: '+30 max health', effect: () => { gameState.stats.maxHealth += 30; gameState.castle.health += 30; }, repeatable: true },
    armor_u: { id: 'armor_u', name: 'Iron Plates', icon: '🛡️', type: 'defense', rarity: 'uncommon', desc: '-10% damage taken', effect: () => { gameState.stats.armor += 0.10; }, repeatable: true },
    regen_u: { id: 'regen_u', name: 'Healing Moss', icon: '🌿', type: 'defense', rarity: 'uncommon', desc: 'Regenerate 0.5 HP/sec', effect: () => { gameState.stats.regen += 0.5; }, repeatable: true },
    // Magic - Uncommon
    piercing_u: { id: 'piercing_u', name: 'Piercing Shot', icon: '📌', type: 'magic', rarity: 'uncommon', desc: 'Arrows pierce 1 enemy', effect: () => { gameState.stats.pierce = (gameState.stats.pierce || 0) + 1; } },

    // === RARE UPGRADES ===
    // Weapon - Rare
    damage_r: { id: 'damage_r', name: 'Enchanted Arrows', icon: '✨', type: 'weapon', rarity: 'rare', desc: '+35% arrow damage', effect: () => { gameState.stats.damage *= 1.35; }, repeatable: true },
    attackSpeed_r: { id: 'attackSpeed_r', name: 'Rapid Fire', icon: '💨', type: 'weapon', rarity: 'rare', desc: '+25% attack speed', effect: () => { gameState.stats.attackSpeed *= 1.25; }, repeatable: true },
    critChance_r: { id: 'critChance_r', name: 'Deadly Aim', icon: '💀', type: 'weapon', rarity: 'rare', desc: '+10% critical chance', effect: () => { gameState.stats.critChance += 0.1; }, repeatable: true },
    critDamage_r: { id: 'critDamage_r', name: 'Brutal Force', icon: '💥', type: 'weapon', rarity: 'rare', desc: '+40% critical damage', effect: () => { gameState.stats.critDamage += 0.4; }, repeatable: true },
    multishot_r: { id: 'multishot_r', name: 'Multi-Shot', icon: '🎯', type: 'weapon', rarity: 'rare', desc: 'Fire +1 arrow at once', effect: () => { gameState.stats.projectiles += 1; }, repeatable: true },
    // Defense - Rare
    health_r: { id: 'health_r', name: 'Stone Walls', icon: '🏯', type: 'defense', rarity: 'rare', desc: '+50 max health', effect: () => { gameState.stats.maxHealth += 50; gameState.castle.health += 50; }, repeatable: true },
    armor_r: { id: 'armor_r', name: 'Steel Fortress', icon: '🏰', type: 'defense', rarity: 'rare', desc: '-15% damage taken', effect: () => { gameState.stats.armor += 0.15; }, repeatable: true },
    regen_r: { id: 'regen_r', name: 'Healing Aura', icon: '💚', type: 'defense', rarity: 'rare', desc: 'Regenerate 1 HP/sec', effect: () => { gameState.stats.regen += 1; }, repeatable: true },
    thorns_r: { id: 'thorns_r', name: 'Thorns', icon: '🌹', type: 'defense', rarity: 'rare', desc: 'Deal 15 damage when hit', effect: () => { gameState.stats.thorns += 15; }, repeatable: true },
    // Magic - Rare
    fireball_r: { id: 'fireball_r', name: 'Fireball', icon: '🔥', type: 'magic', rarity: 'rare', desc: 'Unlock explosive fireballs', effect: () => { gameState.stats.hasFireball = true; } },
    freeze_r: { id: 'freeze_r', name: 'Frost Nova', icon: '❄️', type: 'magic', rarity: 'rare', desc: '30% chance to slow enemies', effect: () => { gameState.stats.freezeChance = Math.min(0.6, gameState.stats.freezeChance + 0.3); } },

    // === EPIC UPGRADES ===
    // Weapon - Epic
    damage_e: { id: 'damage_e', name: 'Dragon Arrows', icon: '🐉', type: 'weapon', rarity: 'epic', desc: '+50% arrow damage', effect: () => { gameState.stats.damage *= 1.5; }, repeatable: true },
    critChance_e: { id: 'critChance_e', name: 'Assassin\'s Mark', icon: '🗡️', type: 'weapon', rarity: 'epic', desc: '+15% critical chance', effect: () => { gameState.stats.critChance += 0.15; }, repeatable: true },
    critDamage_e: { id: 'critDamage_e', name: 'Executioner', icon: '⚔️', type: 'weapon', rarity: 'epic', desc: '+75% critical damage', effect: () => { gameState.stats.critDamage += 0.75; }, repeatable: true },
    // Defense - Epic
    health_e: { id: 'health_e', name: 'Titan Walls', icon: '🗿', type: 'defense', rarity: 'epic', desc: '+80 max health', effect: () => { gameState.stats.maxHealth += 80; gameState.castle.health += 80; }, repeatable: true },
    lifeSteal_e: { id: 'lifeSteal_e', name: 'Vampiric Arrows', icon: '🧛', type: 'defense', rarity: 'epic', desc: 'Heal 5% of damage dealt', effect: () => { gameState.stats.lifeSteal = (gameState.stats.lifeSteal || 0) + 0.05; } },
    // Magic - Epic
    lightning_e: { id: 'lightning_e', name: 'Chain Lightning', icon: '⚡', type: 'magic', rarity: 'epic', desc: 'Lightning chains to 3 enemies', effect: () => { gameState.stats.hasLightning = true; } },
    explosion_e: { id: 'explosion_e', name: 'Explosive Arrows', icon: '💣', type: 'magic', rarity: 'epic', desc: 'Arrows explode on impact', effect: () => { gameState.stats.explosiveArrows = true; } },

    // === LEGENDARY UPGRADES ===
    // Weapon - Legendary
    damage_l: { id: 'damage_l', name: 'Divine Arrows', icon: '🌟', type: 'weapon', rarity: 'legendary', desc: '+100% arrow damage', effect: () => { gameState.stats.damage *= 2; } },
    multishot_l: { id: 'multishot_l', name: 'Arrow Storm', icon: '🌪️', type: 'weapon', rarity: 'legendary', desc: 'Fire +3 arrows at once', effect: () => { gameState.stats.projectiles += 3; } },
    // Defense - Legendary
    invincible_l: { id: 'invincible_l', name: 'Divine Shield', icon: '👼', type: 'defense', rarity: 'legendary', desc: '20% chance to block all damage', effect: () => { gameState.stats.blockChance = (gameState.stats.blockChance || 0) + 0.2; } },
    health_l: { id: 'health_l', name: 'Eternal Fortress', icon: '🌌', type: 'defense', rarity: 'legendary', desc: '+150 max health', effect: () => { gameState.stats.maxHealth += 150; gameState.castle.health += 150; } },
    // Magic - Legendary
    meteor_l: { id: 'meteor_l', name: 'Meteor Strike', icon: '☄️', type: 'magic', rarity: 'legendary', desc: 'Meteors rain on enemies', effect: () => { gameState.stats.hasMeteor = true; } },
    vortex_l: { id: 'vortex_l', name: 'Void Vortex', icon: '🌀', type: 'magic', rarity: 'legendary', desc: 'Pull enemies together', effect: () => { gameState.stats.hasVortex = true; } },
    
    // === NEW UPGRADES ===
    // Common - new
    gold_find_c: { id: 'gold_find_c', name: 'Gold Finder', icon: '🪙', type: 'utility', rarity: 'common', desc: '+10% gold from kills', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 1.1; }, repeatable: true },
    range_c: { id: 'range_c', name: 'Long Bow', icon: '🎯', type: 'weapon', rarity: 'common', desc: '+10% arrow range', effect: () => { gameState.stats.arrowSpeed = (gameState.stats.arrowSpeed || 1) * 1.1; }, repeatable: true },
    
    // Uncommon - new
    poison_u: { id: 'poison_u', name: 'Poison Tips', icon: '☠️', type: 'magic', rarity: 'uncommon', desc: 'Arrows deal +5 poison damage over 3s', effect: () => { gameState.stats.poisonDamage = (gameState.stats.poisonDamage || 0) + 5; }, repeatable: true },
    dodge_u: { id: 'dodge_u', name: 'Reinforced Gates', icon: '🚪', type: 'defense', rarity: 'uncommon', desc: '5% chance to dodge attacks', effect: () => { gameState.stats.dodgeChance = (gameState.stats.dodgeChance || 0) + 0.05; }, repeatable: true },
    gold_find_u: { id: 'gold_find_u', name: 'Treasure Hunter', icon: '💎', type: 'utility', rarity: 'uncommon', desc: '+20% gold from kills', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 1.2; }, repeatable: true },
    
    // Rare - new
    splash_r: { id: 'splash_r', name: 'Splash Damage', icon: '💦', type: 'magic', rarity: 'rare', desc: 'Arrows deal 30% damage to nearby enemies', effect: () => { gameState.stats.splashDamage = (gameState.stats.splashDamage || 0) + 0.3; } },
    execute_r: { id: 'execute_r', name: 'Execute', icon: '⚰️', type: 'weapon', rarity: 'rare', desc: 'Deal +50% damage to enemies below 25% HP', effect: () => { gameState.stats.executeDamage = (gameState.stats.executeDamage || 0) + 0.5; } },
    reflect_r: { id: 'reflect_r', name: 'Magic Mirror', icon: '🪞', type: 'defense', rarity: 'rare', desc: 'Reflect 20% of ranged damage', effect: () => { gameState.stats.reflectDamage = (gameState.stats.reflectDamage || 0) + 0.2; } },
    
    // Epic - new
    berserker_e: { id: 'berserker_e', name: 'Berserker', icon: '🔥', type: 'weapon', rarity: 'epic', desc: '+1% damage per 1% missing health', effect: () => { gameState.stats.hasBerserker = true; } },
    guardian_e: { id: 'guardian_e', name: 'Guardian Angel', icon: '👼', type: 'defense', rarity: 'epic', desc: 'Survive lethal damage once per wave', effect: () => { gameState.stats.hasGuardian = true; } },
    gold_rush_e: { id: 'gold_rush_e', name: 'Midas Touch', icon: '👑', type: 'utility', rarity: 'epic', desc: '+50% gold from all sources', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 1.5; } },
    
    // Legendary - new
    infinity_l: { id: 'infinity_l', name: 'Infinity', icon: '♾️', type: 'weapon', rarity: 'legendary', desc: 'Every 5th arrow deals triple damage', effect: () => { gameState.stats.hasInfinity = true; } },
    phoenix_l: { id: 'phoenix_l', name: 'Phoenix Heart', icon: '🔥', type: 'defense', rarity: 'legendary', desc: 'Revive once with 50% health when killed', effect: () => { gameState.stats.hasPhoenix = true; } },
    time_lord_l: { id: 'time_lord_l', name: 'Time Lord', icon: '⌛', type: 'magic', rarity: 'legendary', desc: 'Enemies move 25% slower permanently', effect: () => { gameState.stats.enemySlowAura = (gameState.stats.enemySlowAura || 1) * 0.75; } }
};

// Function to get rarity weights based on wave
function getRarityWeights(wave) {
    // Early game: mostly common
    // Mid game: uncommon/rare
    // Late game: epic/legendary
    if (wave <= 3) {
        return { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 };
    } else if (wave <= 6) {
        return { common: 45, uncommon: 40, rare: 12, epic: 3, legendary: 0 };
    } else if (wave <= 10) {
        return { common: 25, uncommon: 35, rare: 28, epic: 10, legendary: 2 };
    } else if (wave <= 15) {
        return { common: 10, uncommon: 25, rare: 35, epic: 22, legendary: 8 };
    } else {
        return { common: 5, uncommon: 15, rare: 30, epic: 32, legendary: 18 };
    }
}

// Function to pick a random rarity based on weights
function pickRarity(wave) {
    const weights = getRarityWeights(wave);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (const [rarity, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return rarity;
    }
    return 'common';
}

// ===== ENEMY DEFINITIONS =====
const ENEMY_TYPES = {
    orc: { 
        name: 'Orc', 
        emoji: '👹', 
        baseHealth: 20, 
        baseDamage: 2,
        speed: 1.2,
        value: 1,
        class: 'orc',
        damageScalesWithWave: true
    },
    goblin: { 
        name: 'Goblin Archer', 
        emoji: '🏹', 
        baseHealth: 12, 
        baseDamage: 3, 
        speed: 1.6,
        value: 1,
        class: 'goblin',
        ranged: true,
        range: 150
    },
    troll: { 
        name: 'Troll', 
        emoji: '🧌', 
        baseHealth: 50, 
        baseDamage: 8, 
        speed: 0.7,
        value: 3,
        class: 'troll'
    },
    ogre: { 
        name: 'Ogre', 
        emoji: '👺', 
        baseHealth: 65, 
        baseDamage: 10, 
        speed: 0.6,
        value: 4,
        class: 'ogre'
    },
    darkMage: { 
        name: 'Dark Mage', 
        emoji: '🧙', 
        baseHealth: 28, 
        baseDamage: 7, 
        speed: 0.9,
        value: 3,
        class: 'dark-mage',
        ranged: true,
        range: 200
    },
    skeleton: { 
        name: 'Skeleton Warrior', 
        emoji: '💀', 
        baseHealth: 16, 
        baseDamage: 5, 
        speed: 1.5,
        value: 2,
        class: 'skeleton'
    },
    dragon: { 
        name: 'Young Dragon', 
        emoji: '🐲', 
        baseHealth: 120, 
        baseDamage: 15, 
        speed: 0.8,
        value: 8,
        class: 'dragon'
    },
    boss: { 
        name: 'Orc Warlord', 
        emoji: '👿', 
        baseHealth: 150, 
        baseDamage: 12, 
        speed: 0.5,
        value: 10,
        class: 'boss'
    },
    // New enemy types
    vampire: {
        name: 'Vampire',
        emoji: '🧛',
        baseHealth: 35,
        baseDamage: 6,
        speed: 1.3,
        value: 4,
        class: 'vampire'
    },
    ghost: {
        name: 'Wraith',
        emoji: '👻',
        baseHealth: 22,
        baseDamage: 5,
        speed: 1.8,
        value: 3,
        class: 'ghost'
    },
    demon: {
        name: 'Demon',
        emoji: '👹',
        baseHealth: 80,
        baseDamage: 14,
        speed: 0.9,
        value: 6,
        class: 'demon'
    },
    necromancer: {
        name: 'Necromancer',
        emoji: '🧙‍♂️',
        baseHealth: 40,
        baseDamage: 9,
        speed: 0.7,
        value: 5,
        class: 'necromancer',
        ranged: true,
        range: 180
    },
    golem: {
        name: 'Stone Golem',
        emoji: '🗿',
        baseHealth: 150,
        baseDamage: 18,
        speed: 0.4,
        value: 7,
        class: 'golem'
    },
    assassin: {
        name: 'Shadow Assassin',
        emoji: '👤',
        baseHealth: 18,
        baseDamage: 12,
        speed: 2.0,
        value: 4,
        class: 'assassin'
    }
};

// ===== SHOP ITEMS =====
const SHOP_ITEMS = {
    smallRepair: { id: 'smallRepair', name: 'Small Repair', icon: '🔧', desc: 'Restore +25 HP', price: 25, type: 'repair', healAmount: 25 },
    mediumRepair: { id: 'mediumRepair', name: 'Medium Repair', icon: '🔩', desc: 'Restore +50 HP', price: 50, type: 'repair', healAmount: 50 },
    fullRepair: { id: 'fullRepair', name: 'Full Repair', icon: '⚒️', desc: 'Restore to full HP', price: 100, type: 'repair', healAmount: 'full' },
    mysteryUpgrade: { id: 'mysteryUpgrade', name: 'Mystery Box', icon: '🎁', desc: 'Random upgrade', price: 75, type: 'upgrade' }
};

// ===== GAME STATE =====
let gameState = {
    isRunning: false,
    isPaused: false,
    wave: 1,
    kills: 0,
    gold: 0,
    totalGoldEarned: 0,
    castle: {
        health: 150,
        x: 0,
        y: 0
    },
    stats: {
        maxHealth: 150,
        damage: 25,
        attackSpeed: 1.3,
        projectiles: 1,
        critChance: 0.05,
        critDamage: 1.5,
        armor: 0,
        regen: 0,
        thorns: 0,
        hasFireball: false,
        hasLightning: false,
        hasMeteor: false,
        freezeChance: 0,
        explosiveArrows: false,
        invincible: false,
        damageMultiplier: 1
    },
    enemies: [],
    projectiles: [],
    lastAttackTime: 0,
    lastFireballTime: 0,
    lastLightningTime: 0,
    lastMeteorTime: 0,
    earnedUpgrades: [],
    actionCards: [], // Card deck for consumable action cards
    waveStarted: false,
    expectedEnemies: 0,
    waveKills: 0,
    pendingSpawns: [],
    // Manual targeting - when player clicks and holds on the map
    manualTarget: null, // { x, y } or null for automatic targeting
    // Mystery box limit per wave
    mysteryBoxesBought: 0
};

// ===== WAVE RECORD (Persists until page refresh) =====
let waveRecord = 0;

// ===== DOM ELEMENTS =====
let loadingScreen, homeScreen, gameScreen;
let playBtn, patchNotesBtn, helpBtn, creditsBtn;
let patchNotesModal, helpModal;
let closePatchNotes, closeHelp;
let confettiContainer, particlesContainer;
let loadingBar, loadingText;

// Game elements
let gameArena, castle, castleHealthFill, castleHealthText;
let waveNumber, enemyCount, killCount, goldCount;
let waveOverlay, waveAnnounceText, waveAnnounceSubtext;
let upgradeModal, upgradeOptions, shopItems, shopGoldDisplay;
let pauseMenu, pauseBtn, resumeBtn, quitBtn;
let gameOver, finalWave, finalKills, finalGold, recordWave, playAgainBtn, mainMenuBtn;

// Game loop
let gameLoop = null;
let waveTimeout = null;

// ===== INITIALIZE DOM ELEMENTS =====
function initDOMElements() {
    loadingScreen = document.getElementById('loadingScreen');
    homeScreen = document.getElementById('homeScreen');
    gameScreen = document.getElementById('gameScreen');
    playBtn = document.getElementById('playBtn');
    patchNotesBtn = document.getElementById('patchNotesBtn');
    helpBtn = document.getElementById('helpBtn');
    creditsBtn = document.getElementById('creditsBtn');
    patchNotesModal = document.getElementById('patchNotesModal');
    helpModal = document.getElementById('helpModal');
    closePatchNotes = document.getElementById('closePatchNotes');
    closeHelp = document.getElementById('closeHelp');
    confettiContainer = document.getElementById('confettiContainer');
    particlesContainer = document.getElementById('particles');
    loadingBar = document.getElementById('loadingBar');
    loadingText = document.getElementById('loadingText');
    
    // Game elements
    gameArena = document.getElementById('gameArena');
    castle = document.getElementById('castle');
    castleHealthFill = document.getElementById('castleHealthFill');
    castleHealthText = document.getElementById('castleHealthText');
    waveNumber = document.getElementById('waveNumber');
    enemyCount = document.getElementById('enemyCount');
    killCount = document.getElementById('killCount');
    goldCount = document.getElementById('goldCount');
    waveOverlay = document.getElementById('waveOverlay');
    waveAnnounceText = document.getElementById('waveAnnounceText');
    waveAnnounceSubtext = document.getElementById('waveAnnounceSubtext');
    upgradeModal = document.getElementById('upgradeModal');
    upgradeOptions = document.getElementById('upgradeOptions');
    shopItems = document.getElementById('shopItems');
    shopGoldDisplay = document.getElementById('shopGoldDisplay');
    pauseMenu = document.getElementById('pauseMenu');
    pauseBtn = document.getElementById('pauseBtn');
    resumeBtn = document.getElementById('resumeBtn');
    quitBtn = document.getElementById('quitBtn');
    gameOver = document.getElementById('gameOver');
    finalWave = document.getElementById('finalWave');
    finalKills = document.getElementById('finalKills');
    finalGold = document.getElementById('finalGold');
    recordWave = document.getElementById('recordWave');
    playAgainBtn = document.getElementById('playAgainBtn');
    mainMenuBtn = document.getElementById('mainMenuBtn');
}

// ===== LOADING SCREEN =====
function runLoadingScreen() {
    // Reset loading bar
    loadingBar.style.width = '0%';
    loadingText.textContent = LOADING_MESSAGES[0];
    loadingScreen.style.opacity = '1';
    
    // Hide homescreen, show loading
    homeScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
    
    let progress = 0;
    let messageIndex = 0;
    
    const updateLoading = () => {
        progress += Math.random() * 18 + 8;
        
        if (progress >= 100) {
            progress = 100;
            loadingBar.style.width = '100%';
            loadingText.textContent = 'Ready!';
            
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.transition = 'opacity 0.5s ease';
                
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                    loadingScreen.style.opacity = '1'; // Reset for next time
                    actuallyStartGame();
                }, 500);
            }, 400);
            return;
        }
        
        loadingBar.style.width = progress + '%';
        
        if (Math.random() < 0.5) {
            messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
            loadingText.textContent = LOADING_MESSAGES[messageIndex];
        }
        
        setTimeout(updateLoading, 150 + Math.random() * 200);
    };
    
    setTimeout(updateLoading, 300);
}

// ===== PARTICLES SYSTEM =====
function createParticles() {
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        // Stagger the delays so particles don't all start at once
        // Use 0 to particleCount seconds delay to spread them out over time
        particle.style.animationDelay = (i * 0.5) + 's';
        particle.style.animationDuration = (12 + Math.random() * 8) + 's';
        const size = 4 + Math.random() * 8;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particlesContainer.appendChild(particle);
    }
}

// ===== CONFETTI SYSTEM =====
function createConfetti() {
    const colors = ['#8B0000', '#4a3a2a', '#C0C0C0', '#FFD700', '#2F4F4F', '#8B4513', '#800000', '#5C4033', '#CD853F', '#696969'];
    const shapes = ['square', 'circle', 'triangle'];
    
    for (let i = 0; i < 150; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            const color = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.backgroundColor = color;
            
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            if (shape === 'circle') confetti.style.borderRadius = '50%';
            else if (shape === 'triangle') {
                confetti.style.width = '0';
                confetti.style.height = '0';
                confetti.style.backgroundColor = 'transparent';
                confetti.style.borderLeft = '5px solid transparent';
                confetti.style.borderRight = '5px solid transparent';
                confetti.style.borderBottom = `10px solid ${color}`;
            }
            
            const size = 8 + Math.random() * 12;
            if (shape !== 'triangle') {
                confetti.style.width = size + 'px';
                confetti.style.height = size + 'px';
            }
            
            const drift = (Math.random() - 0.5) * 200;
            confetti.animate([
                { transform: `translateY(0) translateX(0) rotate(0deg)` },
                { transform: `translateY(100vh) translateX(${drift * 2}px) rotate(720deg)` }
            ], { duration: 3000 + Math.random() * 2000, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' });
            
            confettiContainer.appendChild(confetti);
            setTimeout(() => confetti.remove(), 5000);
        }, i * 20);
    }
}

// ===== BANNER SPARKLES =====
function createBannerSparkles(banner) {
    const rect = banner.getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'banner-sparkle';
            sparkle.textContent = '✦';
            sparkle.style.left = (Math.random() * rect.width) + 'px';
            sparkle.style.top = (Math.random() * rect.height) + 'px';
            sparkle.style.fontSize = (12 + Math.random() * 16) + 'px';
            sparkle.style.color = Math.random() > 0.5 ? '#FFD700' : '#8B0000';
            banner.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 600);
        }, i * 50);
    }
}

// ===== MODAL HANDLING =====
function openModal(modal) { modal.classList.add('active'); }
function closeModal(modal) { modal.classList.remove('active'); }

// ===== LOAD PATCH NOTES =====
function loadPatchNotes() {
    const container = document.getElementById('patchNotesContent');
    if (!container) return;
    
    let html = '';
    PATCH_NOTES.forEach(patch => {
        html += `<div class="patch-entry"><h3>Version ${patch.version} - ${patch.title}</h3><p class="patch-date">${patch.date}</p><ul>${patch.changes.map(c => `<li>${c}</li>`).join('')}</ul></div>`;
    });
    container.innerHTML = html;
}

// ===== HOME SCREEN INITIALIZATION =====
function initHomeScreen() {
    const banner = document.querySelector('.banner');
    const menuButtons = document.querySelector('.menu-buttons');
    const creditsButton = document.querySelector('.btn-credits');
    const soundButton = document.getElementById('soundToggleHome');
    
    banner.classList.add('entrance-animation');
    banner.addEventListener('click', () => {
        initAudio();
        playSound('titleClick');
        banner.classList.remove('click-animation');
        void banner.offsetWidth;
        banner.classList.add('click-animation');
        createBannerSparkles(banner);
    });
    
    // Add hover sounds to all menu buttons
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-credits, .btn-sound').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            playSound('hover');
        });
    });

    // Set initial hidden state for animations
    menuButtons.style.opacity = '0';
    menuButtons.style.transform = 'translateY(30px)';
    creditsButton.style.opacity = '0';
    creditsButton.style.transform = 'translateY(30px)';
    if (soundButton) {
        soundButton.style.opacity = '0';
        soundButton.style.transform = 'translateY(30px)';
    }

    setTimeout(() => {
        menuButtons.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        menuButtons.style.opacity = '1';
        menuButtons.style.transform = 'translateY(0)';
    }, 800);
    
    setTimeout(() => {
        creditsButton.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        creditsButton.style.opacity = '1';
        creditsButton.style.transform = 'translateY(0)';
        if (soundButton) {
            soundButton.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            soundButton.style.opacity = '1';
            soundButton.style.transform = 'translateY(0)';
        }
    }, 1200);
}

// ===== GAME INITIALIZATION =====
function actuallyStartGame() {
    // Reset game state
    gameState = {
        isRunning: true,
        isPaused: false,
        wave: 1,
        kills: 0,
        gold: 0,
        totalGoldEarned: 0,
        castle: { health: 150, x: 0, y: 0 },
        stats: {
            maxHealth: 150,
            damage: 25,
            attackSpeed: 1.3,
            projectiles: 1,
            critChance: 0.05,
            critDamage: 1.5,
            armor: 0,
            regen: 0,
            thorns: 0,
            hasFireball: false,
            hasLightning: false,
            hasMeteor: false,
            freezeChance: 0,
            explosiveArrows: false,
            invincible: false,
            damageMultiplier: 1
        },
        enemies: [],
        projectiles: [],
        lastAttackTime: 0,
        lastFireballTime: 0,
        lastLightningTime: 0,
        lastMeteorTime: 0,
        earnedUpgrades: [],
        actionCards: [],
        waveStarted: false,
        expectedEnemies: 0,
        waveKills: 0,
        pendingSpawns: [],
        manualTarget: null,
        mysteryBoxesBought: 0
    };
    
    // Switch to game screen
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Clear any existing entities
    clearEntities();
    
    // Position castle
    const arenaRect = gameArena.getBoundingClientRect();
    gameState.castle.x = arenaRect.width / 2;
    gameState.castle.y = arenaRect.height / 2;
    
    // Update UI
    updateHealthBar();
    updateWaveDisplay();
    updateGoldDisplay();
    killCount.textContent = '0';
    
    // Initialize card deck
    renderCardDeck();
    
    // Setup manual targeting (click and hold to aim)
    setupManualTargeting();
    
    // Start wave
    startWave();
    
    // Start game loop
    gameLoop = setInterval(update, 1000 / 60);
}

// ===== WAVE SYSTEM =====
function startWave() {
    const isBossWave = gameState.wave % 5 === 0;
    
    // Play wave start sound
    if (isBossWave) {
        playSound('bossWave');
    } else {
        playSound('waveStart');
    }
    
    // Show wave announcement
    waveAnnounceText.textContent = isBossWave ? `BOSS WAVE ${gameState.wave}` : `Wave ${gameState.wave}`;
    waveAnnounceSubtext.textContent = isBossWave ? '💀 The Warlord approaches!' : 'Prepare yourself!';
    waveOverlay.classList.remove('hidden');
    if (isBossWave) waveOverlay.querySelector('.wave-announce').classList.add('boss');
    else waveOverlay.querySelector('.wave-announce').classList.remove('boss');
    
    setTimeout(() => {
        waveOverlay.classList.add('hidden');
        spawnWaveEnemies();
    }, 2000);
}

function spawnWaveEnemies() {
    const wave = gameState.wave;
    const isBossWave = wave % 5 === 0;
    
    // Calculate spawn delay multiplier based on screen width
    // Narrower screens = enemies travel shorter distance = slower spawn rate
    const arenaRect = gameArena.getBoundingClientRect();
    const baseWidth = 1200; // Reference width for normal spawn rate
    const currentWidth = arenaRect.width;
    const spawnDelayMultiplier = Math.max(1, baseWidth / currentWidth);
    
    // Every 5 waves, waves get slightly longer and have more enemies
    // Reduced from 1.3 to 1.12 for gentler scaling
    const waveTier = Math.floor(wave / 5);
    const waveScaleMultiplier = Math.pow(1.12, waveTier);
    // Spawn delay also increases every 5 waves (enemies spawn more spread out = longer wave)
    const waveDelayMultiplier = 1 + waveTier * 0.1;
    
    let enemies = [];
    
    if (isBossWave) {
        // Spawn boss + some minions - balanced for survivability
        enemies.push({ type: 'boss', delay: 0 });
        
        // Add extra bosses every 15 waves (was 10)
        const extraBosses = Math.floor(wave / 15);
        for (let b = 0; b < extraBosses; b++) {
            enemies.push({ type: 'boss', delay: (1000 + b * 600) * spawnDelayMultiplier * waveDelayMultiplier });
        }
        
        // Add dragon on boss waves 15+ (was 10)
        if (wave >= 15) {
            const dragonCount = Math.floor(wave / 15);
            for (let d = 0; d < dragonCount; d++) {
                enemies.push({ type: 'dragon', delay: (1200 + d * 700) * spawnDelayMultiplier * waveDelayMultiplier });
            }
        }
        
        // Fewer minions - reduced formula
        const baseMinionCount = Math.floor(wave * 0.6) + 2;
        const minionCount = Math.floor(baseMinionCount * waveScaleMultiplier);
        for (let i = 0; i < minionCount; i++) {
            // Mix of enemy types for boss waves
            let type = 'orc';
            if (wave >= 10 && Math.random() > 0.7) type = 'troll';
            if (wave >= 20 && Math.random() > 0.8) type = 'ogre';
            enemies.push({ type, delay: (600 + i * 300) * spawnDelayMultiplier * waveDelayMultiplier });
        }
    } else {
        // Regular wave composition - balanced enemy count
        // Reduced from 2.5 to 1.5 multiplier for more manageable waves
        const rawBaseCount = 3 + Math.floor(wave * 1.5);
        const baseCount = Math.floor(rawBaseCount * waveScaleMultiplier);
        
        for (let i = 0; i < baseCount; i++) {
            let type = 'orc';
            const roll = Math.random();
            
            // Progressive enemy unlocks with higher spawn rates
            if (wave >= 2 && roll > 0.65) type = 'goblin';
            if (wave >= 4 && roll > 0.75) type = 'troll';
            if (wave >= 6 && roll > 0.8) type = 'ogre';
            if (wave >= 8 && roll > 0.82) type = 'darkMage';
            if (wave >= 10 && roll > 0.7) type = 'skeleton';
            if (wave >= 12 && roll > 0.88) type = 'dragon';
            
            // Late game: more dangerous enemies become common
            if (wave >= 15) {
                if (roll > 0.5) type = 'skeleton';
                if (roll > 0.7) type = 'ogre';
                if (roll > 0.85) type = 'darkMage';
                if (roll > 0.92) type = 'dragon';
            }
            
            if (wave >= 20) {
                if (roll > 0.4) type = 'troll';
                if (roll > 0.6) type = 'ogre';
                if (roll > 0.75) type = 'darkMage';
                if (roll > 0.85) type = 'dragon';
            }
            
            // Faster spawn rate in later waves, but stretched by waveDelayMultiplier every 5 waves
            const spawnDelay = Math.max(150, 400 - wave * 10);
            enemies.push({ type, delay: i * spawnDelay * spawnDelayMultiplier * waveDelayMultiplier });
        }
    }
    
    // Track expected enemies count to prevent premature wave completion
    gameState.expectedEnemies = enemies.length;
    gameState.waveStarted = true;
    
    // Spawn enemies with delays - store timeouts so we can handle pause
    gameState.pendingSpawns = [];
    enemies.forEach(e => {
        const spawnData = {
            type: e.type,
            delay: e.delay,
            spawned: false
        };
        gameState.pendingSpawns.push(spawnData);
        
        const timeoutId = setTimeout(() => {
            if (!spawnData.spawned && gameState.isRunning) {
                spawnData.spawned = true;
                spawnEnemy(e.type);
            }
        }, e.delay);
        spawnData.timeoutId = timeoutId;
    });
}

function spawnEnemy(type) {
    const enemyDef = ENEMY_TYPES[type];
    const arenaRect = gameArena.getBoundingClientRect();
    const wave = gameState.wave;
    const diffMult = getDifficultyMultipliers(wave);
    
    // Scale stats with wave - exponential scaling for harder late game
    // Health scales faster than damage to make fights longer
    const healthScale = (1 + (wave - 1) * 0.15 + Math.pow(wave, 1.3) * 0.02) * diffMult.enemyHealth;
    let damageScale = (1 + (wave - 1) * 0.1 + Math.pow(wave, 1.2) * 0.015) * diffMult.enemyDamage;
    
    // Special scaling for orcs - their damage ramps up more slowly early, faster late
    if (enemyDef.damageScalesWithWave) {
        // Orcs do much less damage early game (waves 1-5), ramp up to full power by wave 15+
        const waveRamp = Math.min(1, Math.max(0.3, (wave - 1) / 14));
        damageScale *= waveRamp;
    }
    
    // Speed increases slightly in later waves
    const speedScale = 1 + Math.min(wave * 0.02, 0.5);
    
    // Random spawn position from edges
    let x, y;
    const side = Math.floor(Math.random() * 4);
    const margin = 50;
    
    switch(side) {
        case 0: x = margin; y = Math.random() * arenaRect.height; break; // Left
        case 1: x = arenaRect.width - margin; y = Math.random() * arenaRect.height; break; // Right
        case 2: x = Math.random() * arenaRect.width; y = margin; break; // Top
        case 3: x = Math.random() * arenaRect.width; y = arenaRect.height - margin; break; // Bottom
    }
    
    const enemy = {
        id: Date.now() + Math.random(),
        type: type,
        x: x,
        y: y,
        health: enemyDef.baseHealth * healthScale,
        maxHealth: enemyDef.baseHealth * healthScale,
        damage: enemyDef.baseDamage * damageScale,
        speed: enemyDef.speed * speedScale,
        value: enemyDef.value,
        ranged: enemyDef.ranged || false,
        range: enemyDef.range || 0,
        lastAttack: 0,
        slowed: false,
        element: null
    };
    
    // Create DOM element
    const el = document.createElement('div');
    el.className = `enemy ${enemyDef.class}`;
    el.innerHTML = `<span>${enemyDef.emoji}</span><div class="enemy-health-bar"><div class="enemy-health-fill" style="width: 100%"></div></div>`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.id = `enemy-${enemy.id}`;
    gameArena.appendChild(el);
    
    enemy.element = el;
    gameState.enemies.push(enemy);
    
    updateEnemyCount();
}

// ===== GAME UPDATE LOOP =====
function update() {
    if (!gameState.isRunning || gameState.isPaused) return;
    
    const now = Date.now();
    
    // Castle regeneration
    if (gameState.stats.regen > 0) {
        gameState.castle.health = Math.min(
            gameState.stats.maxHealth,
            gameState.castle.health + gameState.stats.regen / 60
        );
        updateHealthBar();
    }
    
    // Update enemies
    updateEnemies(now);
    
    // Update projectiles
    updateProjectiles();
    
    // Castle attacks
    castleAttack(now);
    
    // Check wave completion
    checkWaveComplete();
}

function updateEnemies(now) {
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    gameState.enemies.forEach(enemy => {
        if (!enemy.element) return;
        
        // Calculate direction to castle
        const dx = castleX - enemy.x;
        const dy = castleY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if in attack range
        const attackRange = enemy.ranged ? enemy.range : 60;
        
        if (dist > attackRange) {
            // Move toward castle
            const speed = enemy.slowed ? enemy.speed * 0.7 : enemy.speed;
            enemy.x += (dx / dist) * speed;
            enemy.y += (dy / dist) * speed;
            
            // Update position
            enemy.element.style.left = enemy.x + 'px';
            enemy.element.style.top = enemy.y + 'px';
        } else {
            // Attack castle
            if (now - enemy.lastAttack > 1000) {
                // Visual attack indicator
                if (enemy.ranged) {
                    fireEnemyProjectile(enemy, castleX, castleY);
                } else {
                    // Melee attack animation
                    enemy.element.classList.add('attacking');
                    setTimeout(() => {
                        if (enemy.element) enemy.element.classList.remove('attacking');
                    }, 300);
                }
                attackCastle(enemy);
                enemy.lastAttack = now;
            }
        }
    });
}

function fireEnemyProjectile(enemy, targetX, targetY) {
    const projectile = document.createElement('div');
    projectile.className = 'enemy-projectile';
    
    // Different projectile types based on enemy
    let emoji = '🏹';
    let projectileClass = 'arrow';
    
    if (enemy.type === 'goblin') {
        emoji = '➵';
        projectileClass = 'arrow';
    } else if (enemy.type === 'darkMage') {
        emoji = '🔮';
        projectileClass = 'magic';
    } else if (enemy.type === 'dragon') {
        emoji = '🔥';
        projectileClass = 'magic';
    }
    
    projectile.classList.add(projectileClass);
    projectile.textContent = emoji;
    projectile.style.left = enemy.x + 'px';
    projectile.style.top = enemy.y + 'px';
    
    // Calculate angle to target
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    projectile.style.transform = `rotate(${angle}deg)`;
    
    gameArena.appendChild(projectile);
    
    // Animate projectile to castle
    const startX = enemy.x;
    const startY = enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = distance / 8; // Speed of projectile
    
    let startTime = null;
    
    function animateProjectile(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / (duration * 16.67), 1);
        
        const currentX = startX + dx * progress;
        const currentY = startY + dy * progress;
        
        projectile.style.left = currentX + 'px';
        projectile.style.top = currentY + 'px';
        
        if (progress < 1) {
            requestAnimationFrame(animateProjectile);
        } else {
            projectile.remove();
        }
    }
    
    requestAnimationFrame(animateProjectile);
}

function attackCastle(enemy) {
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Check for invincibility
    if (gameState.stats.invincible) {
        showDamageNumber(gameState.castle.x, gameState.castle.y - 50, 'BLOCKED!', false, true);
        return;
    }
    
    // Check for block chance
    if (gameState.stats.blockChance && Math.random() < gameState.stats.blockChance) {
        showDamageNumber(gameState.castle.x, gameState.castle.y - 50, 'BLOCKED!', false, true);
        return;
    }
    
    // Play castle hit sound
    playSound('castleHit');
    
    // Create enemy attack visual effect based on enemy type
    createEnemyAttackEffect(enemy, castleX, castleY);
    
    let damage = enemy.damage;
    
    // Apply armor reduction
    damage *= (1 - gameState.stats.armor);
    
    gameState.castle.health -= damage;
    
    // Thorns damage
    if (gameState.stats.thorns > 0) {
        damageEnemy(enemy, gameState.stats.thorns);
    }
    
    // Show damage number
    showDamageNumber(gameState.castle.x, gameState.castle.y - 50, Math.round(damage), false, true);
    
    updateHealthBar();
    
    // Check game over
    if (gameState.castle.health <= 0) {
        playSound('castleDestroyed');
        endGame();
    }
}

function updateHealthBar() {
    const percent = (gameState.castle.health / gameState.stats.maxHealth) * 100;
    castleHealthFill.style.width = percent + '%';
    castleHealthText.textContent = `${Math.ceil(gameState.castle.health)}/${gameState.stats.maxHealth}`;
    
    // Update health bar color
    castleHealthFill.classList.remove('low', 'critical');
    if (percent <= 25) castleHealthFill.classList.add('critical');
    else if (percent <= 50) castleHealthFill.classList.add('low');
    
    // Update castle visual state (damage effects)
    updateCastleVisuals();
}

// ===== COMBAT SYSTEM =====
function castleAttack(now) {
    const attackInterval = 1000 / gameState.stats.attackSpeed;
    
    if (now - gameState.lastAttackTime < attackInterval) return;
    if (gameState.enemies.length === 0) return;
    
    gameState.lastAttackTime = now;
    
    // Find targets
    const targets = findNearestEnemies(gameState.stats.projectiles);
    
    targets.forEach(target => {
        fireProjectile(target, 'arrow');
    });
    
    // Fireball (every 3 seconds)
    if (gameState.stats.hasFireball && now - gameState.lastFireballTime > 3000) {
        const target = findNearestEnemies(1)[0];
        if (target) {
            fireProjectile(target, 'fireball');
            gameState.lastFireballTime = now;
        }
    }
    
    // Lightning (every 4 seconds)
    if (gameState.stats.hasLightning && now - gameState.lastLightningTime > 4000) {
        const target = findNearestEnemies(1)[0];
        if (target) {
            chainLightning(target);
            gameState.lastLightningTime = now;
        }
    }
    
    // Meteor Strike (every 5 seconds)
    if (gameState.stats.hasMeteor && now - gameState.lastMeteorTime > 5000) {
        const targets = findNearestEnemies(3);
        if (targets.length > 0) {
            fireMeteor(targets);
            gameState.lastMeteorTime = now;
        }
    }
}

function findNearestEnemies(count) {
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Get IDs of enemies that already have projectiles targeting them
    const enemiesWithProjectiles = new Set(
        gameState.projectiles.map(p => p.targetId)
    );
    
    // If manual target is set, prioritize enemies near that position (ignore projectile check for manual targeting)
    if (gameState.manualTarget) {
        const targetX = gameState.manualTarget.x;
        const targetY = gameState.manualTarget.y;
        
        return gameState.enemies
            .filter(e => e.health > 0)
            .map(e => ({
                enemy: e,
                dist: Math.sqrt((e.x - targetX) ** 2 + (e.y - targetY) ** 2)
            }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, count)
            .map(e => e.enemy);
    }
    
    // Filter out enemies that already have projectiles targeting them
    const availableEnemies = gameState.enemies.filter(e => 
        e.health > 0 && !enemiesWithProjectiles.has(e.id)
    );
    
    // If no available enemies without projectiles, fall back to all enemies
    const enemyPool = availableEnemies.length > 0 ? availableEnemies : gameState.enemies.filter(e => e.health > 0);
    
    // Default: target enemies nearest to castle
    return enemyPool
        .map(e => ({
            enemy: e,
            dist: Math.sqrt((e.x - castleX) ** 2 + (e.y - castleY) ** 2)
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, count)
        .map(e => e.enemy);
}

function fireProjectile(target, type) {
    const arenaRect = gameArena.getBoundingClientRect();
    const startX = arenaRect.width / 2;
    const startY = arenaRect.height / 2;
    
    // Play projectile sound
    if (type === 'fireball') {
        playSound('fireball');
    } else {
        playSound('arrowShoot');
    }
    
    const baseDamage = type === 'fireball' ? gameState.stats.damage * 2 : gameState.stats.damage;
    
    const projectile = {
        id: Date.now() + Math.random(),
        x: startX,
        y: startY,
        targetId: target.id,
        type: type,
        speed: type === 'fireball' ? 6 : 10,
        damage: baseDamage * (gameState.stats.damageMultiplier || 1),
        element: null
    };
    
    const el = document.createElement('div');
    el.className = `projectile ${type}`;
    el.textContent = type === 'fireball' ? '🔥' : '→';
    el.style.left = startX + 'px';
    el.style.top = startY + 'px';
    gameArena.appendChild(el);
    
    projectile.element = el;
    gameState.projectiles.push(projectile);
}

function chainLightning(target) {
    const targets = [target];
    let lastTarget = target;
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Find up to 2 more nearby enemies
    for (let i = 0; i < 2; i++) {
        const nearby = gameState.enemies.find(e => 
            e.id !== lastTarget.id && 
            !targets.includes(e) &&
            Math.sqrt((e.x - lastTarget.x) ** 2 + (e.y - lastTarget.y) ** 2) < 150
        );
        if (nearby) {
            targets.push(nearby);
            lastTarget = nearby;
        }
    }
    
    playSound('lightning');
    
    // Draw lightning from castle to first target
    createVisualEffect(castleX, castleY, 'lightning-chain', { 
        targetX: targets[0].x, 
        targetY: targets[0].y 
    });
    
    // Damage all targets with chain visual
    targets.forEach((t, i) => {
        setTimeout(() => {
            const damage = gameState.stats.damage * (1 - i * 0.2);
            damageEnemy(t, damage);
            
            // Draw chain to next target
            if (i < targets.length - 1) {
                createVisualEffect(t.x, t.y, 'lightning-chain', { 
                    targetX: targets[i + 1].x, 
                    targetY: targets[i + 1].y 
                });
            }
            
            // Visual effect on enemy
            const flash = document.createElement('div');
            flash.className = 'projectile lightning';
            flash.textContent = '⚡';
            flash.style.left = t.x + 'px';
            flash.style.top = t.y + 'px';
            flash.style.fontSize = '2rem';
            gameArena.appendChild(flash);
            setTimeout(() => flash.remove(), 300);
        }, i * 100);
    });
}

function fireMeteor(targets) {
    playSound('explosion');
    
    const arenaRect = gameArena.getBoundingClientRect();
    const meteorDamage = gameState.stats.damage * 3;
    
    targets.forEach((target, i) => {
        setTimeout(() => {
            if (!target || target.health <= 0) return;
            
            // Create meteor falling
            const meteor = document.createElement('div');
            meteor.className = 'meteor';
            meteor.textContent = '☄️';
            meteor.style.left = target.x + 'px';
            meteor.style.top = '-50px';
            gameArena.appendChild(meteor);
            
            // After falling, deal damage and show impact
            setTimeout(() => {
                meteor.remove();
                
                if (target && target.health > 0) {
                    damageEnemy(target, meteorDamage * gameState.stats.damageMultiplier);
                    createVisualEffect(target.x, target.y, 'meteor-impact');
                    
                    // Splash damage to nearby enemies
                    gameState.enemies.forEach(enemy => {
                        if (enemy.id !== target.id && enemy.health > 0) {
                            const dx = enemy.x - target.x;
                            const dy = enemy.y - target.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < 80) {
                                damageEnemy(enemy, (meteorDamage * 0.5) * gameState.stats.damageMultiplier);
                            }
                        }
                    });
                }
            }, 800);
        }, i * 200);
    });
}

function updateProjectiles() {
    gameState.projectiles = gameState.projectiles.filter(proj => {
        const target = gameState.enemies.find(e => e.id === proj.targetId);
        
        if (!target || target.health <= 0) {
            if (proj.element) proj.element.remove();
            return false;
        }
        
        // Move toward target
        const dx = target.x - proj.x;
        const dy = target.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 20) {
            // Hit!
            let damage = proj.damage;
            let isCrit = false;
            
            // Critical hit
            if (Math.random() < gameState.stats.critChance) {
                damage *= gameState.stats.critDamage;
                isCrit = true;
            }
            
            damageEnemy(target, damage, isCrit);
            
            // Explosive arrows
            if (gameState.stats.explosiveArrows && proj.type === 'arrow') {
                // Add explosion visual
                createVisualEffect(target.x, target.y, 'meteor-impact');
                gameState.enemies.forEach(e => {
                    if (e.id !== target.id) {
                        const d = Math.sqrt((e.x - target.x) ** 2 + (e.y - target.y) ** 2);
                        if (d < 80) damageEnemy(e, damage * 0.5);
                    }
                });
            }
            
            // Fireball explosion
            if (proj.type === 'fireball') {
                // Add meteor impact visual
                createVisualEffect(target.x, target.y, 'meteor-impact');
                gameState.enemies.forEach(e => {
                    const d = Math.sqrt((e.x - target.x) ** 2 + (e.y - target.y) ** 2);
                    if (d < 100) damageEnemy(e, damage * 0.5);
                });
            }
            
            // Freeze chance
            if (gameState.stats.freezeChance > 0 && Math.random() < gameState.stats.freezeChance) {
                target.slowed = true;
                // Add freeze visual
                createVisualEffect(target.x, target.y, 'freeze');
                setTimeout(() => { if (target) target.slowed = false; }, 2000);
            }
            
            if (proj.element) proj.element.remove();
            return false;
        }
        
        // Update position
        proj.x += (dx / dist) * proj.speed;
        proj.y += (dy / dist) * proj.speed;
        
        if (proj.element) {
            proj.element.style.left = proj.x + 'px';
            proj.element.style.top = proj.y + 'px';
            
            // Rotate arrow toward target
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            proj.element.style.transform = `rotate(${angle}deg)`;
        }
        
        return true;
    });
}

function damageEnemy(enemy, damage, isCrit = false) {
    enemy.health -= damage;
    
    // Play hit sound
    playSound('enemyHit');
    
    // Show damage number
    showDamageNumber(enemy.x, enemy.y - 20, Math.round(damage), isCrit);
    
    // Hit animation
    if (enemy.element) {
        enemy.element.classList.add('hit');
        setTimeout(() => enemy.element.classList.remove('hit'), 150);
        
        // Update health bar
        const healthFill = enemy.element.querySelector('.enemy-health-fill');
        if (healthFill) {
            healthFill.style.width = (enemy.health / enemy.maxHealth * 100) + '%';
        }
    }
    
    // Check death
    if (enemy.health <= 0) {
        killEnemy(enemy);
    }
}

function killEnemy(enemy) {
    gameState.kills++;
    gameState.waveKills++;
    killCount.textContent = gameState.kills;
    
    // Play kill sound (special for bosses)
    if (enemy.type === 'boss' || enemy.type === 'dragon') {
        playSound('bossKill');
    } else {
        playSound('enemyKill');
    }
    playSound('goldEarn');
    
    // Award gold based on enemy value (affected by difficulty)
    const diffMult = getDifficultyMultipliers();
    const goldEarned = Math.round(enemy.value * 5 * diffMult.goldReward);
    gameState.gold += goldEarned;
    gameState.totalGoldEarned += goldEarned;
    updateGoldDisplay();
    
    // Show gold earned floating text
    showDamageNumber(enemy.x, enemy.y - 40, '+' + goldEarned + '🪙', false, true);
    
    if (enemy.element) {
        enemy.element.remove();
    }
    
    gameState.enemies = gameState.enemies.filter(e => e.id !== enemy.id);
    updateEnemyCount();
}

function showDamageNumber(x, y, damage, isCrit = false, isGold = false) {
    const el = document.createElement('div');
    el.className = `damage-number${isCrit ? ' crit' : ''}${isGold ? ' heal' : ''}`;
    el.textContent = damage;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    gameArena.appendChild(el);
    
    setTimeout(() => el.remove(), 800);
}

function updateEnemyCount() {
    enemyCount.textContent = gameState.enemies.length;
}

function updateWaveDisplay() {
    waveNumber.textContent = gameState.wave;
}

function updateGoldDisplay() {
    if (goldCount) goldCount.textContent = gameState.gold;
    if (shopGoldDisplay) shopGoldDisplay.textContent = gameState.gold;
}

// ===== WAVE COMPLETION =====
function checkWaveComplete() {
    // Only check if wave has started
    if (!gameState.waveStarted) return;
    if (gameState.enemies.length > 0) return;
    if (!gameState.isRunning) return;
    
    // Check if all spawns have happened
    const allSpawned = gameState.pendingSpawns.every(s => s.spawned);
    if (!allSpawned) return;
    
    // All enemies spawned and killed
    if (gameState.waveKills < gameState.expectedEnemies) return;
    
    // Wave complete!
    gameState.isRunning = false;
    gameState.waveStarted = false;
    
    setTimeout(() => {
        showUpgradeSelection();
    }, 500);
}

function showUpgradeSelection() {
    const wave = gameState.wave;
    
    // 15% chance to get debuff selection instead of upgrades
    if (Math.random() < 0.15) {
        showDebuffSelection();
        return;
    }
    
    const options = [];
    
    // Pick 3 options: mix of upgrades and action cards
    // 25% chance each slot is an action card (if deck isn't full)
    for (let i = 0; i < 3; i++) {
        const isActionCard = gameState.actionCards.length < 5 && Math.random() < 0.25;
        const targetRarity = pickRarity(wave);
        
        if (isActionCard) {
            // Get available action cards of this rarity
            let availableCards = Object.values(ACTION_CARDS).filter(c => 
                c.rarity === targetRarity && !options.find(o => o.id === c.id)
            );
            
            // Try adjacent rarities if none available
            if (availableCards.length === 0) {
                const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
                const idx = rarityOrder.indexOf(targetRarity);
                for (let offset = 1; offset < rarityOrder.length && availableCards.length === 0; offset++) {
                    if (idx - offset >= 0) {
                        availableCards = Object.values(ACTION_CARDS).filter(c => 
                            c.rarity === rarityOrder[idx - offset] && !options.find(o => o.id === c.id)
                        );
                    }
                    if (availableCards.length === 0 && idx + offset < rarityOrder.length) {
                        availableCards = Object.values(ACTION_CARDS).filter(c => 
                            c.rarity === rarityOrder[idx + offset] && !options.find(o => o.id === c.id)
                        );
                    }
                }
            }
            
            if (availableCards.length > 0) {
                const card = availableCards[Math.floor(Math.random() * availableCards.length)];
                options.push({ ...card, isActionCard: true });
                continue;
            }
        }
        
        // Get available upgrades of this rarity
        let availableOfRarity = Object.values(UPGRADES).filter(u => 
            u.rarity === targetRarity && 
            (u.repeatable || !gameState.earnedUpgrades.includes(u.id)) &&
            !options.find(o => o.id === u.id)
        );
        
        // If none available at this rarity, try adjacent rarities
        if (availableOfRarity.length === 0) {
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const idx = rarityOrder.indexOf(targetRarity);
            
            for (let offset = 1; offset < rarityOrder.length; offset++) {
                if (idx - offset >= 0) {
                    availableOfRarity = Object.values(UPGRADES).filter(u => 
                        u.rarity === rarityOrder[idx - offset] && 
                        (u.repeatable || !gameState.earnedUpgrades.includes(u.id)) &&
                        !options.find(o => o.id === u.id)
                    );
                    if (availableOfRarity.length > 0) break;
                }
                if (idx + offset < rarityOrder.length) {
                    availableOfRarity = Object.values(UPGRADES).filter(u => 
                        u.rarity === rarityOrder[idx + offset] && 
                        (u.repeatable || !gameState.earnedUpgrades.includes(u.id)) &&
                        !options.find(o => o.id === u.id)
                    );
                    if (availableOfRarity.length > 0) break;
                }
            }
        }
        
        if (availableOfRarity.length > 0) {
            const upgrade = availableOfRarity[Math.floor(Math.random() * availableOfRarity.length)];
            options.push({ ...upgrade, isActionCard: false });
        }
    }
    
    // Fallback if we still don't have 3 options
    while (options.length < 3) {
        const repeatable = Object.values(UPGRADES).filter(u => 
            u.repeatable && !options.find(o => o.id === u.id)
        );
        if (repeatable.length > 0) {
            options.push({ ...repeatable[Math.floor(Math.random() * repeatable.length)], isActionCard: false });
        } else {
            break;
        }
    }
    
    // Render options with rarity styling
    upgradeOptions.innerHTML = options.map(u => {
        const rarityInfo = RARITIES[u.rarity];
        const cardTypeClass = u.isActionCard ? 'action-card-option' : u.type;
        const cardTypeLabel = u.isActionCard ? '⚡ Action Card' : '';
        return `
        <div class="upgrade-card ${cardTypeClass} ${u.rarity}" data-upgrade="${u.id}" data-is-action="${u.isActionCard}" style="border-color: ${rarityInfo.borderColor}; background: linear-gradient(180deg, ${rarityInfo.bgColor} 0%, rgba(26, 20, 16, 0.95) 100%);">
            <div class="upgrade-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
            ${u.isActionCard ? '<div class="action-card-badge">⚡ ACTION</div>' : ''}
            <div class="upgrade-icon">${u.icon}</div>
            <div class="upgrade-name" style="color: ${rarityInfo.color};">${u.name}</div>
            <div class="upgrade-desc">${u.desc}</div>
            ${u.isActionCard ? '<div class="action-card-note">Goes to card deck</div>' : ''}
        </div>
    `}).join('');
    
    // Add click handlers
    upgradeOptions.querySelectorAll('.upgrade-card').forEach(card => {
        card.addEventListener('click', () => {
            const upgradeId = card.dataset.upgrade;
            const isAction = card.dataset.isAction === 'true';
            selectUpgrade(upgradeId, isAction);
        });
    });
    
    // Render shop items
    renderShop();
    
    upgradeModal.classList.remove('hidden');
}

function renderShop() {
    updateGoldDisplay();
    
    const isHealthFull = gameState.castle.health >= gameState.stats.maxHealth;
    const priceMultiplier = getShopPriceMultiplier(gameState.wave);
    const mysteryBoxesRemaining = 3 - gameState.mysteryBoxesBought;
    
    shopItems.innerHTML = Object.values(SHOP_ITEMS).map(item => {
        // Calculate dynamic price based on wave
        const dynamicPrice = Math.round(item.price * priceMultiplier);
        const canAfford = gameState.gold >= dynamicPrice;
        const isRepairDisabled = item.type === 'repair' && isHealthFull;
        const isMysteryBoxMaxed = item.id === 'mysteryUpgrade' && gameState.mysteryBoxesBought >= 3;
        const typeClass = item.type === 'repair' ? 'repair' : 'upgrade';
        const disabled = !canAfford || isRepairDisabled || isMysteryBoxMaxed;
        
        // Custom description for mystery box showing remaining
        let desc = item.desc;
        if (item.id === 'mysteryUpgrade') {
            desc = isMysteryBoxMaxed ? 'Max reached this wave!' : `${item.desc} (${mysteryBoxesRemaining} left)`;
        } else if (isRepairDisabled) {
            desc = 'Health is full!';
        }
        
        return `
        <div class="shop-item ${typeClass} ${disabled ? 'disabled' : ''}" data-shop="${item.id}" data-price="${dynamicPrice}" ${isRepairDisabled ? 'data-full="true"' : ''} ${isMysteryBoxMaxed ? 'data-maxed="true"' : ''}>
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${desc}</div>
            <div class="shop-item-price">🪙 ${dynamicPrice}</div>
        </div>
        `;
    }).join('');
    
    // Add click handlers for shop items
    shopItems.querySelectorAll('.shop-item:not(.disabled)').forEach(item => {
        item.addEventListener('click', () => {
            const itemId = item.dataset.shop;
            const price = parseInt(item.dataset.price);
            purchaseShopItem(itemId, price);
        });
    });
}

function purchaseShopItem(itemId, dynamicPrice) {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;
    
    // Use dynamic price if provided, otherwise calculate it
    const price = dynamicPrice || Math.round(item.price * getShopPriceMultiplier(gameState.wave));
    
    // Check if repair and health is full
    if (item.type === 'repair' && gameState.castle.health >= gameState.stats.maxHealth) {
        playSound('error');
        showShopMessage('Health is already full!');
        return;
    }
    
    // Check mystery box limit
    if (itemId === 'mysteryUpgrade' && gameState.mysteryBoxesBought >= 3) {
        playSound('error');
        showShopMessage('Max 3 mystery boxes per wave!');
        return;
    }
    
    if (gameState.gold >= price) {
        playSound('purchase');
        gameState.gold -= price;
        
        if (item.type === 'repair') {
            // Apply repair
            playSound('heal');
            if (item.healAmount === 'full') {
                gameState.castle.health = gameState.stats.maxHealth;
            } else {
                gameState.castle.health = Math.min(gameState.stats.maxHealth, gameState.castle.health + item.healAmount);
            }
            updateHealthBar();
            renderShop();
        } else if (itemId === 'mysteryUpgrade') {
            // Track mystery box purchase
            gameState.mysteryBoxesBought++;
            // Mystery box animation
            openMysteryBox();
        }
        
        updateGoldDisplay();
    } else {
        playSound('error');
    }
}

function showShopMessage(message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'shop-message';
    msgEl.textContent = message;
    document.body.appendChild(msgEl);
    setTimeout(() => msgEl.remove(), 2000);
}

function openMysteryBox() {
    // Play opening sound
    playSound('mysteryBoxOpen');
    
    // 3% chance to get a devastating debuff from mystery box
    const isDebuff = Math.random() < 0.05;
    
    if (isDebuff) {
        openMysteryBoxDebuff();
        return;
    }
    
    // Get a random upgrade OR action card (30% chance for action card if deck not full)
    const includeActionCards = gameState.actionCards.length < 5 && Math.random() < 0.3;
    
    let reward, isActionCard = false;
    
    if (includeActionCards) {
        // Pick random action card
        const availableCards = Object.values(ACTION_CARDS);
        reward = availableCards[Math.floor(Math.random() * availableCards.length)];
        isActionCard = true;
    } else {
        // Pick random upgrade
        const available = Object.values(UPGRADES).filter(u => u.repeatable || !gameState.earnedUpgrades.includes(u.id));
        if (available.length === 0) return;
        reward = available[Math.floor(Math.random() * available.length)];
    }
    
    const rarityInfo = RARITIES[reward.rarity];
    
    // Create mystery box overlay
    const overlay = document.createElement('div');
    overlay.className = 'mystery-box-overlay';
    overlay.innerHTML = `
        <div class="mystery-box-container">
            <div class="mystery-box">🎁</div>
            <div class="mystery-card hidden" style="border-color: ${rarityInfo.borderColor}; background: linear-gradient(180deg, ${rarityInfo.bgColor} 0%, rgba(26, 20, 16, 0.95) 100%);">
                <div class="card-shine"></div>
                <div class="upgrade-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
                ${isActionCard ? '<div class="action-card-badge">⚡ ACTION</div>' : ''}
                <div class="upgrade-icon">${reward.icon}</div>
                <div class="upgrade-name" style="color: ${rarityInfo.color};">${reward.name}</div>
                <div class="upgrade-desc">${reward.desc}</div>
                ${isActionCard ? '<div class="action-card-note">Added to card deck!</div>' : ''}
                <div class="card-hint">Click anywhere to continue</div>
            </div>
            <div class="mystery-confetti"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Animation sequence
    const box = overlay.querySelector('.mystery-box');
    const card = overlay.querySelector('.mystery-card');
    const confettiContainer = overlay.querySelector('.mystery-confetti');
    
    // Shake the box
    setTimeout(() => box.classList.add('shaking'), 100);
    
    // Explode and show card
    setTimeout(() => {
        // Create confetti explosion
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = '50%';
            confetti.style.setProperty('--x', (Math.random() - 0.5) * 400 + 'px');
            confetti.style.setProperty('--y', (Math.random() - 0.5) * 400 + 'px');
            confetti.style.setProperty('--r', Math.random() * 720 + 'deg');
            confetti.style.backgroundColor = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#3B82F6'][Math.floor(Math.random() * 5)];
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            confettiContainer.appendChild(confetti);
        }
        
        box.classList.remove('shaking');
        box.classList.add('explode');
        
        setTimeout(() => {
            box.classList.add('hidden');
            card.classList.remove('hidden');
            card.classList.add('reveal');
            
            // Play reveal sound
            playSound('mysteryBoxReveal');
            if (reward.rarity === 'legendary') {
                playSound('legendaryUpgrade');
            } else {
                playSound('upgrade');
            }
            
            // Apply reward
            if (isActionCard) {
                addActionCard(reward.id);
            } else {
                reward.effect();
                gameState.earnedUpgrades.push(reward.id);
            }
        }, 300);
    }, 1500);
    
    // Click to close
    overlay.addEventListener('click', () => {
        if (!card.classList.contains('hidden')) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                renderShop();
            }, 300);
        }
    });
}

// ===== MYSTERY BOX DEBUFF (Devastating) =====
function openMysteryBoxDebuff() {
    // Pick a random devastating debuff
    const allDebuffs = Object.values(DEVASTATING_DEBUFFS);
    const debuff = allDebuffs[Math.floor(Math.random() * allDebuffs.length)];
    
    // Create menacing overlay (no confetti, dark and ominous)
    const overlay = document.createElement('div');
    overlay.className = 'mystery-box-overlay debuff-overlay';
    overlay.innerHTML = `
        <div class="mystery-box-container">
            <div class="mystery-box cursed-box">🎁</div>
            <div class="mystery-card debuff-mystery-card hidden" style="border-color: #7C2D12; background: linear-gradient(180deg, rgba(127, 29, 29, 0.6) 0%, rgba(15, 5, 5, 0.98) 100%);">
                <div class="debuff-aura"></div>
                <div class="debuff-skull-large">💀</div>
                <div class="upgrade-rarity" style="color: #DC2626;">CURSED!</div>
                <div class="upgrade-icon">${debuff.icon}</div>
                <div class="upgrade-name" style="color: #EF4444;">${debuff.name}</div>
                <div class="upgrade-desc" style="color: #FCA5A5;">${debuff.desc}</div>
                <div class="card-hint" style="color: #991B1B;">Click anywhere to accept your fate</div>
            </div>
            <div class="curse-particles"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Animation sequence
    const box = overlay.querySelector('.mystery-box');
    const card = overlay.querySelector('.mystery-card');
    const curseParticles = overlay.querySelector('.curse-particles');
    
    // Shake the box ominously
    setTimeout(() => box.classList.add('shaking', 'cursed-shake'), 100);
    
    // Dark reveal
    setTimeout(() => {
        // Create dark particles instead of confetti
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'curse-particle';
            particle.style.left = '50%';
            particle.style.setProperty('--x', (Math.random() - 0.5) * 300 + 'px');
            particle.style.setProperty('--y', (Math.random() - 0.5) * 300 + 'px');
            particle.style.setProperty('--r', Math.random() * 720 + 'deg');
            particle.style.backgroundColor = ['#7C2D12', '#991B1B', '#450A0A', '#1C1917', '#0C0A09'][Math.floor(Math.random() * 5)];
            particle.style.animationDelay = Math.random() * 0.3 + 's';
            curseParticles.appendChild(particle);
        }
        
        box.classList.remove('shaking', 'cursed-shake');
        box.classList.add('explode', 'cursed-explode');
        
        setTimeout(() => {
            box.classList.add('hidden');
            card.classList.remove('hidden');
            card.classList.add('reveal', 'cursed-reveal');
            
            // Play ominous sounds
            playSound('castleHit');
            playSound('error');
            
            // Apply the debuff
            debuff.effect();
        }, 300);
    }, 1800);
    
    // Click to close
    overlay.addEventListener('click', () => {
        if (!card.classList.contains('hidden')) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                renderShop();
            }, 300);
        }
    });
}

function selectUpgrade(upgradeId, isActionCard = false) {
    if (isActionCard) {
        // Add action card to deck
        const card = ACTION_CARDS[upgradeId];
        if (card) {
            playSound('upgrade');
            addActionCard(upgradeId);
        }
    } else {
        // Apply passive upgrade
        const upgrade = UPGRADES[upgradeId];
        if (upgrade) {
            // Play upgrade sound based on rarity
            if (upgrade.rarity === 'legendary') {
                playSound('legendaryUpgrade');
            } else {
                playSound('upgrade');
            }
            upgrade.effect();
            gameState.earnedUpgrades.push(upgradeId);
            
            // Update castle visuals to reflect new upgrades
            updateCastleVisuals();
        }
    }
    
    upgradeModal.classList.add('hidden');
    
    // Next wave - reset wave kill counter and mystery box purchases
    gameState.wave++;
    gameState.waveKills = 0;
    gameState.mysteryBoxesBought = 0; // Reset mystery box limit for new wave
    gameState.isRunning = true;
    updateWaveDisplay();
    
    setTimeout(() => startWave(), 500);
}

// ===== DEBUFF SELECTION =====
function showDebuffSelection() {
    // Pick 3 random debuffs
    const allDebuffs = Object.values(DEBUFF_CARDS);
    const options = [];
    
    while (options.length < 3 && options.length < allDebuffs.length) {
        const debuff = allDebuffs[Math.floor(Math.random() * allDebuffs.length)];
        if (!options.find(o => o.id === debuff.id)) {
            options.push(debuff);
        }
    }
    
    // Play ominous sound
    playSound('castleHit');
    
    // Hide the normal "Choose an Upgrade!" title
    const modalContent = upgradeModal.querySelector('.upgrade-modal-content');
    const normalTitle = modalContent.querySelector('h2');
    if (normalTitle) normalTitle.style.display = 'none';
    
    // Render debuff options with menacing styling
    upgradeOptions.innerHTML = `
        <div class="curse-title">Choose a Curse!</div>
        <div class="debuff-warning">⚠️ CURSED WAVE ⚠️</div>
        <div class="debuff-subtitle">You must choose a curse to continue...</div>
    ` + options.map(d => {
        const severityColor = d.severity === 'moderate' ? '#DC2626' : '#EF4444';
        return `
        <div class="upgrade-card debuff-card" data-debuff="${d.id}" style="border-color: #7C2D12; background: linear-gradient(180deg, rgba(127, 29, 29, 0.4) 0%, rgba(26, 20, 16, 0.95) 100%);">
            <div class="debuff-skull">💀</div>
            <div class="upgrade-icon">${d.icon}</div>
            <div class="upgrade-name" style="color: ${severityColor};">${d.name}</div>
            <div class="upgrade-desc" style="color: #FCA5A5;">${d.desc}</div>
        </div>
    `}).join('');
    
    // Add click handlers
    upgradeOptions.querySelectorAll('.debuff-card').forEach(card => {
        card.addEventListener('click', () => {
            const debuffId = card.dataset.debuff;
            selectDebuff(debuffId);
        });
    });
    
    // Hide shop during debuff selection
    const shopSection = document.querySelector('.shop-section');
    if (shopSection) shopSection.style.display = 'none';
    
    upgradeModal.classList.remove('hidden');
}

function selectDebuff(debuffId) {
    const debuff = DEBUFF_CARDS[debuffId];
    if (debuff) {
        playSound('castleHit');
        debuff.effect();
        
        // Visual feedback
        const flash = document.createElement('div');
        flash.className = 'debuff-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);
    }
    
    // Restore normal title visibility
    const modalContent = upgradeModal.querySelector('.upgrade-modal-content');
    const normalTitle = modalContent.querySelector('h2');
    if (normalTitle) normalTitle.style.display = '';
    
    // Show shop again
    const shopSection = document.querySelector('.shop-section');
    if (shopSection) shopSection.style.display = '';
    
    upgradeModal.classList.add('hidden');
    
    // Next wave
    gameState.wave++;
    gameState.waveKills = 0;
    gameState.mysteryBoxesBought = 0;
    gameState.isRunning = true;
    updateWaveDisplay();
    
    setTimeout(() => startWave(), 500);
}

// ===== GAME END =====
function endGame() {
    gameState.isRunning = false;
    
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    
    // Update wave record
    if (gameState.wave > waveRecord) {
        waveRecord = gameState.wave;
    }
    
    // Show game over with stats
    finalWave.textContent = gameState.wave;
    finalKills.textContent = gameState.kills;
    finalGold.textContent = gameState.totalGoldEarned;
    recordWave.textContent = waveRecord;
    gameOver.classList.remove('hidden');
}

function clearEntities() {
    // Remove all enemies and projectiles from DOM
    document.querySelectorAll('.enemy, .projectile, .damage-number').forEach(el => el.remove());
    gameState.enemies = [];
    gameState.projectiles = [];
}

function returnToMenu() {
    gameState.isRunning = false;
    
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    
    clearEntities();
    
    gameOver.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    upgradeModal.classList.add('hidden');
    waveOverlay.classList.add('hidden');
    gameScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
}

// ===== PAUSE SYSTEM =====
function togglePause() {
    // Allow pause during upgrade selection too
    if (gameScreen.classList.contains('hidden')) return;
    if (gameOver && !gameOver.classList.contains('hidden')) return;
    
    gameState.isPaused = !gameState.isPaused;
    
    if (gameState.isPaused) {
        renderPauseMenu();
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
    }
}

function renderPauseMenu() {
    // Build upgrades list sorted by rarity
    const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    const earnedByRarity = {};
    
    rarityOrder.forEach(r => earnedByRarity[r] = []);
    
    gameState.earnedUpgrades.forEach(id => {
        const upgrade = UPGRADES[id];
        if (upgrade) {
            earnedByRarity[upgrade.rarity].push(upgrade);
        }
    });
    
    let upgradesHTML = '';
    let hasUpgrades = false;
    
    rarityOrder.forEach(rarity => {
        if (earnedByRarity[rarity].length > 0) {
            hasUpgrades = true;
            const rarityInfo = RARITIES[rarity];
            upgradesHTML += `<div class="pause-rarity-section">
                <div class="pause-rarity-title" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
                <div class="pause-upgrades-list">
                    ${earnedByRarity[rarity].map(u => `
                        <div class="pause-upgrade-item has-tooltip" style="border-color: ${rarityInfo.borderColor};" data-tooltip="${u.desc}">
                            <span class="pause-upgrade-icon">${u.icon}</span>
                            <span class="pause-upgrade-name">${u.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
    });
    
    if (!hasUpgrades) {
        upgradesHTML = '<p class="no-upgrades">No upgrades collected yet</p>';
    }
    
    // Update pause menu content
    const pauseContent = pauseMenu.querySelector('.pause-menu-content');
    pauseContent.innerHTML = `
        <h2>⏸️ Paused</h2>
        <div class="pause-upgrades-container">
            <h3>📜 Your Upgrades</h3>
            <div class="pause-upgrades-scroll">
                ${upgradesHTML}
            </div>
        </div>
        <button class="menu-btn" id="resumeBtn">▶️ Resume</button>
        <button class="menu-btn danger" id="quitBtn">🏠 Quit to Menu</button>
    `;
    
    // Re-attach event listeners
    pauseContent.querySelector('#resumeBtn').addEventListener('click', togglePause);
    pauseContent.querySelector('#quitBtn').addEventListener('click', returnToMenu);
}

// ===== ACTION CARD EFFECTS =====
function useArrowVolley(count) {
    const targets = gameState.enemies.filter(e => e.health > 0);
    if (targets.length === 0) return;
    
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const target = targets[Math.floor(Math.random() * targets.length)];
            if (target && target.health > 0) {
                fireProjectile(target, 'arrow');
            }
        }, i * 50);
    }
}

function healCastle(amount) {
    playSound('heal');
    gameState.castle.health = Math.min(gameState.stats.maxHealth, gameState.castle.health + amount);
    updateHealthBar();
    showDamageNumber(gameState.castle.x, gameState.castle.y - 50, '+' + amount, false, true);
    
    // Add healing visual effect
    const arenaRect = gameArena.getBoundingClientRect();
    createVisualEffect(arenaRect.width / 2, arenaRect.height / 2, 'heal');
}

function useShieldBash() {
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Visual effect
    const wave = document.createElement('div');
    wave.className = 'shield-bash-wave';
    wave.style.left = castleX + 'px';
    wave.style.top = castleY + 'px';
    gameArena.appendChild(wave);
    setTimeout(() => wave.remove(), 500);
    
    gameState.enemies.forEach(enemy => {
        // Push back
        const dx = enemy.x - castleX;
        const dy = enemy.y - castleY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            enemy.x += (dx / dist) * 150;
            enemy.y += (dy / dist) * 150;
            // Clamp to arena
            enemy.x = Math.max(50, Math.min(arenaRect.width - 50, enemy.x));
            enemy.y = Math.max(50, Math.min(arenaRect.height - 50, enemy.y));
            if (enemy.element) {
                enemy.element.style.left = enemy.x + 'px';
                enemy.element.style.top = enemy.y + 'px';
            }
        }
        // Stun
        enemy.slowed = true;
        setTimeout(() => { if (enemy) enemy.slowed = false; }, 2000);
    });
}

function useMultiFireball(count) {
    const targets = findNearestEnemies(count);
    targets.forEach((target, i) => {
        setTimeout(() => {
            fireProjectile(target, 'fireball');
        }, i * 100);
    });
}

function useFreezeAll(duration) {
    playSound('freeze');
    
    // Screen flash for freeze effect
    createVisualEffect(0, 0, 'screen-flash', { color: 'freeze' });
    
    gameState.enemies.forEach(enemy => {
        enemy.slowed = true;
        if (enemy.element) enemy.element.classList.add('frozen');
        
        // Add freeze effect at enemy position
        createVisualEffect(enemy.x, enemy.y, 'freeze');
        
        setTimeout(() => {
            if (enemy) {
                enemy.slowed = false;
                if (enemy.element) enemy.element.classList.remove('frozen');
            }
        }, duration);
    });
}

function useLightningStorm(count) {
    playSound('lightning');
    
    // Screen flash for dramatic effect
    createVisualEffect(0, 0, 'screen-flash', { color: 'lightning' });
    
    const targets = gameState.enemies.slice(0, count);
    targets.forEach((target, i) => {
        setTimeout(() => {
            const damage = gameState.stats.damage * 2 * gameState.stats.damageMultiplier;
            damageEnemy(target, damage);
            
            // Lightning strike from above
            createVisualEffect(target.x, target.y, 'lightning-strike');
            
            // Visual effect on enemy
            const flash = document.createElement('div');
            flash.className = 'projectile lightning';
            flash.textContent = '⚡';
            flash.style.left = target.x + 'px';
            flash.style.top = target.y + 'px';
            flash.style.fontSize = '2.5rem';
            gameArena.appendChild(flash);
            setTimeout(() => flash.remove(), 400);
        }, i * 80);
    });
}

function useDragonBreath(damage) {
    playSound('fireball');
    
    // Screen flash and dramatic effect
    createVisualEffect(0, 0, 'screen-flash', { color: 'fire' });
    
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Dragon breath cone effect
    createVisualEffect(castleX, castleY, 'dragon-breath', { angle: 0 });
    
    // Also add the emoji effect
    const breath = document.createElement('div');
    breath.className = 'dragon-breath';
    breath.innerHTML = '🔥🔥🔥';
    breath.style.position = 'absolute';
    breath.style.left = castleX + 'px';
    breath.style.top = castleY + 'px';
    breath.style.fontSize = '3rem';
    breath.style.animation = 'dragonBreathCone 1s ease-out forwards';
    gameArena.appendChild(breath);
    setTimeout(() => breath.remove(), 1000);
    
    // Meteor impacts on all enemies
    gameState.enemies.forEach((enemy, i) => {
        setTimeout(() => {
            createVisualEffect(enemy.x, enemy.y, 'meteor-impact');
            damageEnemy(enemy, damage * gameState.stats.damageMultiplier);
        }, i * 50);
    });
}

function useInvincibility(duration) {
    playSound('heal');
    
    // Divine aura and screen flash
    createVisualEffect(0, 0, 'screen-flash', { color: 'divine' });
    const arenaRect = gameArena.getBoundingClientRect();
    createVisualEffect(arenaRect.width / 2, arenaRect.height / 2, 'divine-aura');
    
    gameState.stats.invincible = true;
    castle.classList.add('invincible');
    
    setTimeout(() => {
        gameState.stats.invincible = false;
        castle.classList.remove('invincible');
    }, duration);
}

function useTimeWarp(duration) {
    playSound('freeze');
    
    // Time warp screen effect
    createVisualEffect(0, 0, 'time-warp', { duration: duration });
    
    gameState.enemies.forEach(enemy => {
        const originalSpeed = enemy.speed;
        enemy.speed *= 0.2;
        if (enemy.element) enemy.element.classList.add('time-warped');
        
        setTimeout(() => {
            if (enemy) {
                enemy.speed = originalSpeed;
                if (enemy.element) enemy.element.classList.remove('time-warped');
            }
        }, duration);
    });
}

function useApocalypse(damage) {
    playSound('explosion');
    // Create meteor rain effect
    const arenaRect = gameArena.getBoundingClientRect();
    
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const meteor = document.createElement('div');
            meteor.className = 'meteor';
            meteor.textContent = '☄️';
            meteor.style.left = (Math.random() * arenaRect.width) + 'px';
            meteor.style.top = '-50px';
            gameArena.appendChild(meteor);
            
            setTimeout(() => meteor.remove(), 800);
        }, i * 100);
    }
    
    // Damage all enemies after meteors land
    setTimeout(() => {
        gameState.enemies.forEach(enemy => {
            damageEnemy(enemy, damage * gameState.stats.damageMultiplier);
        });
    }, 600);
}

function usePhoenixRebirth() {
    // Full heal
    gameState.castle.health = gameState.stats.maxHealth;
    updateHealthBar();
    
    // Visual effect
    castle.classList.add('phoenix-rebirth');
    setTimeout(() => castle.classList.remove('phoenix-rebirth'), 2000);
    
    // Damage boost
    gameState.stats.damageMultiplier = 1.5;
    setTimeout(() => {
        gameState.stats.damageMultiplier = 1;
    }, 10000);
}

function useBattleCry(duration, multiplier) {
    playSound('powerUp');
    
    // Visual effect - battle cry aura
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height - 80;
    
    createVisualEffect(0, 0, 'screen-flash', { color: 'fire' });
    
    // Show battle cry icon
    const cryIcon = document.createElement('div');
    cryIcon.className = 'battle-cry-icon';
    cryIcon.textContent = '📯';
    cryIcon.style.left = castleX + 'px';
    cryIcon.style.top = castleY + 'px';
    gameArena.appendChild(cryIcon);
    setTimeout(() => cryIcon.remove(), 1000);
    
    // Apply damage multiplier
    const originalMultiplier = gameState.stats.damageMultiplier;
    gameState.stats.damageMultiplier *= multiplier;
    
    // Castle glow effect
    castle.classList.add('battle-cry-active');
    
    setTimeout(() => {
        gameState.stats.damageMultiplier = originalMultiplier;
        castle.classList.remove('battle-cry-active');
    }, duration);
}

function usePoisonCloud(damagePerTick, duration) {
    playSound('magic');
    
    const arenaRect = gameArena.getBoundingClientRect();
    
    // Create poison cloud visual effect
    createVisualEffect(0, 0, 'screen-flash', { color: 'poison' });
    
    // Create poison cloud overlay
    const cloud = document.createElement('div');
    cloud.className = 'poison-cloud-overlay';
    gameArena.appendChild(cloud);
    
    // Damage enemies over time
    const tickInterval = 1000; // Damage every second
    const ticks = duration / tickInterval;
    let tickCount = 0;
    
    const poisonTick = setInterval(() => {
        tickCount++;
        gameState.enemies.forEach(enemy => {
            damageEnemy(enemy, damagePerTick * gameState.stats.damageMultiplier);
            // Add poison particle effect
            const particle = document.createElement('div');
            particle.className = 'poison-particle';
            particle.textContent = '☠️';
            particle.style.left = enemy.x + 'px';
            particle.style.top = enemy.y + 'px';
            gameArena.appendChild(particle);
            setTimeout(() => particle.remove(), 500);
        });
        
        if (tickCount >= ticks) {
            clearInterval(poisonTick);
            cloud.remove();
        }
    }, tickInterval);
}

function useSummonKnight(duration) {
    playSound('powerUp');
    
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height - 100;
    
    createVisualEffect(0, 0, 'screen-flash', { color: 'divine' });
    
    // Create the knight element
    const knight = document.createElement('div');
    knight.className = 'summoned-knight';
    knight.textContent = '🗡️';
    knight.style.left = castleX + 'px';
    knight.style.top = castleY + 'px';
    gameArena.appendChild(knight);
    
    // Knight stats
    const knightDamage = 15 * gameState.stats.damageMultiplier;
    const attackInterval = 800;
    
    // Knight attacks nearby enemies
    const knightAttack = setInterval(() => {
        if (gameState.enemies.length === 0) return;
        
        // Find closest enemy
        let closestEnemy = null;
        let closestDist = Infinity;
        
        gameState.enemies.forEach(enemy => {
            const dx = enemy.x - parseFloat(knight.style.left);
            const dy = enemy.y - parseFloat(knight.style.top);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closestEnemy = enemy;
            }
        });
        
        if (closestEnemy) {
            // Move towards enemy
            const dx = closestEnemy.x - parseFloat(knight.style.left);
            const dy = closestEnemy.y - parseFloat(knight.style.top);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 50) {
                // Attack!
                damageEnemy(closestEnemy, knightDamage);
                knight.classList.add('knight-attacking');
                setTimeout(() => knight.classList.remove('knight-attacking'), 200);
                
                // Slash effect
                const slash = document.createElement('div');
                slash.className = 'knight-slash';
                slash.style.left = closestEnemy.x + 'px';
                slash.style.top = closestEnemy.y + 'px';
                gameArena.appendChild(slash);
                setTimeout(() => slash.remove(), 300);
            } else {
                // Move towards enemy
                const moveSpeed = 3;
                const moveX = (dx / dist) * moveSpeed;
                const moveY = (dy / dist) * moveSpeed;
                knight.style.left = (parseFloat(knight.style.left) + moveX) + 'px';
                knight.style.top = (parseFloat(knight.style.top) + moveY) + 'px';
            }
        }
    }, 50);
    
    // Remove knight after duration
    setTimeout(() => {
        clearInterval(knightAttack);
        knight.classList.add('knight-fade');
        setTimeout(() => knight.remove(), 500);
    }, duration);
}

// ===== CARD DECK UI =====
function renderCardDeck() {
    let cardDeck = document.getElementById('cardDeck');
    if (!cardDeck) {
        cardDeck = document.createElement('div');
        cardDeck.id = 'cardDeck';
        cardDeck.className = 'card-deck';
        gameArena.appendChild(cardDeck);
    }
    
    if (gameState.actionCards.length === 0) {
        cardDeck.classList.add('hidden');
        return;
    }
    
    cardDeck.classList.remove('hidden');
    cardDeck.innerHTML = gameState.actionCards.map((cardId, index) => {
        const card = ACTION_CARDS[cardId];
        if (!card) return '';
        const rarityInfo = RARITIES[card.rarity];
        return `
            <div class="deck-card ${card.rarity}" data-card-index="${index}" style="border-color: ${rarityInfo.borderColor}; --card-bg: ${rarityInfo.bgColor};">
                <div class="deck-card-icon">${card.icon}</div>
                <div class="deck-card-popup" style="border-color: ${rarityInfo.borderColor}; background: linear-gradient(180deg, ${rarityInfo.bgColor} 0%, rgba(26, 20, 16, 0.98) 100%);">
                    <div class="deck-card-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
                    <div class="deck-card-name" style="color: ${rarityInfo.color};">${card.name}</div>
                    <div class="deck-card-desc">${card.desc}</div>
                    <div class="deck-card-hint">Click to use</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click and hover handlers
    cardDeck.querySelectorAll('.deck-card').forEach(cardEl => {
        cardEl.addEventListener('mouseenter', () => {
            playSound('cardHover');
        });
        cardEl.addEventListener('click', () => {
            const index = parseInt(cardEl.dataset.cardIndex);
            useActionCard(index);
        });
    });
}

function useActionCard(index) {
    if (index < 0 || index >= gameState.actionCards.length) return;
    if (gameState.isPaused || !gameState.isRunning) return;
    
    const cardId = gameState.actionCards[index];
    const card = ACTION_CARDS[cardId];
    if (!card) return;
    
    // Play card use sound
    playSound('cardUse');
    
    // Get castle position for effects
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Create dramatic activation effects
    createCardActivationEffect(card, castleX, castleY);
    
    // Execute the card effect
    card.effect();
    
    // Remove from deck
    gameState.actionCards.splice(index, 1);
    
    // Re-render deck
    renderCardDeck();
    
    // Visual feedback - enhanced card use flash
    const flash = document.createElement('div');
    flash.className = 'card-use-flash';
    flash.textContent = card.icon;
    flash.style.fontSize = '4rem';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);
}

function addActionCard(cardId) {
    // Max 5 cards in deck
    if (gameState.actionCards.length >= 5) {
        showShopMessage('Card deck is full! (max 5)');
        return false;
    }
    gameState.actionCards.push(cardId);
    renderCardDeck();
    return true;
}

// ===== MANUAL TARGETING SYSTEM =====
let targetIndicator = null;

function setupManualTargeting() {
    // Create target indicator element
    if (!targetIndicator) {
        targetIndicator = document.createElement('div');
        targetIndicator.className = 'target-indicator';
        targetIndicator.innerHTML = '🎯';
        targetIndicator.style.display = 'none';
        gameArena.appendChild(targetIndicator);
    }
    
    // Get arena position for coordinate calculations
    function getArenaCoords(e) {
        const rect = gameArena.getBoundingClientRect();
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    function startTargeting(e) {
        // Don't target if game is paused or not running
        if (!gameState.isRunning || gameState.isPaused) return;
        
        // Ignore clicks on UI elements
        if (e.target.closest('.card-deck, .game-hud, .pause-btn')) return;
        
        e.preventDefault();
        const coords = getArenaCoords(e);
        gameState.manualTarget = { x: coords.x, y: coords.y };
        
        // Show and position indicator
        targetIndicator.style.display = 'block';
        targetIndicator.style.left = coords.x + 'px';
        targetIndicator.style.top = coords.y + 'px';
    }
    
    function updateTargeting(e) {
        if (!gameState.manualTarget) return;
        if (!gameState.isRunning || gameState.isPaused) return;
        
        e.preventDefault();
        const coords = getArenaCoords(e);
        gameState.manualTarget = { x: coords.x, y: coords.y };
        
        // Update indicator position
        targetIndicator.style.left = coords.x + 'px';
        targetIndicator.style.top = coords.y + 'px';
    }
    
    function stopTargeting(e) {
        gameState.manualTarget = null;
        targetIndicator.style.display = 'none';
    }
    
    // Mouse events
    gameArena.addEventListener('mousedown', startTargeting);
    gameArena.addEventListener('mousemove', updateTargeting);
    gameArena.addEventListener('mouseup', stopTargeting);
    gameArena.addEventListener('mouseleave', stopTargeting);
    
    // Touch events for mobile
    gameArena.addEventListener('touchstart', startTargeting, { passive: false });
    gameArena.addEventListener('touchmove', updateTargeting, { passive: false });
    gameArena.addEventListener('touchend', stopTargeting);
    gameArena.addEventListener('touchcancel', stopTargeting);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Difficulty slider
    const difficultySlider = document.getElementById('difficultySlider');
    const sliderFill = document.getElementById('sliderFill');
    
    function updateSliderFill() {
        if (difficultySlider && sliderFill) {
            const percent = ((difficultySlider.value - 1) / 9) * 100;
            sliderFill.style.width = percent + '%';
        }
    }
    
    if (difficultySlider) {
        // Initialize fill on load
        updateSliderFill();
        
        // Update on input (smooth real-time updates)
        difficultySlider.addEventListener('input', () => {
            gameDifficulty = parseFloat(difficultySlider.value);
            updateSliderFill();
        });
    }
    
    // Title click - special sound
    const gameTitle = document.querySelector('.game-title');
    if (gameTitle) {
        gameTitle.style.cursor = 'pointer';
        gameTitle.addEventListener('click', () => {
            initAudio();
            playSound('legendaryUpgrade');
        });
    }
    
    // Play button - Show loading screen then start game
    playBtn.addEventListener('click', () => {
        initAudio();
        playSound('click');
        // Store the difficulty value before starting
        if (difficultySlider) {
            gameDifficulty = parseFloat(difficultySlider.value);
        }
        playBtn.style.transform = 'scale(0.95)';
        setTimeout(() => playBtn.style.transform = '', 100);
        runLoadingScreen();
    });
    
    // Patch Notes button
    patchNotesBtn.addEventListener('click', () => {
        initAudio();
        playSound('click');
        openModal(patchNotesModal);
    });
    
    // Help button
    helpBtn.addEventListener('click', () => {
        initAudio();
        playSound('click');
        openModal(helpModal);
    });
    
    // Credits button - Confetti!
    creditsBtn.addEventListener('click', () => {
        initAudio();
        playSound('click');
        createConfetti();
        const celebration = document.createElement('div');
        celebration.className = 'celebration-text';
        celebration.textContent = '🐺 Thank you for playing! 🐺';
        document.body.appendChild(celebration);
        setTimeout(() => celebration.remove(), 2000);
    });
    
    // Close modals
    closePatchNotes.addEventListener('click', () => {
        playSound('click');
        closeModal(patchNotesModal);
    });
    closeHelp.addEventListener('click', () => {
        playSound('click');
        closeModal(helpModal);
    });
    patchNotesModal.addEventListener('click', (e) => { if (e.target === patchNotesModal) closeModal(patchNotesModal); });
    helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeModal(helpModal); });
    
    // Game controls
    pauseBtn.addEventListener('click', () => {
        playSound('click');
        togglePause();
    });
    resumeBtn.addEventListener('click', () => {
        playSound('click');
        togglePause();
    });
    quitBtn.addEventListener('click', () => {
        playSound('click');
        returnToMenu();
    });
    playAgainBtn.addEventListener('click', () => {
        playSound('click');
        gameOver.classList.add('hidden');
        gameScreen.classList.add('hidden');
        runLoadingScreen();
    });
    mainMenuBtn.addEventListener('click', () => {
        playSound('click');
        returnToMenu();
    });
    
    // Sound toggle buttons
    const soundToggleHome = document.getElementById('soundToggleHome');
    const soundTogglePause = document.getElementById('soundTogglePause');
    
    if (soundToggleHome) {
        soundToggleHome.addEventListener('click', () => {
            initAudio();
            toggleSound();
        });
    }
    if (soundTogglePause) {
        soundTogglePause.addEventListener('click', () => {
            toggleSound();
        });
    }
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (patchNotesModal.classList.contains('active')) closeModal(patchNotesModal);
            else if (helpModal.classList.contains('active')) closeModal(helpModal);
            else if (gameScreen && !gameScreen.classList.contains('hidden')) togglePause();
        }
    });
}

// ===== INITIALIZE ON DOM LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    createParticles();
    loadPatchNotes();
    setupEventListeners();
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `@keyframes celebrationPop{0%{transform:translateX(-50%) scale(0);opacity:0}20%{transform:translateX(-50%) scale(1.2);opacity:1}40%{transform:translateX(-50%) scale(1);opacity:1}100%{transform:translateX(-50%) scale(1);opacity:0}}`;
    document.head.appendChild(style);
    
    // Show homescreen immediately with animations
    initHomeScreen();
});
