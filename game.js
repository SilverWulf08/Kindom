// ===== KINDOM =====
// Main Game JavaScript

// ===== DIFFICULTY SYSTEM =====
let gameDifficulty = 5; // Default: 5 (middle of 1-10 scale) - set by slider

// Calculate raw castle power based on upgrades and stats (used for difficulty scaling)
// Higher tier upgrades contribute more to castle power
function calculateRawCastlePower() {
    const stats = gameState.stats;
    let power = 0;
    
    // Offensive power
    power += stats.damage * 2;
    power += stats.attackSpeed * 30;
    power += stats.projectiles * 25;
    power += stats.critChance * 100;
    power += (stats.critDamage - 1) * 50;
    power += (stats.damageMultiplier - 1) * 100;
    power += stats.hasFireball ? 50 : 0;
    power += stats.hasLightning ? 60 : 0;
    power += stats.hasMeteor ? 80 : 0;
    power += stats.freezeChance * 80;
    power += stats.explosiveArrows ? 40 : 0;
    power += (stats.splashDamage || 0) * 60;
    power += (stats.magicDamageMultiplier || 1 - 1) * 150;
    power += (stats.deathExplosion || 0) * 100;
    
    // Defensive power
    power += stats.maxHealth * 0.5;
    power += stats.armor * 10;
    power += stats.regen * 20;
    power += stats.thorns * 15;
    power += (stats.dodgeChance || 0) * 80;
    power += (stats.reflectDamage || 0) * 50;
    power += (stats.lifeSteal || 0) * 100;
    power += (stats.shield || 0) * 0.8;
    
    // Economy power
    power += (stats.goldMultiplier || 1 - 1) * 30;
    power += (stats.bonusGoldOnKill || 0) * 15;
    
    // Range power
    power += ((stats.attackRange || 1) - 1) * 40;
    
    // Action cards add power
    power += gameState.actionCards.length * 15;
    
    // Earned upgrades add power weighted by tier
    // Common: 3, Uncommon: 6, Rare: 12, Epic: 20, Legendary: 35, Mythic: 60
    const tierWeights = { common: 3, uncommon: 6, rare: 12, epic: 20, legendary: 35, mythic: 60 };
    gameState.earnedUpgrades.forEach(upgradeId => {
        const upgrade = UPGRADES[upgradeId];
        if (upgrade && upgrade.rarity) {
            power += tierWeights[upgrade.rarity] || 8;
        } else {
            power += 8; // Default for unknown
        }
    });
    
    return Math.floor(power);
}

// Base power at game start (calculated from starting stats)
// damage 25*2 + attackSpeed 1.3*30 + projectiles 1*25 + critChance 0.05*100 + critDamage 0.5*50 + maxHealth 150*0.5 = 219
const BASE_STARTING_POWER = 219;

// Calculate displayed castle power (starts at 1, increases with upgrades)
function calculateCastlePower() {
    const rawPower = calculateRawCastlePower();
    // Normalize: subtract base starting power, then add 1 so it starts at 1
    // Every 15 raw power = 1 displayed power for nice progression
    const normalizedPower = Math.max(1, Math.floor((rawPower - BASE_STARTING_POWER) / 15) + 1);
    return normalizedPower;
}

// Get power ratio for difficulty scaling (uses raw power)
function getPowerRatio() {
    const rawPower = calculateRawCastlePower();
    return Math.max(0.5, Math.min(5, rawPower / Math.max(BASE_STARTING_POWER, 1)));
}

// Difficulty multipliers using castle power for dynamic scaling
// Wave adds base scaling, castle power adjusts enemy scaling to match player strength
function getDifficultyMultipliers(wave = 1) {
    const d = gameDifficulty;
    
    // Use the power ratio function for difficulty calculations
    const powerRatio = getPowerRatio();
    
    // Wave scaling - gentler base difficulty increase per wave
    // Caps at a reasonable amount to prevent runaway scaling
    const waveScaling = 1 + Math.min((wave - 1) * 0.015, 0.6);
    
    // Difficulty slider effect:
    // Low (1-3): Enemies scale LESS than your power (easier)
    // Medium (4-6): Enemies scale roughly WITH your power (balanced)
    // High (7-10): Enemies scale MORE than your power (harder)
    const sliderFactor = (d - 1) / 9; // 0 to 1
    
    // Power scaling factor: how much enemy scaling follows castle power
    // REBALANCED:
    // At difficulty 1-3 (Easy): 0.15-0.35 (enemies barely keep up with player)
    // At difficulty 4-6 (Moderate): 0.45-0.65 (enemies scale reasonably with player)
    // At difficulty 7-10 (Hard): 0.75-1.0 (enemies scale aggressively with player)
    const powerScaleFactor = 0.15 + sliderFactor * 0.85;
    
    // Soft cap on power ratio effect - prevents extreme scaling in late game
    // Power ratio above 2.5 has diminishing returns
    const cappedPowerRatio = powerRatio <= 2.5 ? powerRatio : 2.5 + (powerRatio - 2.5) * 0.4;
    
    // Final power multiplier for enemies
    const powerMult = 1 + (cappedPowerRatio - 1) * powerScaleFactor;
    
    // Boss wave extra scaling (bosses get additional scaling in late game)
    const isBossWave = wave % 5 === 0;
    const bossLateGameMult = isBossWave ? (1 + Math.floor(wave / 10) * 0.12) : 1;
    
    // Late game catch-up for easy mode only (keeps game interesting)
    // After wave 15, easy mode gets a slight boost so it doesn't become trivial
    const easyLateCatchup = (d <= 3 && wave > 15) ? (1 + (wave - 15) * 0.008) : 1;
    
    return {
        // Enemy health scales with wave, power, and difficulty
        enemyHealth: (0.4 + sliderFactor * 0.5) * waveScaling * powerMult * bossLateGameMult * easyLateCatchup,
        // Enemy damage scales similarly but slightly less aggressive
        enemyDamage: (0.32 + sliderFactor * 0.35) * waveScaling * powerMult * Math.sqrt(bossLateGameMult) * easyLateCatchup,
        // Gold rewards: more gold on easy, less on hard (boosted across the board)
        goldReward: 1.8 - sliderFactor * 0.5,
        // Spawn rate: slower spawns on easy, faster on hard
        spawnRate: 1.35 - sliderFactor * 0.4,
        // Raw values for reference
        waveScaling: waveScaling,
        powerRatio: powerRatio,
        bossLateGameMult: bossLateGameMult
    };
}

// Calculate shop price multiplier based on wave (increases every 10 waves) - for repairs
function getShopPriceMultiplier(wave = 1) {
    // Every 10 waves, prices increase exponentially
    // Wave 1-9: 1x, Wave 10-19: ~1.5x, Wave 20-29: ~2.25x, etc.
    const tier = Math.floor(wave / 10);
    return Math.pow(1.5, tier);
}

// Calculate mystery/golden box price multiplier (scales with wave AND power)
function getBoxPriceMultiplier(wave = 1) {
    // Wave scaling: increases every 5 waves, moderate scaling
    const waveTier = Math.floor(wave / 5);
    const waveMultiplier = Math.pow(1.25, waveTier);
    
    // Power scaling: boxes get more expensive as you get stronger (very soft)
    const powerRatio = getPowerRatio();
    const powerMultiplier = Math.pow(powerRatio, 0.35); // Much softer power scaling
    
    return waveMultiplier * powerMultiplier;
}

// ===== SOUND SYSTEM =====
let audioContext = null;
let soundEnabled = true;
let masterVolume = 0.5; // 0.0 to 1.0
let backgroundMusic = null;
let musicGainNode = null;
let isMusicMuffled = false;

// Homescreen music
let homescreenMusic = null;
let homescreenMusicGainNode = null;
let isHomescreenMusicMuffled = false;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playSound(type, volume = 0.3) {
    if (!soundEnabled) return;
    
    // Initialize audio if needed
    if (!audioContext) {
        initAudio();
    }
    
    if (!audioContext) return; // Still no context, give up
    
    // Apply master volume
    volume = volume * masterVolume;
    
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
    masterVolume = soundEnabled ? 0.5 : 0;
    updateSoundButtons();
    updateMusicVolume();
    updateHomescreenMusicVolume();
    if (soundEnabled) {
        initAudio();
        playSound('click');
    }
}

function setMasterVolume(volume) {
    masterVolume = Math.max(0, Math.min(1, volume));
    soundEnabled = masterVolume > 0;
    updateSoundButtons();
    updateMusicVolume();
    updateHomescreenMusicVolume();
}

function updateMusicVolume() {
    if (musicGainNode) {
        const targetVolume = soundEnabled ? masterVolume * 0.4 * (isMusicMuffled ? 0.3 : 1) : 0;
        musicGainNode.gain.setTargetAtTime(targetVolume, audioContext.currentTime, 0.1);
    }
}

function startBackgroundMusic() {
    // Stop any existing music first
    stopBackgroundMusic();
    initAudio();
    
    backgroundMusic = new Audio('In-game music.wav');
    backgroundMusic.loop = true;
    
    // Create a MediaElementSource and connect through gain node
    const source = audioContext.createMediaElementSource(backgroundMusic);
    musicGainNode = audioContext.createGain();
    musicGainNode.gain.value = soundEnabled ? masterVolume * 0.4 : 0;
    
    source.connect(musicGainNode);
    musicGainNode.connect(audioContext.destination);
    
    backgroundMusic.play().catch(e => console.warn('Music autoplay blocked:', e));
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        backgroundMusic = null;
        musicGainNode = null;
    }
}

function setMusicMuffled(muffled) {
    isMusicMuffled = muffled;
    updateMusicVolume();
}

// ===== HOMESCREEN MUSIC SYSTEM =====
function updateHomescreenMusicVolume() {
    if (homescreenMusicGainNode && audioContext) {
        const targetVolume = soundEnabled ? masterVolume * 0.35 * (isHomescreenMusicMuffled ? 0.3 : 1) : 0;
        homescreenMusicGainNode.gain.setTargetAtTime(targetVolume, audioContext.currentTime, 0.1);
    }
}

function startHomescreenMusic() {
    // Don't start if already playing
    if (homescreenMusic) return;
    
    // Only start if on homescreen
    if (!homeScreen || homeScreen.classList.contains('hidden')) return;
    
    initAudio();
    
    homescreenMusic = new Audio('Homescreen music.wav');
    homescreenMusic.loop = true;
    
    // Create a MediaElementSource and connect through gain node
    const source = audioContext.createMediaElementSource(homescreenMusic);
    homescreenMusicGainNode = audioContext.createGain();
    homescreenMusicGainNode.gain.value = soundEnabled ? masterVolume * 0.35 : 0;
    
    source.connect(homescreenMusicGainNode);
    homescreenMusicGainNode.connect(audioContext.destination);
    
    homescreenMusic.play().catch(e => console.warn('Homescreen music autoplay blocked:', e));
}

function stopHomescreenMusic() {
    if (homescreenMusic) {
        homescreenMusic.pause();
        homescreenMusic.currentTime = 0;
        homescreenMusic = null;
        homescreenMusicGainNode = null;
    }
    isHomescreenMusicMuffled = false; // Reset muffle state
}

function setHomescreenMusicMuffled(muffled) {
    isHomescreenMusicMuffled = muffled;
    updateHomescreenMusicVolume();
}

function setupHomeVolumeControl() {
    const homeMuteBtn = document.getElementById('homeMuteBtn');
    const homeVolumeSlider = document.getElementById('homeVolumeSlider');
    
    if (homeMuteBtn) {
        homeMuteBtn.addEventListener('click', () => {
            initAudio();
            startHomescreenMusic();
            toggleSound();
        });
    }
    
    if (homeVolumeSlider) {
        homeVolumeSlider.value = masterVolume * 100;
        homeVolumeSlider.addEventListener('input', (e) => {
            initAudio();
            startHomescreenMusic();
            setMasterVolume(e.target.value / 100);
        });
    }
}

function updateSoundButtons() {
    const homeMuteBtn = document.getElementById('homeMuteBtn');
    const homeVolumeSlider = document.getElementById('homeVolumeSlider');
    const pauseMuteBtn = document.getElementById('pauseMuteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    
    // Update home screen volume control
    if (homeMuteBtn) {
        homeMuteBtn.textContent = soundEnabled ? '🔊' : '🔇';
        homeMuteBtn.classList.toggle('muted', !soundEnabled);
    }
    if (homeVolumeSlider) {
        homeVolumeSlider.value = masterVolume * 100;
    }
    
    // Update pause menu volume control
    if (pauseMuteBtn) {
        pauseMuteBtn.textContent = soundEnabled ? '🔊' : '🔇';
        pauseMuteBtn.classList.toggle('muted', !soundEnabled);
    }
    if (volumeSlider) {
        volumeSlider.value = masterVolume * 100;
    }
}

// ===== ENHANCED VISUAL EFFECTS SYSTEM =====

// Castle visual state management
function updateCastleVisuals() {
    // Guard against null castle element
    if (!castle) return;
    
    // Update power display whenever castle visuals update
    updatePowerDisplay();
    
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

// Track current orb types to avoid recreating on every update
let currentOrbTypes = '';

function updateCastleOrbs() {
    const orbsContainer = document.getElementById('castleOrbs');
    if (!orbsContainer) return;
    
    // Collect unique orb types (no duplicates)
    const orbTypes = new Set();
    if (gameState.stats.hasFireball) orbTypes.add('fire');
    if (gameState.stats.hasLightning) orbTypes.add('lightning');
    if (gameState.stats.hasMeteor) orbTypes.add('meteor');
    if (gameState.stats.freezeChance > 0) orbTypes.add('ice');
    if (gameState.stats.regen > 0) orbTypes.add('heal');
    
    // Create a string key to compare with current state
    const newOrbKey = Array.from(orbTypes).sort().join(',');
    
    // Only recreate orbs if the set of abilities changed
    if (newOrbKey === currentOrbTypes) return;
    currentOrbTypes = newOrbKey;
    
    orbsContainer.innerHTML = '';
    
    const orbData = {
        fire: '🔥',
        lightning: '⚡',
        meteor: '☄️',
        ice: '❄️',
        heal: '💚'
    };
    
    const orbs = Array.from(orbTypes).map(type => ({ type, icon: orbData[type] }));
    const count = orbs.length;
    
    orbs.forEach((orb, index) => {
        const orbEl = document.createElement('div');
        orbEl.className = `floating-orb ${orb.type}`;
        
        // Wrap icon in span for counter-rotation
        const iconSpan = document.createElement('span');
        iconSpan.className = 'orb-icon';
        iconSpan.textContent = orb.icon;
        orbEl.appendChild(iconSpan);
        
        // Calculate starting angle for even spacing
        const startAngle = (360 / count) * index;
        orbEl.style.setProperty('--start-angle', `${startAngle}deg`);
        
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
        version: "1.9.0",
        title: "Audio & Music Update",
        date: "January 12, 2026",
        changes: [
            "🎵 Homescreen music added - plays on the main menu and loops!",
            "🎶 In-game music added - plays during gameplay with seamless transitions",
            "🔊 Volume slider added to homescreen (bottom right) with mute button",
            "🔉 Volume slider in pause menu controls all game audio",
            "🎧 Music muffles during loading screen for smooth transitions",
            "📖 Music muffles when viewing Patch Notes or Help screens",
            "🔇 Mute button now properly mutes/unmutes all music",
            "👾 Enemy counter now shows remaining enemies in the wave (counts down)",
            "✨ Mythic card shine effect now plays once (like gold/silver shines)",
            "⚖️ Legendary upgrades are now rarer in the 'Choose Upgrade' selection",
            "🎁 Mystery boxes and Golden boxes unaffected by legendary rarity change",
            "🎼 Music credit added: Music by César da Rocha"
        ]
    },
    {
        version: "1.8.0",
        title: "Curse System & Quality of Life Update",
        date: "January 11, 2026",
        changes: [
            "⏸️ On keyboard you can now press 'ESC' or 'P' to pause/unpause the game",
            "❓ Help screen updated, generalized and simplified",
            "💀 Curses are now temporary! Minor curses last 8 waves, Moderate 5 waves, Devastating 3 waves",
            "📜 New 'Your Collection' tab in pause menu - shows both upgrades AND active curses",
            "🔮 Curses grouped by severity (Devastating, Moderate, Minor) with wave countdown",
            "🎴 Click on curses in pause menu to see detailed info and remaining duration per stack",
            "💔 Devastating curse card effect changed to red pulsating edge glow",
            "🔄 Ricochet arrows now faster (speed 14) and smarter targeting",
            "🎯 Ricochet arrows no longer target enemies already targeted by other arrows",
            "⏸️ Pause menu now truly pauses everything including enemy spawning",
            "🛡️ Garrison removal fixed - debug panel now properly removes garrison units",
            "💥 'Shattered Dreams' curse now properly removes garrison units when wiped",
            "🔧 Debug panel changes now update pause menu in real-time",
            "⚖️ Difficulty scaling rebalanced - smoother progression through waves",
            "📱 Card swap button mobile layout improved"
        ]
    },
    {
        version: "1.7.0",
        title: "Garrison & Knights Update",
        date: "January 11, 2026",
        changes: [
            "🛡️ New Epic Upgrade: Castle Garrison - summon a permanent guard to defend your castle!",
            "⚔️ Garrison guards are slower but stay forever, patrolling near the castle",
            "🗡️ Summon Knight buffed - now stronger (25 damage) and faster (speed 5)",
            "🔧 Multiple garrisons can be stacked for an army of defenders!",
            "🃏 Debug Panel updated",
        ]
    },
    {
        version: "1.6.0",
        title: "Ricochet & Polish Update",
        date: "January 11, 2026",
        changes: [
            "🔄 Ricochet upgrade now fully functional - arrows bounce between enemies!",
            "🎯 Ricochet targets the enemy closest to your castle for strategic chain kills",
            "💚 Green glowing arrows indicate ricochet bounces with pulsing animation",
            "📖 Updated Help screen with Castle Power explanation and ricochet mechanics",
            "🐛 Fixed game loop duplication bug that caused speed issues on restart",
            "🐛 Fixed reset stats not properly clearing gold and multipliers",
            "🐛 Fixed world ender upgrade chain explosion bug",
            "🔧 Debug mode added for testing (hidden feature for developers)"
        ]
    },
    {
        version: "1.5.0",
        title: "Mythic Power & Dynamic Difficulty",
        date: "January 10, 2026",
        changes: [
            "✨ New MYTHIC rarity tier - the most powerful upgrades in the game!",
            "🎁 Golden Mystery Box - appears on boss waves (5, 10, 15...) with guaranteed legendary+ rewards!",
            "💎 6 Mythic upgrades: Godslayer, Immortal, Archmage, Golden God, Omega, World Ender",
            "⚡ Mythic upgrades have unique powerful effects (double magic damage, death explosions, etc.)",
            "🃏 Card deck expanded to 6 slots (was 5)",
            "🔄 New card swap system - when deck is full, swap with existing cards or discard",
            "🛡️ Early game protection - no cursed waves or mystery box debuffs for first 5 waves",
            "🎯 Attack range system - castle now has limited shooting range, Long Bow upgrades increase it!",
            "⚔️ Castle Power system - new HUD display shows your overall strength",
            "📈 Dynamic difficulty scaling - enemies now scale based on your power AND wave number",
            "🎚️ Difficulty slider reworked - determines how aggressively enemies scale vs your power",
            "👹 Late game boss scaling - bosses get significantly tougher in later waves",
            "🎨 Fixed buff indicator orbs - meteor trail no longer appears on castle orbs",
            "🃏 Fixed 6-card deck fan effect for proper visual display"
        ]
    },
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
    legendary: { name: 'Legendary', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#D97706' },
    mythic: { name: 'MYTHIC', color: '#FF1493', bgColor: 'rgba(255, 20, 147, 0.25)', borderColor: '#FF69B4' }
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
// isInstant: true = effect happens once immediately, false = effect lasts for waves
// waveDuration: number of waves the debuff lasts (minor=8, moderate=5, devastating=3)
const DEBUFF_CARDS = {
    // Minor debuffs (8 waves)
    rusty_arrows: { id: 'rusty_arrows', name: 'Rusty Arrows', icon: '🔩', desc: '-15% arrow damage (8 waves)', severity: 'minor', waveDuration: 8, statKey: 'damageDebuffMult', statValue: 0.85, effect: () => { gameState.stats.damageDebuffMult = (gameState.stats.damageDebuffMult || 1) * 0.85; } },
    sluggish: { id: 'sluggish', name: 'Sluggish', icon: '🐌', desc: '-12% attack speed (8 waves)', severity: 'minor', waveDuration: 8, statKey: 'attackSpeedDebuffMult', statValue: 0.88, effect: () => { gameState.stats.attackSpeedDebuffMult = (gameState.stats.attackSpeedDebuffMult || 1) * 0.88; } },
    cracked_walls: { id: 'cracked_walls', name: 'Cracked Walls', icon: '🧱', desc: '-20 max health', severity: 'minor', isInstant: true, effect: () => { gameState.stats.maxHealth = Math.max(50, gameState.stats.maxHealth - 20); gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth); updateHealthBar(); } },
    weak_armor: { id: 'weak_armor', name: 'Weak Armor', icon: '🩹', desc: '+8% damage taken (8 waves)', severity: 'minor', waveDuration: 8, statKey: 'armorDebuff', statValue: 0.08, effect: () => { gameState.stats.armorDebuff = (gameState.stats.armorDebuff || 0) + 0.08; } },
    blurry_vision: { id: 'blurry_vision', name: 'Blurry Vision', icon: '👁️', desc: '-8% critical chance (8 waves)', severity: 'minor', waveDuration: 8, statKey: 'critChanceDebuff', statValue: 0.08, effect: () => { gameState.stats.critChanceDebuff = (gameState.stats.critChanceDebuff || 0) + 0.08; } },
    
    // Moderate debuffs (5 waves)
    enemy_haste: { id: 'enemy_haste', name: 'Enemy Haste', icon: '💨', desc: 'Enemies move 20% faster (5 waves)', severity: 'moderate', waveDuration: 5, statKey: 'enemySpeedDebuff', statValue: 1.2, effect: () => { gameState.stats.enemySpeedDebuff = (gameState.stats.enemySpeedDebuff || 1) * 1.2; } },
    gold_tax: { id: 'gold_tax', name: 'Gold Tax', icon: '💸', desc: 'Lose 30% of current gold', severity: 'moderate', isInstant: true, effect: () => { gameState.gold = Math.floor(gameState.gold * 0.7); updateGoldDisplay(); } },
    frail_castle: { id: 'frail_castle', name: 'Frail Castle', icon: '🏚️', desc: '-40 max health', severity: 'moderate', isInstant: true, effect: () => { gameState.stats.maxHealth = Math.max(50, gameState.stats.maxHealth - 40); gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth); updateHealthBar(); } },
    dull_blades: { id: 'dull_blades', name: 'Dull Blades', icon: '🗡️', desc: '-25% arrow damage (5 waves)', severity: 'moderate', waveDuration: 5, statKey: 'damageDebuffMult', statValue: 0.75, effect: () => { gameState.stats.damageDebuffMult = (gameState.stats.damageDebuffMult || 1) * 0.75; } },
    slow_reflexes: { id: 'slow_reflexes', name: 'Slow Reflexes', icon: '⏰', desc: '-20% attack speed (5 waves)', severity: 'moderate', waveDuration: 5, statKey: 'attackSpeedDebuffMult', statValue: 0.8, effect: () => { gameState.stats.attackSpeedDebuffMult = (gameState.stats.attackSpeedDebuffMult || 1) * 0.8; } }
};

// Devastating debuffs (from mystery boxes only) - 3 waves or instant
const DEVASTATING_DEBUFFS = {
    cursed_gold: { id: 'cursed_gold', name: 'Cursed Gold', icon: '💀', desc: 'Lose 70% of all gold', severity: 'devastating', isInstant: true, effect: () => { gameState.gold = Math.floor(gameState.gold * 0.3); updateGoldDisplay(); } },
    shattered_walls: { id: 'shattered_walls', name: 'Shattered Walls', icon: '💔', desc: '-100 max health', severity: 'devastating', isInstant: true, effect: () => { gameState.stats.maxHealth = Math.max(50, gameState.stats.maxHealth - 100); gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth); updateHealthBar(); } },
    weakened_arms: { id: 'weakened_arms', name: 'Weakened Arms', icon: '😫', desc: '-50% arrow damage (3 waves)', severity: 'devastating', waveDuration: 3, statKey: 'damageDebuffMult', statValue: 0.5, effect: () => { gameState.stats.damageDebuffMult = (gameState.stats.damageDebuffMult || 1) * 0.5; } },
    broken_bow: { id: 'broken_bow', name: 'Broken Bow', icon: '🏹', desc: '-45% attack speed (3 waves)', severity: 'devastating', waveDuration: 3, statKey: 'attackSpeedDebuffMult', statValue: 0.55, effect: () => { gameState.stats.attackSpeedDebuffMult = (gameState.stats.attackSpeedDebuffMult || 1) * 0.55; } },
    enemy_fury: { id: 'enemy_fury', name: 'Enemy Fury', icon: '😡', desc: 'Enemies deal +40% damage (3 waves)', severity: 'devastating', waveDuration: 3, statKey: 'enemyDamageDebuff', statValue: 1.4, effect: () => { gameState.stats.enemyDamageDebuff = (gameState.stats.enemyDamageDebuff || 1) * 1.4; } },
    doom_curse: { id: 'doom_curse', name: 'Doom Curse', icon: '☠️', desc: 'Take 70 damage immediately', severity: 'devastating', isInstant: true, effect: () => { gameState.castle.health = Math.max(1, gameState.castle.health - 70); updateHealthBar(); } }
};

// ===== UPGRADE DEFINITIONS =====
const UPGRADES = {
    // === COMMON UPGRADES ===
    // Weapon - Common
    damage_c: { id: 'damage_c', name: 'Sharp Arrows', icon: '🏹', type: 'weapon', rarity: 'common', desc: '+15% arrow damage', effect: () => { gameState.stats.damage *= 1.15; }, repeatable: true },
    attackSpeed_c: { id: 'attackSpeed_c', name: 'Quick Hands', icon: '✋', type: 'weapon', rarity: 'common', desc: '+12% attack speed', effect: () => { gameState.stats.attackSpeed *= 1.12; }, repeatable: true },
    // Defense - Common
    health_c: { id: 'health_c', name: 'Wooden Planks', icon: '🪵', type: 'defense', rarity: 'common', desc: '+20 max health', effect: () => { gameState.stats.maxHealth += 20; }, repeatable: true },
    armor_c: { id: 'armor_c', name: 'Leather Padding', icon: '🧥', type: 'defense', rarity: 'common', desc: '-8% damage taken', effect: () => { gameState.stats.armor += 0.08; }, repeatable: true },
    // Magic - Common  
    slow_c: { id: 'slow_c', name: 'Chilling Touch', icon: '🌬️', type: 'magic', rarity: 'common', desc: '15% chance to slow enemies', effect: () => { gameState.stats.freezeChance = Math.min(0.6, gameState.stats.freezeChance + 0.15); }, repeatable: true },

    // === UNCOMMON UPGRADES ===
    // Weapon - Uncommon
    damage_u: { id: 'damage_u', name: 'Steel Tips', icon: '🗡️', type: 'weapon', rarity: 'uncommon', desc: '+25% arrow damage', effect: () => { gameState.stats.damage *= 1.25; }, repeatable: true },
    attackSpeed_u: { id: 'attackSpeed_u', name: 'Quick Draw', icon: '⚡', type: 'weapon', rarity: 'uncommon', desc: '+20% attack speed', effect: () => { gameState.stats.attackSpeed *= 1.20; }, repeatable: true },
    critChance_u: { id: 'critChance_u', name: 'Keen Eye', icon: '👁️', type: 'weapon', rarity: 'uncommon', desc: '+8% critical chance', effect: () => { gameState.stats.critChance += 0.08; }, repeatable: true },
    // Defense - Uncommon
    health_u: { id: 'health_u', name: 'Fortify Walls', icon: '🧱', type: 'defense', rarity: 'uncommon', desc: '+40 max health', effect: () => { gameState.stats.maxHealth += 40; }, repeatable: true },
    armor_u: { id: 'armor_u', name: 'Iron Plates', icon: '🛡️', type: 'defense', rarity: 'uncommon', desc: '-12% damage taken', effect: () => { gameState.stats.armor += 0.12; }, repeatable: true },
    regen_u: { id: 'regen_u', name: 'Healing Moss', icon: '🌿', type: 'defense', rarity: 'uncommon', desc: 'Regenerate 0.8 HP/sec', effect: () => { gameState.stats.regen += 0.8; }, repeatable: true },
    // Magic - Uncommon
    ricochet_u: { id: 'ricochet_u', name: 'Ricochet', icon: '💠', type: 'magic', rarity: 'uncommon', desc: 'Arrows bounce to +1 enemy', effect: () => { gameState.stats.ricochet = (gameState.stats.ricochet || 0) + 1; }, repeatable: true },

    // === RARE UPGRADES ===
    // Weapon - Rare
    damage_r: { id: 'damage_r', name: 'Enchanted Arrows', icon: '✨', type: 'weapon', rarity: 'rare', desc: '+45% arrow damage', effect: () => { gameState.stats.damage *= 1.45; }, repeatable: true },
    attackSpeed_r: { id: 'attackSpeed_r', name: 'Rapid Fire', icon: '💨', type: 'weapon', rarity: 'rare', desc: '+30% attack speed', effect: () => { gameState.stats.attackSpeed *= 1.30; }, repeatable: true },
    critChance_r: { id: 'critChance_r', name: 'Deadly Aim', icon: '💀', type: 'weapon', rarity: 'rare', desc: '+12% critical chance', effect: () => { gameState.stats.critChance += 0.12; }, repeatable: true },
    critDamage_r: { id: 'critDamage_r', name: 'Brutal Force', icon: '💥', type: 'weapon', rarity: 'rare', desc: '+50% critical damage', effect: () => { gameState.stats.critDamage += 0.5; }, repeatable: true },
    multishot_r: { id: 'multishot_r', name: 'Multi-Shot', icon: '🎯', type: 'weapon', rarity: 'rare', desc: 'Fire +1 arrow at once', effect: () => { gameState.stats.projectiles += 1; }, repeatable: true },
    // Defense - Rare
    health_r: { id: 'health_r', name: 'Stone Walls', icon: '🏯', type: 'defense', rarity: 'rare', desc: '+65 max health', effect: () => { gameState.stats.maxHealth += 65; }, repeatable: true },
    armor_r: { id: 'armor_r', name: 'Steel Fortress', icon: '🏰', type: 'defense', rarity: 'rare', desc: '-18% damage taken', effect: () => { gameState.stats.armor += 0.18; }, repeatable: true },
    regen_r: { id: 'regen_r', name: 'Healing Aura', icon: '💚', type: 'defense', rarity: 'rare', desc: 'Regenerate 1.5 HP/sec', effect: () => { gameState.stats.regen += 1.5; }, repeatable: true },
    thorns_r: { id: 'thorns_r', name: 'Thorns', icon: '🌹', type: 'defense', rarity: 'rare', desc: 'Deal 20 damage when hit', effect: () => { gameState.stats.thorns += 20; }, repeatable: true },
    // Magic - Rare
    fireball_r: { id: 'fireball_r', name: 'Fireball', icon: '🔥', type: 'magic', rarity: 'rare', desc: 'Unlock explosive fireballs', effect: () => { gameState.stats.hasFireball = true; } },
    freeze_r: { id: 'freeze_r', name: 'Frost Nova', icon: '❄️', type: 'magic', rarity: 'rare', desc: '35% chance to slow enemies', effect: () => { gameState.stats.freezeChance = Math.min(0.7, gameState.stats.freezeChance + 0.35); } },

    // === EPIC UPGRADES ===
    // Weapon - Epic
    damage_e: { id: 'damage_e', name: 'Dragon Arrows', icon: '🐉', type: 'weapon', rarity: 'epic', desc: '+65% arrow damage', effect: () => { gameState.stats.damage *= 1.65; }, repeatable: true },
    critChance_e: { id: 'critChance_e', name: 'Assassin\'s Mark', icon: '🗡️', type: 'weapon', rarity: 'epic', desc: '+18% critical chance', effect: () => { gameState.stats.critChance += 0.18; }, repeatable: true },
    critDamage_e: { id: 'critDamage_e', name: 'Executioner', icon: '⚔️', type: 'weapon', rarity: 'epic', desc: '+100% critical damage', effect: () => { gameState.stats.critDamage += 1.0; }, repeatable: true },
    // Defense - Epic
    health_e: { id: 'health_e', name: 'Titan Walls', icon: '🗿', type: 'defense', rarity: 'epic', desc: '+100 max health', effect: () => { gameState.stats.maxHealth += 100; }, repeatable: true },
    lifeSteal_e: { id: 'lifeSteal_e', name: 'Vampiric Arrows', icon: '🧛', type: 'defense', rarity: 'epic', desc: 'Heal 8% of damage dealt', effect: () => { gameState.stats.lifeSteal = (gameState.stats.lifeSteal || 0) + 0.08; } },
    // Magic - Epic
    lightning_e: { id: 'lightning_e', name: 'Chain Lightning', icon: '⚡', type: 'magic', rarity: 'epic', desc: 'Lightning chains to 4 enemies', effect: () => { gameState.stats.hasLightning = true; } },
    explosion_e: { id: 'explosion_e', name: 'Explosive Arrows', icon: '💣', type: 'magic', rarity: 'epic', desc: 'Arrows explode on impact', effect: () => { gameState.stats.explosiveArrows = true; } },

    // === LEGENDARY UPGRADES ===
    // Weapon - Legendary
    damage_l: { id: 'damage_l', name: 'Divine Arrows', icon: '🌟', type: 'weapon', rarity: 'legendary', desc: '+125% arrow damage', effect: () => { gameState.stats.damage *= 2.25; } },
    multishot_l: { id: 'multishot_l', name: 'Arrow Storm', icon: '🌪️', type: 'weapon', rarity: 'legendary', desc: 'Fire +4 arrows at once', effect: () => { gameState.stats.projectiles += 4; } },
    // Defense - Legendary
    invincible_l: { id: 'invincible_l', name: 'Divine Shield', icon: '👼', type: 'defense', rarity: 'legendary', desc: '25% chance to block all damage', effect: () => { gameState.stats.blockChance = (gameState.stats.blockChance || 0) + 0.25; } },
    health_l: { id: 'health_l', name: 'Eternal Fortress', icon: '🌌', type: 'defense', rarity: 'legendary', desc: '+200 max health', effect: () => { gameState.stats.maxHealth += 200; } },
    // Magic - Legendary
    meteor_l: { id: 'meteor_l', name: 'Meteor Strike', icon: '☄️', type: 'magic', rarity: 'legendary', desc: 'Meteors rain on enemies', effect: () => { gameState.stats.hasMeteor = true; } },
    vortex_l: { id: 'vortex_l', name: 'Void Vortex', icon: '🌀', type: 'magic', rarity: 'legendary', desc: 'Pull enemies together', effect: () => { gameState.stats.hasVortex = true; } },
    
    // === NEW UPGRADES ===
    // Common - new
    gold_find_c: { id: 'gold_find_c', name: 'Gold Finder', icon: '🪙', type: 'utility', rarity: 'common', desc: '+15% gold from kills', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 1.15; }, repeatable: true },
    range_c: { id: 'range_c', name: 'Long Bow', icon: '🎯', type: 'weapon', rarity: 'common', desc: '+20% attack range', effect: () => { gameState.stats.attackRange = (gameState.stats.attackRange || 1) * 1.20; }, repeatable: true },
    
    // Uncommon - new
    poison_u: { id: 'poison_u', name: 'Poison Tips', icon: '☠️', type: 'magic', rarity: 'uncommon', desc: 'Arrows deal +8 poison damage over 3s', effect: () => { gameState.stats.poisonDamage = (gameState.stats.poisonDamage || 0) + 8; }, repeatable: true },
    dodge_u: { id: 'dodge_u', name: 'Reinforced Gates', icon: '🚪', type: 'defense', rarity: 'uncommon', desc: '8% chance to dodge attacks', effect: () => { gameState.stats.dodgeChance = (gameState.stats.dodgeChance || 0) + 0.08; }, repeatable: true },
    gold_find_u: { id: 'gold_find_u', name: 'Treasure Hunter', icon: '💎', type: 'utility', rarity: 'uncommon', desc: '+25% gold from kills', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 1.25; }, repeatable: true },
    
    // Rare - new
    splash_r: { id: 'splash_r', name: 'Splash Damage', icon: '💦', type: 'magic', rarity: 'rare', desc: 'Arrows deal 40% damage to nearby enemies', effect: () => { gameState.stats.splashDamage = (gameState.stats.splashDamage || 0) + 0.4; } },
    execute_r: { id: 'execute_r', name: 'Execute', icon: '⚰️', type: 'weapon', rarity: 'rare', desc: 'Deal +75% damage to enemies below 25% HP', effect: () => { gameState.stats.executeDamage = (gameState.stats.executeDamage || 0) + 0.75; } },
    reflect_r: { id: 'reflect_r', name: 'Magic Mirror', icon: '🪞', type: 'defense', rarity: 'rare', desc: 'Reflect 30% of ranged damage', effect: () => { gameState.stats.reflectDamage = (gameState.stats.reflectDamage || 0) + 0.3; } },
    
    // Epic - new
    berserker_e: { id: 'berserker_e', name: 'Berserker', icon: '🔥', type: 'weapon', rarity: 'epic', desc: '+1.5% damage per 1% missing health', effect: () => { gameState.stats.hasBerserker = true; } },
    guardian_e: { id: 'guardian_e', name: 'Guardian Angel', icon: '👼', type: 'defense', rarity: 'epic', desc: 'Survive lethal damage once per wave', effect: () => { gameState.stats.hasGuardian = true; } },
    gold_rush_e: { id: 'gold_rush_e', name: 'Midas Touch', icon: '👑', type: 'utility', rarity: 'epic', desc: '+65% gold from all sources', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 1.65; } },
    garrison_e: { id: 'garrison_e', name: 'Castle Garrison', icon: '🛡️', type: 'defense', rarity: 'epic', desc: 'A guard permanently defends your castle', effect: () => { gameState.stats.garrisonCount = (gameState.stats.garrisonCount || 0) + 1; spawnGarrison(); }, repeatable: true },
    
    // Legendary - new
    infinity_l: { id: 'infinity_l', name: 'Infinity', icon: '♾️', type: 'weapon', rarity: 'legendary', desc: 'Every 4th arrow deals triple damage', effect: () => { gameState.stats.hasInfinity = true; } },
    phoenix_l: { id: 'phoenix_l', name: 'Phoenix Heart', icon: '🔥', type: 'defense', rarity: 'legendary', desc: 'Revive once with 75% health when killed', effect: () => { gameState.stats.hasPhoenix = true; } },
    time_lord_l: { id: 'time_lord_l', name: 'Time Lord', icon: '⌛', type: 'magic', rarity: 'legendary', desc: 'Enemies move 35% slower permanently', effect: () => { gameState.stats.enemySlowAura = (gameState.stats.enemySlowAura || 1) * 0.65; } },
    
    // === MYTHIC UPGRADES (Golden Box Only) ===
    godslayer_m: { id: 'godslayer_m', name: 'Godslayer', icon: '⚔️', type: 'weapon', rarity: 'mythic', desc: '+250% damage, +60% crit chance', effect: () => { gameState.stats.damage *= 3.5; gameState.stats.critChance = (gameState.stats.critChance || 0.05) + 0.6; } },
    immortal_m: { id: 'immortal_m', name: 'Immortal', icon: '👼', type: 'defense', rarity: 'mythic', desc: '+400 max HP, regenerate 8 HP per second', effect: () => { gameState.stats.maxHealth += 400; gameState.stats.regen += 8; } },
    archmage_m: { id: 'archmage_m', name: 'Archmage', icon: '🧙', type: 'magic', rarity: 'mythic', desc: 'All magic effects deal 2.5x damage', effect: () => { gameState.stats.magicDamageMultiplier = (gameState.stats.magicDamageMultiplier || 1) * 2.5; } },
    golden_god_m: { id: 'golden_god_m', name: 'Golden God', icon: '👑', type: 'utility', rarity: 'mythic', desc: '+150% gold, enemies drop bonus gold on death', effect: () => { gameState.stats.goldMultiplier = (gameState.stats.goldMultiplier || 1) * 2.5; gameState.stats.bonusGoldOnKill = (gameState.stats.bonusGoldOnKill || 0) + 15; } },
    omega_m: { id: 'omega_m', name: 'Omega', icon: 'Ω', type: 'weapon', rarity: 'mythic', desc: 'Fire 6 extra projectiles, +150% fire rate', effect: () => { gameState.stats.projectiles += 6; gameState.stats.attackSpeed *= 2.5; } },
    world_ender_m: { id: 'world_ender_m', name: 'World Ender', icon: '🌋', type: 'magic', rarity: 'mythic', desc: 'Enemies explode on death dealing 65% of their max HP to nearby', effect: () => { gameState.stats.deathExplosion = true; } }
};

// Function to get rarity weights based on wave
function getRarityWeights(wave) {
    // Early game: mostly common
    // Mid game: uncommon/rare
    // Late game: epic/legendary (legendary is rare)
    if (wave <= 3) {
        return { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 };
    } else if (wave <= 6) {
        return { common: 45, uncommon: 40, rare: 12, epic: 3, legendary: 0 };
    } else if (wave <= 10) {
        return { common: 27, uncommon: 36, rare: 28, epic: 8, legendary: 1 };
    } else if (wave <= 15) {
        return { common: 12, uncommon: 28, rare: 35, epic: 21, legendary: 4 };
    } else {
        return { common: 8, uncommon: 18, rare: 32, epic: 32, legendary: 10 };
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
    },
    // NEW ENEMIES - More variety
    witch: {
        name: 'Swamp Witch',
        emoji: '🧙‍♀️',
        baseHealth: 32,
        baseDamage: 8,
        speed: 0.85,
        value: 4,
        class: 'witch',
        ranged: true,
        range: 170
    },
    zombie: {
        name: 'Undead Horde',
        emoji: '🧟',
        baseHealth: 25,
        baseDamage: 4,
        speed: 0.6,
        value: 2,
        class: 'zombie'
    },
    bat: {
        name: 'Giant Bat',
        emoji: '🦇',
        baseHealth: 14,
        baseDamage: 3,
        speed: 2.2,
        value: 2,
        class: 'bat'
    },
    spider: {
        name: 'Giant Spider',
        emoji: '🕷️',
        baseHealth: 20,
        baseDamage: 6,
        speed: 1.7,
        value: 3,
        class: 'spider'
    },
    wolf: {
        name: 'Dire Wolf',
        emoji: '🐺',
        baseHealth: 35,
        baseDamage: 7,
        speed: 1.8,
        value: 3,
        class: 'wolf'
    },
    bear: {
        name: 'Cave Bear',
        emoji: '🐻',
        baseHealth: 90,
        baseDamage: 12,
        speed: 0.7,
        value: 5,
        class: 'bear'
    },
    snake: {
        name: 'Serpent',
        emoji: '🐍',
        baseHealth: 18,
        baseDamage: 10,
        speed: 1.5,
        value: 3,
        class: 'snake'
    },
    // BOSS ENEMIES - Strong and bigger
    orcChampion: {
        name: 'Orc Champion',
        emoji: '👹',
        baseHealth: 250,
        baseDamage: 18,
        speed: 0.55,
        value: 15,
        class: 'boss orc-champion',
        isBoss: true,
        size: 1.5
    },
    trollKing: {
        name: 'Troll King',
        emoji: '👑',
        baseHealth: 400,
        baseDamage: 25,
        speed: 0.45,
        value: 25,
        class: 'boss troll-king',
        isBoss: true,
        size: 1.8
    },
    elderDragon: {
        name: 'Elder Dragon',
        emoji: '🐲',
        baseHealth: 600,
        baseDamage: 35,
        speed: 0.5,
        value: 40,
        class: 'boss elder-dragon',
        isBoss: true,
        size: 2.2
    },
    lichLord: {
        name: 'Lich Lord',
        emoji: '💀',
        baseHealth: 350,
        baseDamage: 20,
        speed: 0.4,
        value: 30,
        class: 'boss lich-lord',
        isBoss: true,
        size: 1.6,
        ranged: true,
        range: 200
    },
    demonLord: {
        name: 'Demon Lord',
        emoji: '😈',
        baseHealth: 800,
        baseDamage: 40,
        speed: 0.35,
        value: 50,
        class: 'boss demon-lord',
        isBoss: true,
        size: 2.5
    },
    // HUGE BOSSES - Very rare, very dangerous
    titan: {
        name: 'Ancient Titan',
        emoji: '🗿',
        baseHealth: 1500,
        baseDamage: 60,
        speed: 0.25,
        value: 100,
        class: 'boss titan',
        isBoss: true,
        size: 3.0
    },
    worldEater: {
        name: 'World Eater',
        emoji: '🐉',
        baseHealth: 2000,
        baseDamage: 80,
        speed: 0.3,
        value: 150,
        class: 'boss world-eater',
        isBoss: true,
        size: 3.5
    }
};

// ===== SHOP ITEMS =====
const SHOP_ITEMS = {
    smallRepair: { id: 'smallRepair', name: 'Small Repair', icon: '🔧', desc: 'Restore +25 HP', price: 25, type: 'repair', healAmount: 25 },
    mediumRepair: { id: 'mediumRepair', name: 'Medium Repair', icon: '🔩', desc: 'Restore +50 HP', price: 50, type: 'repair', healAmount: 50 },
    fullRepair: { id: 'fullRepair', name: 'Full Repair', icon: '⚒️', desc: 'Restore to full HP', price: 100, type: 'repair', healAmount: 'full' },
    mysteryUpgrade: { id: 'mysteryUpgrade', name: 'Mystery Box', icon: '🎁', desc: 'Random upgrade', price: 75, type: 'upgrade' },
    goldenBox: { id: 'goldenBox', name: 'Golden Box', icon: '✨', desc: 'Guaranteed legendary!', price: 300, type: 'golden', everyNWaves: 5 }
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
        attackRange: 1, // Multiplier for shooting range (1 = 100% of base range)
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
    actionCards: [], // Card deck for consumable action cards (max 6)
    pendingActionCard: null, // For card swap when deck is full
    waveStarted: false,
    expectedEnemies: 0,
    waveKills: 0,
    pendingSpawns: [],
    // Manual targeting - when player clicks and holds on the map
    manualTarget: null, // { x, y } or null for automatic targeting
    // Mystery box limit per wave
    mysteryBoxesBought: 0,
    // Golden box purchased this wave (only 1 per wave, only on waves divisible by 5)
    goldenBoxBought: false
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
    
    // Muffle homescreen music during loading
    setHomescreenMusicMuffled(true);
    
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
function openModal(modal) {
    modal.classList.add('active');
    // Muffle homescreen music when opening patch notes or help
    if (modal.id === 'patchNotesModal' || modal.id === 'helpModal') {
        setHomescreenMusicMuffled(true);
    }
}

function closeModal(modal) {
    modal.classList.remove('active');
    // Unmuffle homescreen music when closing patch notes or help
    if (modal.id === 'patchNotesModal' || modal.id === 'helpModal') {
        setHomescreenMusicMuffled(false);
    }
}

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
    const volumeControlHome = document.getElementById('volumeControlHome');
    
    // Setup home volume control
    setupHomeVolumeControl();
    
    banner.classList.add('entrance-animation');
    banner.addEventListener('click', () => {
        initAudio();
        startHomescreenMusic();
        playSound('titleClick');
        banner.classList.remove('click-animation');
        void banner.offsetWidth;
        banner.classList.add('click-animation');
        createBannerSparkles(banner);
    });
    
    // Add hover sounds to all menu buttons
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-credits, .btn-sound, .volume-mute-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            initAudio(); // Initialize audio on first hover
            startHomescreenMusic(); // Start music on first interaction
            playSound('hover');
        });
    });

    // Set initial hidden state for animations
    menuButtons.style.opacity = '0';
    menuButtons.style.transform = 'translateY(30px)';
    creditsButton.style.opacity = '0';
    creditsButton.style.transform = 'translateY(30px)';
    if (volumeControlHome) {
        volumeControlHome.style.opacity = '0';
        volumeControlHome.style.transform = 'translateY(30px)';
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
        if (volumeControlHome) {
            volumeControlHome.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            volumeControlHome.style.opacity = '1';
            volumeControlHome.style.transform = 'translateY(0)';
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
            attackRange: 1,
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
            damageMultiplier: 1,
            goldMultiplier: 1,
            ricochet: 0,
            enemySpeedDebuff: 1,
            enemyDamageDebuff: 1
        },
        enemies: [],
        projectiles: [],
        lastAttackTime: 0,
        lastFireballTime: 0,
        lastLightningTime: 0,
        lastMeteorTime: 0,
        earnedUpgrades: [],
        appliedDebuffs: [],
        activeDebuffs: [], // Debuffs with remaining wave duration: { id, remainingWaves, debuffData }
        actionCards: [],
        pendingActionCard: null,
        waveStarted: false,
        expectedEnemies: 0,
        waveKills: 0,
        pendingSpawns: [],
        manualTarget: null,
        mysteryBoxesBought: 0,
        goldenBoxBought: false
    };
    
    // Switch to game screen
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Stop homescreen music and start game background music
    stopHomescreenMusic();
    startBackgroundMusic();
    
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
    updatePowerDisplay();
    killCount.textContent = '0';
    
    // Initialize card deck
    renderCardDeck();
    
    // Setup manual targeting (click and hold to aim)
    setupManualTargeting();
    
    // Start wave
    startWave();
    
    // Clear any existing game loop before starting new one
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    
    // Start game loop
    gameLoop = setInterval(update, 1000 / 60);
}

// ===== WAVE SYSTEM =====
function startWave() {
    const isBossWave = gameState.wave % 5 === 0;
    
    // Update end wave button visibility
    updateEndWaveButton();
    
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
    // Debug: Skip spawning if no enemies mode
    if (debugState.noEnemies) {
        gameState.waveEnemies = 0;
        return;
    }
    
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
    // Cap wave tier at 5 (wave 25) - after that, only difficulty increases, not duration
    const waveTier = Math.min(5, Math.floor(wave / 5));
    const waveScaleMultiplier = Math.pow(1.12, waveTier);
    // Spawn delay also increases every 5 waves (enemies spawn more spread out = longer wave)
    // Capped at wave 25 to prevent excessively long waves
    const waveDelayMultiplier = 1 + waveTier * 0.1;
    
    let enemies = [];
    
    if (isBossWave) {
        // Progressive boss types based on wave
        let bossType = 'boss';
        if (wave >= 10) bossType = 'orcChampion';
        if (wave >= 20) bossType = 'trollKing';
        if (wave >= 30) bossType = 'elderDragon';
        if (wave >= 40) bossType = 'lichLord';
        if (wave >= 50) bossType = 'demonLord';
        if (wave >= 75) bossType = 'titan';
        if (wave >= 100) bossType = 'worldEater';
        
        enemies.push({ type: bossType, delay: 0 });
        
        // Add extra bosses every 15 waves
        const extraBosses = Math.floor(wave / 15);
        for (let b = 0; b < extraBosses; b++) {
            // Earlier boss types as adds
            let addBoss = 'boss';
            if (wave >= 30) addBoss = 'orcChampion';
            if (wave >= 45) addBoss = 'trollKing';
            enemies.push({ type: addBoss, delay: (1000 + b * 600) * spawnDelayMultiplier * waveDelayMultiplier });
        }
        
        // Add dragon/elder dragon on boss waves 15+
        if (wave >= 15) {
            const dragonCount = Math.floor(wave / 15);
            for (let d = 0; d < dragonCount; d++) {
                const dragonType = wave >= 40 ? 'elderDragon' : 'dragon';
                enemies.push({ type: dragonType, delay: (1200 + d * 700) * spawnDelayMultiplier * waveDelayMultiplier });
            }
        }
        
        // Fewer minions - reduced formula
        const baseMinionCount = Math.floor(wave * 0.6) + 2;
        const minionCount = Math.floor(baseMinionCount * waveScaleMultiplier);
        for (let i = 0; i < minionCount; i++) {
            // Mix of enemy types for boss waves
            let type = 'orc';
            const roll = Math.random();
            if (wave >= 10 && roll > 0.7) type = 'troll';
            if (wave >= 15 && roll > 0.75) type = 'ogre';
            if (wave >= 20 && roll > 0.8) type = 'demon';
            if (wave >= 25 && roll > 0.85) type = 'golem';
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
            
            // Progressive enemy unlocks with variety - includes new enemies
            if (wave >= 2 && roll > 0.65) type = 'goblin';
            if (wave >= 3 && roll > 0.7) type = 'zombie';
            if (wave >= 4 && roll > 0.75) type = 'troll';
            if (wave >= 5 && roll > 0.72) type = 'bat';
            if (wave >= 6 && roll > 0.78) type = 'spider';
            if (wave >= 7 && roll > 0.8) type = 'ogre';
            if (wave >= 8 && roll > 0.82) type = 'darkMage';
            if (wave >= 9 && roll > 0.76) type = 'wolf';
            if (wave >= 10 && roll > 0.7) type = 'skeleton';
            if (wave >= 11 && roll > 0.84) type = 'witch';
            if (wave >= 12 && roll > 0.88) type = 'dragon';
            if (wave >= 13 && roll > 0.79) type = 'snake';
            if (wave >= 14 && roll > 0.83) type = 'bear';
            
            // Late game: more dangerous enemies become common
            if (wave >= 15) {
                if (roll > 0.5) type = 'skeleton';
                if (roll > 0.6) type = 'wolf';
                if (roll > 0.7) type = 'ogre';
                if (roll > 0.8) type = 'vampire';
                if (roll > 0.85) type = 'darkMage';
                if (roll > 0.9) type = 'necromancer';
                if (roll > 0.95) type = 'dragon';
            }
            
            if (wave >= 20) {
                if (roll > 0.4) type = 'troll';
                if (roll > 0.5) type = 'bear';
                if (roll > 0.6) type = 'ogre';
                if (roll > 0.7) type = 'ghost';
                if (roll > 0.75) type = 'demon';
                if (roll > 0.8) type = 'golem';
                if (roll > 0.88) type = 'dragon';
            }
            
            if (wave >= 30) {
                if (roll > 0.35) type = 'demon';
                if (roll > 0.5) type = 'golem';
                if (roll > 0.65) type = 'necromancer';
                if (roll > 0.8) type = 'dragon';
                if (roll > 0.9) type = 'assassin';
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
                // If paused, delay spawn until unpaused
                if (gameState.isPaused) {
                    const checkPause = setInterval(() => {
                        if (!gameState.isPaused && gameState.isRunning) {
                            clearInterval(checkPause);
                            if (!spawnData.spawned) {
                                spawnData.spawned = true;
                                if (!debugState.noEnemies) {
                                    spawnEnemy(e.type);
                                }
                            }
                        } else if (!gameState.isRunning) {
                            clearInterval(checkPause);
                        }
                    }, 100);
                } else {
                    spawnData.spawned = true;
                    // Debug: Skip if no enemies mode enabled mid-wave
                    if (!debugState.noEnemies) {
                        spawnEnemy(e.type);
                    }
                }
            }
        }, debugState.fastWaves ? 0 : e.delay);
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
        isBoss: enemyDef.isBoss || false,
        size: enemyDef.size || 1,
        element: null
    };
    
    // Create DOM element
    const el = document.createElement('div');
    el.className = `enemy ${enemyDef.class}`;
    el.innerHTML = `<span>${enemyDef.emoji}</span><div class="enemy-health-bar"><div class="enemy-health-fill" style="width: 100%"></div></div>`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.id = `enemy-${enemy.id}`;
    
    // Apply size scaling for bosses
    if (enemyDef.size && enemyDef.size > 1) {
        el.style.transform = `translate(-50%, -50%) scale(${enemyDef.size})`;
        el.classList.add('boss-enemy');
    }
    
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
            // Move toward castle (apply enemy speed debuff - higher means faster enemies)
            let speed = enemy.slowed ? enemy.speed * 0.7 : enemy.speed;
            speed *= (gameState.stats.enemySpeedDebuff || 1);
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
    
    // Apply enemy damage debuff (higher means enemies deal more damage)
    let damage = enemy.damage * (gameState.stats.enemyDamageDebuff || 1);
    
    // Debug: Infinite health mode
    if (debugState.infiniteHealth) {
        showDamageNumber(gameState.castle.x, gameState.castle.y - 50, 'DEBUG', false, true);
        return;
    }
    
    // Apply armor reduction (armorDebuff increases damage taken)
    const effectiveArmor = Math.max(0, gameState.stats.armor - (gameState.stats.armorDebuff || 0));
    damage *= (1 - effectiveArmor);
    
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
    // Handle infinite health debug mode
    if (debugState.infiniteHealth) {
        gameState.castle.health = gameState.stats.maxHealth;
        castleHealthFill.style.width = '100%';
        castleHealthText.innerHTML = '<span class="debug-infinity">∞</span>';
        castleHealthFill.classList.remove('low', 'critical');
        updateCastleVisuals();
        return;
    }
    
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
    // Apply attack speed debuff (debuffMult is < 1 when debuffed, so it slows attacks)
    const effectiveAttackSpeed = gameState.stats.attackSpeed * (gameState.stats.attackSpeedDebuffMult || 1);
    const attackInterval = 1000 / effectiveAttackSpeed;
    
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
    
    // Calculate max attack range based on screen size and range stat
    // Base range is 60% of the smaller dimension (so castle can't shoot enemies at spawn)
    const baseRange = Math.min(arenaRect.width, arenaRect.height) * 0.6;
    const maxRange = baseRange * (gameState.stats.attackRange || 1);
    
    // Get IDs of enemies that already have projectiles targeting them
    const enemiesWithProjectiles = new Set(
        gameState.projectiles.map(p => p.targetId)
    );
    
    // If manual target is set, prioritize enemies near that position (ignore projectile check for manual targeting)
    // Manual targeting still respects range limit
    if (gameState.manualTarget) {
        const targetX = gameState.manualTarget.x;
        const targetY = gameState.manualTarget.y;
        
        return gameState.enemies
            .filter(e => {
                if (e.health <= 0) return false;
                // Check if enemy is within attack range
                const distToCastle = Math.sqrt((e.x - castleX) ** 2 + (e.y - castleY) ** 2);
                return distToCastle <= maxRange;
            })
            .map(e => ({
                enemy: e,
                dist: Math.sqrt((e.x - targetX) ** 2 + (e.y - targetY) ** 2)
            }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, count)
            .map(e => e.enemy);
    }
    
    // Filter enemies: must be alive, within range, and preferably without projectiles
    const inRangeEnemies = gameState.enemies.filter(e => {
        if (e.health <= 0) return false;
        const distToCastle = Math.sqrt((e.x - castleX) ** 2 + (e.y - castleY) ** 2);
        return distToCastle <= maxRange;
    });
    
    // Filter out enemies that already have projectiles targeting them
    const availableEnemies = inRangeEnemies.filter(e => !enemiesWithProjectiles.has(e.id));
    
    // If no available enemies without projectiles, fall back to all in-range enemies
    const enemyPool = availableEnemies.length > 0 ? availableEnemies : inRangeEnemies;
    
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
    const magicMult = type === 'fireball' ? (gameState.stats.magicDamageMultiplier || 1) : 1;
    const debuffMult = gameState.stats.damageDebuffMult || 1; // Apply damage debuff
    
    const projectile = {
        id: Date.now() + Math.random(),
        x: startX,
        y: startY,
        targetId: target.id,
        type: type,
        speed: type === 'fireball' ? 6 : 10,
        damage: baseDamage * (gameState.stats.damageMultiplier || 1) * magicMult * debuffMult,
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

// Fire a ricochet arrow from a position to a target
function fireRicochetArrow(startX, startY, target, damage, bounceCount, hitEnemies) {
    // Verify target is still valid
    if (!target || target.health <= 0 || target.isDead) {
        return;
    }
    
    playSound('arrowShoot');
    
    const projectile = {
        id: Date.now() + Math.random(),
        x: startX,
        y: startY,
        targetId: target.id,
        type: 'arrow',
        speed: 14, // Faster than normal arrows (10) for quick bouncing
        damage: damage,
        bounces: bounceCount,
        hitEnemies: hitEnemies,
        isRicochet: true, // Mark as ricochet for special handling
        element: null
    };
    
    // Create visual element - same as normal arrow but with ricochet glow
    const el = document.createElement('div');
    el.className = 'projectile arrow ricochet';
    el.textContent = '→';
    el.style.left = startX + 'px';
    el.style.top = startY + 'px';
    
    // Calculate initial rotation toward target
    const dx = target.x - startX;
    const dy = target.y - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    el.style.transform = `rotate(${angle}deg)`;
    
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
            
            // Create meteor striking diagonally - position at target, animation handles the approach
            const meteor = document.createElement('div');
            meteor.className = 'meteor';
            meteor.textContent = '☄️';
            meteor.style.left = target.x + 'px';
            meteor.style.top = target.y + 'px';
            gameArena.appendChild(meteor);
            
            // After striking, deal damage and show impact (600ms matches animation)
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
            }, 600);
        }, i * 200);
    });
}

function updateProjectiles() {
    // Track which enemies are being targeted by ricochet arrows THIS frame
    // This prevents multiple ricochets from targeting the same enemy
    const ricochetTargetsThisFrame = new Set();
    
    gameState.projectiles = gameState.projectiles.filter(proj => {
        let target = gameState.enemies.find(e => e.id === proj.targetId);
        
        // If target is dead or gone, check if we should retarget (for ricochet arrows)
        if (!target || target.health <= 0 || target.isDead) {
            // For ricochet arrows that lost their target, find next closest to castle
            if (proj.isRicochet || (proj.type === 'arrow' && proj.bounces > 0)) {
                const hitEnemies = proj.hitEnemies || [];
                const arenaRect = gameArena.getBoundingClientRect();
                const castleX = arenaRect.width / 2;
                const castleY = arenaRect.height / 2;
                
                // Get all enemies currently targeted by other projectiles
                const alreadyTargeted = new Set();
                gameState.projectiles.forEach(p => {
                    if (p !== proj && p.targetId) alreadyTargeted.add(p.targetId);
                });
                
                let closestToCastle = null;
                let closestDist = Infinity;
                
                gameState.enemies.forEach(e => {
                    if (e.health > 0 && !e.isDead && !hitEnemies.includes(e.id) && !alreadyTargeted.has(e.id)) {
                        const distToCastle = Math.sqrt((e.x - castleX) ** 2 + (e.y - castleY) ** 2);
                        if (distToCastle < closestDist) {
                            closestDist = distToCastle;
                            closestToCastle = e;
                        }
                    }
                });
                
                if (closestToCastle) {
                    proj.targetId = closestToCastle.id;
                    target = closestToCastle; // Update local variable too
                } else {
                    if (proj.element) proj.element.remove();
                    return false;
                }
            } else {
                if (proj.element) proj.element.remove();
                return false;
            }
        }
        
        // Use the updated target
        if (!target || target.health <= 0 || target.isDead) {
            if (proj.element) proj.element.remove();
            return false;
        }
        
        // Move toward target
        const dx = target.x - proj.x;
        const dy = target.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 20) {
            // Hit! Store position before damage in case enemy dies
            const hitX = target.x;
            const hitY = target.y;
            const hitId = target.id;
            
            let damage = proj.damage;
            let isCrit = false;
            
            // Critical hit (apply critChance debuff)
            const effectiveCritChance = Math.max(0, gameState.stats.critChance - (gameState.stats.critChanceDebuff || 0));
            if (Math.random() < effectiveCritChance) {
                damage *= gameState.stats.critDamage;
                isCrit = true;
            }
            
            damageEnemy(target, damage, isCrit);
            
            // Explosive arrows
            if (gameState.stats.explosiveArrows && proj.type === 'arrow') {
                // Add explosion visual
                createVisualEffect(hitX, hitY, 'meteor-impact');
                gameState.enemies.forEach(e => {
                    if (e.id !== hitId) {
                        const d = Math.sqrt((e.x - hitX) ** 2 + (e.y - hitY) ** 2);
                        if (d < 80) damageEnemy(e, damage * 0.5);
                    }
                });
            }
            
            // Fireball explosion
            if (proj.type === 'fireball') {
                // Add meteor impact visual
                createVisualEffect(hitX, hitY, 'meteor-impact');
                gameState.enemies.forEach(e => {
                    const d = Math.sqrt((e.x - hitX) ** 2 + (e.y - hitY) ** 2);
                    if (d < 100) damageEnemy(e, damage * 0.5);
                });
            }
            
            // Freeze chance
            if (gameState.stats.freezeChance > 0 && Math.random() < gameState.stats.freezeChance) {
                target.slowed = true;
                // Add freeze visual
                createVisualEffect(hitX, hitY, 'freeze');
                setTimeout(() => { if (target) target.slowed = false; }, 2000);
            }
            
            // Ricochet: bounce arrow to another enemy (closest to castle)
            if (proj.type === 'arrow' && gameState.stats.ricochet > 0) {
                const maxBounces = gameState.stats.ricochet;
                const currentBounces = proj.bounces || 0;
                
                if (currentBounces < maxBounces) {
                    // Track which enemies have been hit by this arrow chain
                    const hitEnemies = proj.hitEnemies || [];
                    hitEnemies.push(hitId);
                    
                    // Find enemy closest to the CASTLE that hasn't been hit
                    // AND isn't already being targeted by another arrow
                    const arenaRect = gameArena.getBoundingClientRect();
                    const castleX = arenaRect.width / 2;
                    const castleY = arenaRect.height / 2;
                    
                    // Get list of enemies currently being targeted by existing projectiles
                    // AND enemies already claimed by other ricochets this frame
                    const targetedEnemyIds = new Set();
                    gameState.projectiles.forEach(p => {
                        if (p.targetId && p !== proj) {
                            targetedEnemyIds.add(p.targetId);
                        }
                    });
                    // Add enemies already targeted by ricochets spawned this frame
                    ricochetTargetsThisFrame.forEach(id => targetedEnemyIds.add(id));
                    
                    let closestToCastle = null;
                    let closestDist = Infinity;
                    
                    // Find closest enemy NOT already targeted
                    gameState.enemies.forEach(e => {
                        if (e.health > 0 && !e.isDead && !hitEnemies.includes(e.id) && !targetedEnemyIds.has(e.id)) {
                            const distToCastle = Math.sqrt((e.x - castleX) ** 2 + (e.y - castleY) ** 2);
                            if (distToCastle < closestDist) {
                                closestDist = distToCastle;
                                closestToCastle = e;
                            }
                        }
                    });
                    
                    // If no untargeted enemy found, don't spawn ricochet (all valid targets are taken)
                    if (closestToCastle) {
                        // Mark this enemy as targeted for this frame
                        ricochetTargetsThisFrame.add(closestToCastle.id);
                        
                        // Fire a ricochet arrow from the hit position to the next target
                        // Use setTimeout to ensure arrow is added after current filter completes
                        const ricTarget = closestToCastle;
                        const ricDamage = proj.damage * 0.85;
                        const ricBounces = currentBounces + 1;
                        const ricHitEnemies = [...hitEnemies];
                        setTimeout(() => {
                            fireRicochetArrow(hitX, hitY, ricTarget, ricDamage, ricBounces, ricHitEnemies);
                        }, 0);
                    }
                }
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
    if (enemy.health <= 0 && !enemy.isDead) {
        enemy.isDead = true; // Mark as dead to prevent double-killing
        killEnemy(enemy);
    }
}

function killEnemy(enemy) {
    // Safety check - don't kill already processed enemies
    if (enemy.killed) return;
    enemy.killed = true;
    
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
    let goldEarned = Math.round(enemy.value * 5 * diffMult.goldReward);
    
    // Apply gold multiplier
    if (gameState.stats.goldMultiplier) {
        goldEarned = Math.round(goldEarned * gameState.stats.goldMultiplier);
    }
    
    // Bonus gold on kill (Golden God mythic)
    if (gameState.stats.bonusGoldOnKill) {
        goldEarned += gameState.stats.bonusGoldOnKill;
    }
    
    gameState.gold += goldEarned;
    gameState.totalGoldEarned += goldEarned;
    updateGoldDisplay();
    
    // Show gold earned floating text
    showDamageNumber(enemy.x, enemy.y - 40, '+' + goldEarned + '🪙', false, true);
    
    // Death explosion (World Ender mythic)
    // Only explode if this enemy hasn't already exploded (prevents chain reaction loops)
    if (gameState.stats.deathExplosion && !enemy.hasExploded) {
        enemy.hasExploded = true; // Mark to prevent re-explosion
        
        const explosionDamage = Math.round(enemy.maxHealth * 0.65);
        const magicMult = gameState.stats.magicDamageMultiplier || 1;
        const finalDamage = Math.round(explosionDamage * magicMult);
        
        // Create explosion visual
        createVisualEffect(enemy.x, enemy.y, 'explosion', { radius: 80 });
        
        // Collect enemies to damage first (don't modify during iteration)
        const enemiesToDamage = [];
        gameState.enemies.forEach(e => {
            if (e.id !== enemy.id && !e.isDead && !e.killed) {
                const dx = e.x - enemy.x;
                const dy = e.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 80) {
                    enemiesToDamage.push({ enemy: e, damage: finalDamage });
                }
            }
        });
        
        // Now apply damage after collecting (prevents array modification during iteration)
        enemiesToDamage.forEach(({ enemy: e, damage }) => {
            if (e.health > 0 && !e.isDead && !e.killed) {
                damageEnemy(e, damage, false);
            }
        });
    }
    
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
    // Show remaining enemies: expected total minus kills
    const remaining = gameState.expectedEnemies - gameState.waveKills;
    enemyCount.textContent = Math.max(0, remaining);
}

function updateWaveDisplay() {
    waveNumber.textContent = gameState.wave;
}

function updateGoldDisplay() {
    // Handle infinite gold debug mode
    if (debugState.infiniteGold) {
        if (goldCount) goldCount.innerHTML = '<span class="debug-infinity">∞</span>';
        if (shopGoldDisplay) shopGoldDisplay.innerHTML = '<span class="debug-infinity">∞</span>';
        return;
    }
    if (goldCount) goldCount.textContent = gameState.gold;
    if (shopGoldDisplay) shopGoldDisplay.textContent = gameState.gold;
}

function updatePowerDisplay() {
    const powerCount = document.getElementById('powerCount');
    if (powerCount) {
        const power = calculateCastlePower();
        powerCount.textContent = power;
    }
}

// ===== WAVE COMPLETION =====
function checkWaveComplete() {
    // Only check if wave has started
    if (!gameState.waveStarted) return;
    if (gameState.enemies.length > 0) return;
    if (!gameState.isRunning) return;
    
    // Manual wave end mode: don't auto-complete
    if (debugState.manualWaveEnd) return;
    
    // Check if all spawns have happened
    const allSpawned = gameState.pendingSpawns.every(s => s.spawned);
    if (!allSpawned) return;
    
    // All enemies spawned and killed
    if (gameState.waveKills < gameState.expectedEnemies) return;
    
    // Wave complete!
    gameState.isRunning = false;
    gameState.waveStarted = false;
    
    // Tick down debuff durations
    tickDownDebuffs();
    
    setTimeout(() => {
        showUpgradeSelection();
    }, 500);
}

// ===== DEBUFF DURATION SYSTEM =====
function tickDownDebuffs() {
    if (!gameState.activeDebuffs || gameState.activeDebuffs.length === 0) return;
    
    const expiredDebuffs = [];
    
    gameState.activeDebuffs = gameState.activeDebuffs.filter(debuff => {
        debuff.remainingWaves--;
        
        if (debuff.remainingWaves <= 0) {
            expiredDebuffs.push(debuff);
            return false; // Remove from active list
        }
        return true;
    });
    
    // Remove effects of expired debuffs
    expiredDebuffs.forEach(debuff => {
        removeDebuffEffect(debuff);
    });
    
    // Show notification if debuffs expired
    if (expiredDebuffs.length > 0) {
        expiredDebuffs.forEach(d => {
            const allDebuffs = { ...DEBUFF_CARDS, ...DEVASTATING_DEBUFFS };
            const debuffData = allDebuffs[d.id];
            if (debuffData) {
                showDamageNumber(gameState.castle.x, gameState.castle.y - 40, `${debuffData.icon} Curse Lifted!`, false, '#88FF88');
            }
        });
    }
}

function removeDebuffEffect(debuff) {
    const stats = gameState.stats;
    
    // Reverse the debuff effect based on stat key
    switch(debuff.statKey) {
        case 'damageDebuffMult':
            stats.damageDebuffMult = (stats.damageDebuffMult || 1) / debuff.statValue;
            if (Math.abs(stats.damageDebuffMult - 1) < 0.01) stats.damageDebuffMult = 1;
            break;
        case 'attackSpeedDebuffMult':
            stats.attackSpeedDebuffMult = (stats.attackSpeedDebuffMult || 1) / debuff.statValue;
            if (Math.abs(stats.attackSpeedDebuffMult - 1) < 0.01) stats.attackSpeedDebuffMult = 1;
            break;
        case 'armorDebuff':
            stats.armorDebuff = Math.max(0, (stats.armorDebuff || 0) - debuff.statValue);
            break;
        case 'critChanceDebuff':
            stats.critChanceDebuff = Math.max(0, (stats.critChanceDebuff || 0) - debuff.statValue);
            break;
        case 'enemySpeedDebuff':
            stats.enemySpeedDebuff = (stats.enemySpeedDebuff || 1) / debuff.statValue;
            if (Math.abs(stats.enemySpeedDebuff - 1) < 0.01) stats.enemySpeedDebuff = 1;
            break;
        case 'enemyDamageDebuff':
            stats.enemyDamageDebuff = (stats.enemyDamageDebuff || 1) / debuff.statValue;
            if (Math.abs(stats.enemyDamageDebuff - 1) < 0.01) stats.enemyDamageDebuff = 1;
            break;
    }
}

function applyDebuffWithTracking(debuffId) {
    const allDebuffs = { ...DEBUFF_CARDS, ...DEVASTATING_DEBUFFS };
    const debuff = allDebuffs[debuffId];
    if (!debuff) return;
    
    // Apply the effect
    debuff.effect();
    
    // Track for pause menu
    if (!gameState.appliedDebuffs) gameState.appliedDebuffs = [];
    gameState.appliedDebuffs.push(debuffId);
    
    // If not instant and has duration, track for expiration
    if (!debuff.isInstant && debuff.waveDuration) {
        if (!gameState.activeDebuffs) gameState.activeDebuffs = [];
        gameState.activeDebuffs.push({
            id: debuffId,
            remainingWaves: debuff.waveDuration,
            statKey: debuff.statKey,
            statValue: debuff.statValue
        });
    }
}

function showUpgradeSelection() {
    const wave = gameState.wave;
    
    // 15% chance to get debuff selection instead of upgrades
    // BUT never on golden box waves (waves divisible by 5)
    // AND never in the first 5 waves (to make early game easier)
    const isGoldenBoxWave = wave % 5 === 0;
    const isEarlyGame = wave <= 5;
    if (!isGoldenBoxWave && !isEarlyGame && Math.random() < 0.15) {
        showDebuffSelection();
        return;
    }
    
    const options = [];
    
    // Pick 3 options: mix of upgrades and action cards
    // 25% chance each slot is an action card (if deck isn't full)
    for (let i = 0; i < 3; i++) {
        const isActionCard = Math.random() < 0.25;
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
    const boxPriceMultiplier = getBoxPriceMultiplier(gameState.wave);
    const mysteryBoxesRemaining = 3 - gameState.mysteryBoxesBought;
    const isGoldenBoxWave = gameState.wave % 5 === 0 || debugState.forceGoldenBox;
    
    shopItems.innerHTML = Object.values(SHOP_ITEMS).map(item => {
        // Skip golden box on non-eligible waves (unless debug forces it)
        if (item.id === 'goldenBox' && !isGoldenBoxWave) {
            return '';
        }
        
        // Calculate dynamic price based on item type
        let dynamicPrice;
        if (item.id === 'goldenBox') {
            // Golden box scales with box multiplier (wave + power)
            dynamicPrice = Math.round(item.price * boxPriceMultiplier);
        } else if (item.id === 'mysteryUpgrade') {
            // Mystery box also scales with box multiplier
            dynamicPrice = Math.round(item.price * boxPriceMultiplier);
        } else {
            // Repairs scale with standard wave multiplier only
            dynamicPrice = Math.round(item.price * priceMultiplier);
        }
        
        const canAfford = gameState.gold >= dynamicPrice || debugState.infiniteGold;
        const isRepairDisabled = item.type === 'repair' && isHealthFull;
        const isMysteryBoxMaxed = item.id === 'mysteryUpgrade' && gameState.mysteryBoxesBought >= 3;
        const isGoldenBoxBought = item.id === 'goldenBox' && gameState.goldenBoxBought;
        
        let typeClass = item.type === 'repair' ? 'repair' : 'upgrade';
        if (item.id === 'goldenBox') typeClass = 'golden';
        
        const disabled = !canAfford || isRepairDisabled || isMysteryBoxMaxed || isGoldenBoxBought;
        
        // Custom description for mystery box showing remaining
        let desc = item.desc;
        if (item.id === 'mysteryUpgrade') {
            desc = isMysteryBoxMaxed ? 'Max reached this wave!' : `${item.desc} (${mysteryBoxesRemaining} left)`;
        } else if (item.id === 'goldenBox') {
            desc = isGoldenBoxBought ? 'Already purchased!' : item.desc;
        } else if (isRepairDisabled) {
            desc = 'Health is full!';
        }
        
        return `
        <div class="shop-item ${typeClass} ${disabled ? 'disabled' : ''}" data-shop="${item.id}" data-price="${dynamicPrice}" ${isRepairDisabled ? 'data-full="true"' : ''} ${isMysteryBoxMaxed ? 'data-maxed="true"' : ''} ${isGoldenBoxBought ? 'data-bought="true"' : ''}>
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
    let price = dynamicPrice;
    if (!price) {
        if (itemId === 'goldenBox' || itemId === 'mysteryUpgrade') {
            // Boxes use box price multiplier (wave + power scaling)
            price = Math.round(item.price * getBoxPriceMultiplier(gameState.wave));
        } else {
            // Repairs use standard wave multiplier
            price = Math.round(item.price * getShopPriceMultiplier(gameState.wave));
        }
    }
    
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
    
    // Check golden box limit
    if (itemId === 'goldenBox' && gameState.goldenBoxBought) {
        playSound('error');
        showShopMessage('Golden box already purchased this wave!');
        return;
    }
    
    if (gameState.gold >= price || debugState.infiniteGold) {
        playSound('purchase');
        // Debug: Don't deduct gold in infinite gold mode
        if (!debugState.infiniteGold) {
            gameState.gold -= price;
        }
        
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
        } else if (itemId === 'goldenBox') {
            // Track golden box purchase
            gameState.goldenBoxBought = true;
            // Golden box animation - guaranteed legendary with 2% devastating debuff chance
            openGoldenBox();
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
    
    // 5% chance to get a devastating debuff from mystery box (but not in first 5 waves)
    const isDebuff = gameState.wave > 5 && Math.random() < 0.05;
    
    if (isDebuff) {
        openMysteryBoxDebuff();
        return;
    }
    
    // Get a random upgrade OR action card (30% chance for action card, or always offer if deck has room)
    // EXCLUDE mythic rarity - mythics only come from golden boxes
    const includeActionCards = Math.random() < 0.3;
    
    let reward, isActionCard = false;
    
    if (includeActionCards) {
        // Pick random action card (no mythic action cards exist)
        const availableCards = Object.values(ACTION_CARDS);
        reward = availableCards[Math.floor(Math.random() * availableCards.length)];
        isActionCard = true;
    } else {
        // Pick random upgrade - EXCLUDE mythic rarity
        const available = Object.values(UPGRADES).filter(u => 
            u.rarity !== 'mythic' && (u.repeatable || !gameState.earnedUpgrades.includes(u.id))
        );
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
                <div class="card-shine-container"><div class="card-shine"></div></div>
                ${isActionCard ? '<div class="action-card-badge">⚡ ACTION</div>' : ''}
                <div class="upgrade-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
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
                addActionCard(reward.id, 'mystery-box');
            } else {
                reward.effect();
                gameState.earnedUpgrades.push(reward.id);
            }
        }, 300);
    }, 1500);
    
    // Click to close (but not if swap modal is open)
    overlay.addEventListener('click', () => {
        if (!card.classList.contains('hidden') && !document.querySelector('.card-swap-overlay')) {
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
            
            // Apply the debuff with tracking
            applyDebuffWithTracking(debuff.id);
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

// ===== GOLDEN BOX (Guaranteed Legendary with 2% devastating debuff chance) =====
function openGoldenBox() {
    // Play opening sound
    playSound('mysteryBoxOpen');
    
    // 5% chance to get a devastating debuff that wipes half upgrades or sets HP to 1
    const isDevastating = Math.random() < 0.05;
    
    if (isDevastating) {
        openGoldenBoxDevastating();
        return;
    }
    
    // 20% chance for MYTHIC tier (only from golden boxes)
    const isMythic = Math.random() < 0.20;
    const targetRarity = isMythic ? 'mythic' : 'legendary';
    
    // Get a random upgrade or action card of target rarity
    const includeActionCards = Math.random() < 0.3;
    
    let reward, isActionCard = false;
    
    if (includeActionCards && !isMythic) {
        // Pick legendary action card (no mythic action cards)
        const legendaryCards = Object.values(ACTION_CARDS).filter(c => c.rarity === 'legendary');
        if (legendaryCards.length > 0) {
            reward = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
            isActionCard = true;
        }
    }
    
    if (!reward) {
        // Pick upgrade of target rarity
        const targetUpgrades = Object.values(UPGRADES).filter(u => 
            u.rarity === targetRarity && (u.repeatable || !gameState.earnedUpgrades.includes(u.id))
        );
        if (targetUpgrades.length > 0) {
            reward = targetUpgrades[Math.floor(Math.random() * targetUpgrades.length)];
        } else if (isMythic) {
            // Fallback to legendary if no mythic available
            const legendaryUpgrades = Object.values(UPGRADES).filter(u => 
                u.rarity === 'legendary' && (u.repeatable || !gameState.earnedUpgrades.includes(u.id))
            );
            reward = legendaryUpgrades[Math.floor(Math.random() * legendaryUpgrades.length)];
        } else {
            // Fallback to epic if no legendary available
            const epicUpgrades = Object.values(UPGRADES).filter(u => 
                u.rarity === 'epic' && (u.repeatable || !gameState.earnedUpgrades.includes(u.id))
            );
            reward = epicUpgrades[Math.floor(Math.random() * epicUpgrades.length)];
        }
    }
    
    if (!reward) return;
    
    const rarityInfo = RARITIES[reward.rarity];
    
    // Create golden box overlay
    const overlay = document.createElement('div');
    overlay.className = 'mystery-box-overlay golden-box-overlay';
    overlay.innerHTML = `
        <div class="mystery-box-container">
            <div class="golden-box-icon">🎁</div>
            <div class="mystery-card golden-reward-card ${reward.rarity === 'mythic' ? 'mythic-card' : ''} hidden" style="border-color: ${rarityInfo.borderColor}; background: linear-gradient(180deg, ${rarityInfo.bgColor} 0%, rgba(26, 20, 16, 0.95) 100%);">
                <div class="card-shine-container"><div class="card-shine ${reward.rarity === 'mythic' ? 'mythic-card-shine' : 'golden-card-shine'}"></div></div>
                ${isActionCard ? '<div class="action-card-badge">⚡ ACTION</div>' : ''}
                <div class="upgrade-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
                <div class="upgrade-icon">${reward.icon}</div>
                <div class="upgrade-name" style="color: ${rarityInfo.color};">${reward.name}</div>
                <div class="upgrade-desc">${reward.desc}</div>
                ${isActionCard ? '<div class="action-card-note">Added to card deck!</div>' : ''}
                <div class="card-hint">Click anywhere to continue</div>
            </div>
            <div class="golden-rain-confetti"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Animation sequence
    const box = overlay.querySelector('.golden-box-icon');
    const card = overlay.querySelector('.mystery-card');
    const rainContainer = overlay.querySelector('.golden-rain-confetti');
    
    // Start rain confetti immediately
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'golden-rain-piece';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        confetti.style.backgroundColor = ['#FFD700', '#FFA500', '#FFEC8B', '#DAA520', '#FFF8DC'][Math.floor(Math.random() * 5)];
        rainContainer.appendChild(confetti);
    }
    
    // Play anticipation sound
    playSound('mysteryBoxOpen');
    
    // Shake the box with golden glow
    setTimeout(() => box.classList.add('golden-box-shaking'), 100);
    
    // Explode and show card
    setTimeout(() => {
        // Create golden burst explosion
        for (let i = 0; i < 60; i++) {
            const burst = document.createElement('div');
            burst.className = 'golden-burst-piece';
            burst.style.left = '50%';
            burst.style.top = '50%';
            burst.style.setProperty('--angle', (i * 6) + 'deg');
            burst.style.setProperty('--distance', (100 + Math.random() * 200) + 'px');
            burst.style.backgroundColor = ['#FFD700', '#FFA500', '#FFEC8B', '#DAA520', '#FFF'][Math.floor(Math.random() * 5)];
            rainContainer.appendChild(burst);
        }
        
        box.classList.remove('golden-box-shaking');
        box.classList.add('golden-box-explode');
        
        // Play epic sounds
        playSound('legendaryUpgrade');
        
        setTimeout(() => {
            box.classList.add('hidden');
            card.classList.remove('hidden');
            card.classList.add('reveal', 'golden-card-reveal');
            
            // Play reveal sounds
            playSound('mysteryBoxReveal');
            playSound('legendaryUpgrade');
            
            // Apply reward
            if (isActionCard) {
                addActionCard(reward.id, 'golden-box');
            } else {
                reward.effect();
                gameState.earnedUpgrades.push(reward.id);
                updateCastleVisuals();
                updateHealthBar();
            }
        }, 300);
    }, 1500);
    
    // Click to close (but not if swap modal is open)
    overlay.addEventListener('click', () => {
        if (!card.classList.contains('hidden') && !document.querySelector('.card-swap-overlay')) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                renderShop();
            }, 300);
        }
    });
}

// ===== GOLDEN BOX DEVASTATING DEBUFF =====
function openGoldenBoxDevastating() {
    // Two possible devastating effects:
    // 1. Wipe half of all upgrades
    // 2. Set HP to 1 immediately
    const effect = Math.random() < 0.5 ? 'wipeUpgrades' : 'instantDeath';
    
    const debuffInfo = effect === 'wipeUpgrades' 
        ? { icon: '💔', name: 'Shattered Dreams', desc: 'Half of your upgrades have been destroyed!' }
        : { icon: '☠️', name: 'Death\'s Touch', desc: 'Your health drops to 1!' };
    
    // Create devastating overlay
    const overlay = document.createElement('div');
    overlay.className = 'mystery-box-overlay devastating-overlay';
    overlay.innerHTML = `
        <div class="mystery-box-container">
            <div class="golden-box-icon cursed-golden-box">🎁</div>
            <div class="mystery-card devastating-card hidden">
                <div class="devastating-aura"></div>
                <div class="devastating-cracks"></div>
                <div class="upgrade-rarity devastating-title">DEVASTATING CURSE!</div>
                <div class="upgrade-icon devastating-icon">${debuffInfo.icon}</div>
                <div class="upgrade-name devastating-name">${debuffInfo.name}</div>
                <div class="upgrade-desc devastating-desc">${debuffInfo.desc}</div>
                <div class="card-hint devastating-hint">Click anywhere to accept your fate</div>
            </div>
            <div class="devastating-particles"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const box = overlay.querySelector('.golden-box-icon');
    const card = overlay.querySelector('.mystery-card');
    const particlesContainer = overlay.querySelector('.devastating-particles');
    
    // Play ominous sound
    playSound('castleHit');
    
    // Start with calm golden glow, then corrupt
    setTimeout(() => box.classList.add('golden-box-shaking'), 100);
    setTimeout(() => box.classList.add('corrupting'), 800);
    
    // Dark reveal
    setTimeout(() => {
        // Create dark shatter particles
        for (let i = 0; i < 80; i++) {
            const particle = document.createElement('div');
            particle.className = 'devastating-particle';
            particle.style.left = '50%';
            particle.style.top = '40%';
            particle.style.setProperty('--x', (Math.random() - 0.5) * 600 + 'px');
            particle.style.setProperty('--y', (Math.random() - 0.5) * 600 + 'px');
            particle.style.setProperty('--r', Math.random() * 1080 + 'deg');
            particle.style.backgroundColor = ['#7C2D12', '#991B1B', '#450A0A', '#DC2626', '#000'][Math.floor(Math.random() * 5)];
            particle.style.animationDelay = Math.random() * 0.2 + 's';
            particlesContainer.appendChild(particle);
        }
        
        box.classList.remove('golden-box-shaking', 'corrupting');
        box.classList.add('devastating-explode');
        
        // Play devastating sounds
        playSound('castleHit');
        playSound('error');
        
        setTimeout(() => {
            box.classList.add('hidden');
            card.classList.remove('hidden');
            card.classList.add('reveal', 'devastating-reveal');
            
            // Screen shake effect
            overlay.classList.add('screen-shake');
            setTimeout(() => overlay.classList.remove('screen-shake'), 500);
            
            // Play more devastating sounds
            playSound('castleHit');
            
            // Apply the devastating effect
            if (effect === 'wipeUpgrades') {
                // Remove half of upgrades
                const upgradeCount = gameState.earnedUpgrades.length;
                const toRemove = Math.floor(upgradeCount / 2);
                let garrisonRemoved = 0;
                for (let i = 0; i < toRemove; i++) {
                    const randomIndex = Math.floor(Math.random() * gameState.earnedUpgrades.length);
                    const removedId = gameState.earnedUpgrades[randomIndex];
                    // Track if a garrison was removed
                    if (removedId === 'garrison_e') {
                        garrisonRemoved++;
                    }
                    gameState.earnedUpgrades.splice(randomIndex, 1);
                }
                // Sync garrisons if any were removed
                if (garrisonRemoved > 0) {
                    gameState.stats.garrisonCount = Math.max(0, (gameState.stats.garrisonCount || 0) - garrisonRemoved);
                    syncGarrisons();
                }
            } else {
                // Set HP to 1
                gameState.castle.health = 1;
                updateHealthBar();
            }
        }, 400);
    }, 2000);
    
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
            const result = addActionCard(upgradeId, 'upgrade-selection');
            // If card is pending swap, don't continue with wave transition yet
            if (result === 'pending') {
                return;
            }
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
            
            // Update health bar immediately (for max health upgrades)
            updateHealthBar();
        }
    }
    
    upgradeModal.classList.add('hidden');
    
    // Next wave - reset wave kill counter and mystery box purchases
    gameState.wave++;
    gameState.waveKills = 0;
    gameState.mysteryBoxesBought = 0; // Reset mystery box limit for new wave
    gameState.goldenBoxBought = false; // Reset golden box for new wave
    debugState.forceGoldenBox = false; // Reset debug golden box force
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
    
    // Render debuff options with upgrade-style layout
    upgradeOptions.innerHTML = `
        <div class="curse-header">
            <div class="curse-wave-title">CURSED WAVE</div>
            <div class="curse-subtitle">You must choose a curse to continue...</div>
        </div>
        <div class="curse-cards-container">
            ${options.map(d => {
                const severityColor = d.severity === 'moderate' ? '#DC2626' : '#EF4444';
                return `
                <div class="upgrade-card debuff-card" data-debuff="${d.id}" style="border-color: #7C2D12; background: linear-gradient(180deg, rgba(127, 29, 29, 0.4) 0%, rgba(26, 20, 16, 0.95) 100%);">
                    <div class="debuff-skull">💀</div>
                    <div class="upgrade-icon">${d.icon}</div>
                    <div class="upgrade-name" style="color: ${severityColor};">${d.name}</div>
                    <div class="upgrade-desc" style="color: #FCA5A5;">${d.desc}</div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    
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
        applyDebuffWithTracking(debuffId);
        
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
    gameState.goldenBoxBought = false;
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
    
    // Stop background music
    stopBackgroundMusic();
    
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
    
    // Clear garrisons
    clearGarrisons();
}

function returnToMenu() {
    gameState.isRunning = false;
    
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    
    clearEntities();
    stopBackgroundMusic();
    
    gameOver.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    upgradeModal.classList.add('hidden');
    waveOverlay.classList.add('hidden');
    gameScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
    
    // Start homescreen music again
    startHomescreenMusic();
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
    // Build upgrades list sorted by rarity, counting duplicates
    const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
    const upgradeCounts = {};
    
    // Count each upgrade
    gameState.earnedUpgrades.forEach(id => {
        upgradeCounts[id] = (upgradeCounts[id] || 0) + 1;
    });
    
    // Group unique upgrades by rarity
    const earnedByRarity = {};
    rarityOrder.forEach(r => earnedByRarity[r] = []);
    
    Object.keys(upgradeCounts).forEach(id => {
        const upgrade = UPGRADES[id];
        if (upgrade) {
            earnedByRarity[upgrade.rarity].push({
                ...upgrade,
                id: id,
                count: upgradeCounts[id]
            });
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
                        <div class="pause-upgrade-item" style="border-color: ${rarityInfo.borderColor};" data-upgrade-id="${u.id}">
                            <span class="pause-upgrade-icon">${u.icon}</span>
                            <span class="pause-upgrade-name">${u.name}</span>
                            ${u.count > 1 ? `<span class="pause-upgrade-count">${u.count}x</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
    });
    
    if (!hasUpgrades) {
        upgradesHTML = '<p class="no-upgrades">No upgrades collected yet</p>';
    }
    
    // Build active curses list (only non-instant debuffs with remaining waves)
    // Group by severity like upgrades are grouped by rarity
    let cursesHTML = '';
    const allDebuffs = { ...DEBUFF_CARDS, ...DEVASTATING_DEBUFFS };
    const severityOrder = ['devastating', 'moderate', 'minor'];
    const severityInfo = {
        devastating: { name: 'Devastating Curses', color: '#DC2626', borderColor: '#991B1B' },
        moderate: { name: 'Moderate Curses', color: '#FF6347', borderColor: '#B22222' },
        minor: { name: 'Minor Curses', color: '#FFA500', borderColor: '#CC8400' }
    };
    
    // Count curses by id and track their individual remaining waves
    const curseCounts = {};
    const curseInstances = {}; // Track each instance's remaining waves
    
    if (gameState.activeDebuffs && gameState.activeDebuffs.length > 0) {
        gameState.activeDebuffs.forEach((activeDebuff, index) => {
            const id = activeDebuff.id;
            curseCounts[id] = (curseCounts[id] || 0) + 1;
            if (!curseInstances[id]) curseInstances[id] = [];
            curseInstances[id].push({
                index: index,
                remainingWaves: activeDebuff.remainingWaves
            });
        });
    }
    
    // Group curses by severity
    const cursesBySeverity = {};
    severityOrder.forEach(s => cursesBySeverity[s] = []);
    
    Object.keys(curseCounts).forEach(id => {
        const curse = allDebuffs[id];
        if (curse && !curse.isInstant) {
            cursesBySeverity[curse.severity].push({
                ...curse,
                id: id,
                count: curseCounts[id],
                instances: curseInstances[id]
            });
        }
    });
    
    let hasCurses = false;
    
    severityOrder.forEach(severity => {
        if (cursesBySeverity[severity].length > 0) {
            hasCurses = true;
            const info = severityInfo[severity];
            cursesHTML += `<div class="pause-rarity-section pause-curse-section">
                <div class="pause-rarity-title" style="color: ${info.color};">💀 ${info.name}</div>
                <div class="pause-upgrades-list">
                    ${cursesBySeverity[severity].map(c => `
                        <div class="pause-upgrade-item pause-curse-item" style="border-color: ${info.borderColor};" data-curse-id="${c.id}" data-curse-instances='${JSON.stringify(c.instances)}'>
                            <span class="pause-upgrade-icon">${c.icon}</span>
                            <span class="pause-upgrade-name">${c.name}</span>
                            ${c.count > 1 ? `<span class="pause-upgrade-count">${c.count}x</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
    });
    
    // Update pause menu content
    const pauseContent = pauseMenu.querySelector('.pause-menu-content');
    
    pauseContent.innerHTML = `
        <h2>⏸️ Paused</h2>
        <div class="pause-upgrades-container">
            <h3>📜 Your Collection</h3>
            <div class="pause-upgrades-scroll">
                ${upgradesHTML}
                ${hasCurses ? `<div class="pause-curses-divider"></div>${cursesHTML}` : ''}
            </div>
        </div>
        <div class="volume-control">
            <button class="volume-mute-btn ${soundEnabled ? '' : 'muted'}" id="pauseMuteBtn">${soundEnabled ? '🔊' : '🔇'}</button>
            <input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="${masterVolume * 100}">
        </div>
        <button class="menu-btn" id="resumeBtn">▶️ Resume</button>
        <button class="menu-btn danger" id="quitBtn">🏠 Quit to Menu</button>
    `;
    
    // Re-attach event listeners
    pauseContent.querySelector('#resumeBtn').addEventListener('click', togglePause);
    pauseContent.querySelector('#quitBtn').addEventListener('click', returnToMenu);
    
    // Volume control event listeners
    const volumeSlider = pauseContent.querySelector('#volumeSlider');
    const pauseMuteBtn = pauseContent.querySelector('#pauseMuteBtn');
    
    volumeSlider.addEventListener('input', (e) => {
        setMasterVolume(e.target.value / 100);
    });
    
    pauseMuteBtn.addEventListener('click', () => {
        toggleSound();
        pauseMuteBtn.textContent = soundEnabled ? '🔊' : '🔇';
        pauseMuteBtn.classList.toggle('muted', !soundEnabled);
        volumeSlider.value = masterVolume * 100;
    });
    
    // Add click handlers to show upgrade details
    pauseContent.querySelectorAll('.pause-upgrade-item:not(.pause-curse-item)').forEach(item => {
        item.addEventListener('click', () => {
            const upgradeId = item.dataset.upgradeId;
            showUpgradeDetailPopup(upgradeId, upgradeCounts[upgradeId]);
        });
    });
    
    // Add click handlers to show curse details
    pauseContent.querySelectorAll('.pause-curse-item').forEach(item => {
        item.addEventListener('click', () => {
            const curseId = item.dataset.curseId;
            const instances = JSON.parse(item.dataset.curseInstances || '[]');
            showCurseDetailPopup(curseId, instances);
        });
    });
}

function showUpgradeDetailPopup(upgradeId, count) {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return;
    
    const rarityInfo = RARITIES[upgrade.rarity];
    
    const overlay = document.createElement('div');
    overlay.className = 'upgrade-detail-overlay';
    overlay.innerHTML = `
        <div class="upgrade-detail-card" style="border-color: ${rarityInfo.borderColor};">
            <div class="detail-icon" style="color: ${rarityInfo.color};">${upgrade.icon}</div>
            <div class="detail-name" style="color: ${rarityInfo.color};">${upgrade.name}</div>
            <div class="detail-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
            <div class="detail-desc">${upgrade.desc}</div>
            <div class="detail-type">${upgrade.type === 'stat' ? '📊 Stat Upgrade' : '⚡ Ability Upgrade'}</div>
            ${count > 1 ? `<div class="detail-count">Collected: ${count}x</div>` : ''}
            <div class="detail-hint">Click anywhere to close</div>
        </div>
    `;
    
    // Close on click anywhere
    overlay.addEventListener('click', () => {
        overlay.remove();
    });
    
    // Prevent closing when clicking the card itself (optional - remove if you want any click to close)
    overlay.querySelector('.upgrade-detail-card').addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.body.appendChild(overlay);
}

function showCurseDetailPopup(curseId, instances) {
    const allDebuffs = { ...DEBUFF_CARDS, ...DEVASTATING_DEBUFFS };
    const curse = allDebuffs[curseId];
    if (!curse) return;
    
    const severityInfo = {
        devastating: { name: 'Devastating Curse', color: '#DC2626', borderColor: '#991B1B' },
        moderate: { name: 'Moderate Curse', color: '#FF6347', borderColor: '#B22222' },
        minor: { name: 'Minor Curse', color: '#FFA500', borderColor: '#CC8400' }
    };
    const info = severityInfo[curse.severity] || severityInfo.minor;
    
    // Sort instances by remaining waves (highest first)
    instances.sort((a, b) => b.remainingWaves - a.remainingWaves);
    
    // Build instances HTML showing each stack's remaining waves
    let instancesHTML = '';
    if (instances.length > 1) {
        instancesHTML = `<div class="detail-instances">
            <div class="instances-title">Stacks (${instances.length}x):</div>
            ${instances.map((inst, i) => `
                <div class="instance-row">
                    <span class="instance-num">#${i + 1}</span>
                    <span class="instance-waves" style="color: ${info.color};">${inst.remainingWaves} wave${inst.remainingWaves !== 1 ? 's' : ''} remaining</span>
                </div>
            `).join('')}
        </div>`;
    } else if (instances.length === 1) {
        instancesHTML = `<div class="detail-duration" style="color: ${info.color};">
            ⏳ ${instances[0].remainingWaves} wave${instances[0].remainingWaves !== 1 ? 's' : ''} remaining
        </div>`;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'upgrade-detail-overlay curse-detail-overlay';
    overlay.innerHTML = `
        <div class="upgrade-detail-card curse-detail-card" style="border-color: ${info.borderColor};">
            <div class="detail-icon" style="color: ${info.color};">${curse.icon}</div>
            <div class="detail-name" style="color: ${info.color};">${curse.name}</div>
            <div class="detail-rarity" style="color: ${info.color};">${info.name}</div>
            <div class="detail-desc">${curse.desc}</div>
            ${instancesHTML}
            <div class="detail-hint" style="color: #888;">This curse will expire when its waves run out</div>
            <div class="detail-hint">Click anywhere to close</div>
        </div>
    `;
    
    // Close on click anywhere
    overlay.addEventListener('click', () => {
        overlay.remove();
    });
    
    // Prevent closing when clicking the card itself
    overlay.querySelector('.curse-detail-card').addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.body.appendChild(overlay);
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
    
    const magicMult = gameState.stats.magicDamageMultiplier || 1;
    const targets = gameState.enemies.slice(0, count);
    targets.forEach((target, i) => {
        setTimeout(() => {
            const damage = gameState.stats.damage * 2 * gameState.stats.damageMultiplier * magicMult;
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
    const magicMult = gameState.stats.magicDamageMultiplier || 1;
    gameState.enemies.forEach((enemy, i) => {
        setTimeout(() => {
            createVisualEffect(enemy.x, enemy.y, 'meteor-impact');
            damageEnemy(enemy, damage * gameState.stats.damageMultiplier * magicMult);
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
            // Random position on arena - animation handles diagonal approach
            meteor.style.left = (Math.random() * arenaRect.width) + 'px';
            meteor.style.top = (Math.random() * arenaRect.height * 0.7 + arenaRect.height * 0.15) + 'px';
            gameArena.appendChild(meteor);
            
            setTimeout(() => meteor.remove(), 600);
        }, i * 100);
    }
    
    // Damage all enemies after meteors land
    setTimeout(() => {
        const magicMult = gameState.stats.magicDamageMultiplier || 1;
        gameState.enemies.forEach(enemy => {
            damageEnemy(enemy, damage * gameState.stats.damageMultiplier * magicMult);
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
    const magicMult = gameState.stats.magicDamageMultiplier || 1;
    
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
            damageEnemy(enemy, damagePerTick * gameState.stats.damageMultiplier * magicMult);
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
    const knightDamage = 25 * gameState.stats.damageMultiplier;
    const attackInterval = 600;
    
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
                const moveSpeed = 5;
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

// ===== GARRISON (Permanent Castle Guard) =====
function spawnGarrison() {
    playSound('powerUp');
    
    const arenaRect = gameArena.getBoundingClientRect();
    const castleX = arenaRect.width / 2;
    const castleY = arenaRect.height / 2;
    
    // Spawn garrison slightly offset from castle center
    const garrisonCount = gameState.stats.garrisonCount || 1;
    const angle = (garrisonCount - 1) * (Math.PI / 3); // Spread around castle
    const offsetX = Math.cos(angle) * 60;
    const offsetY = Math.sin(angle) * 60;
    
    createVisualEffect(castleX + offsetX, castleY + offsetY, 'screen-flash', { color: 'divine' });
    
    // Create the garrison element
    const garrison = document.createElement('div');
    garrison.className = 'garrison-guard';
    garrison.textContent = '🛡️';
    garrison.style.left = (castleX + offsetX) + 'px';
    garrison.style.top = (castleY + offsetY) + 'px';
    garrison.dataset.garrisonId = Date.now() + Math.random();
    gameArena.appendChild(garrison);
    
    // Store garrison reference
    if (!gameState.garrisons) gameState.garrisons = [];
    
    const garrisonData = {
        id: garrison.dataset.garrisonId,
        element: garrison,
        x: castleX + offsetX,
        y: castleY + offsetY,
        homeX: castleX + offsetX,
        homeY: castleY + offsetY,
        damage: 18 * gameState.stats.damageMultiplier,
        attackInterval: null
    };
    
    gameState.garrisons.push(garrisonData);
    
    // Garrison attack loop
    garrisonData.attackInterval = setInterval(() => {
        if (!gameState || !gameState.enemies || gameState.enemies.length === 0) {
            // Return to home position when no enemies
            const dx = garrisonData.homeX - parseFloat(garrison.style.left);
            const dy = garrisonData.homeY - parseFloat(garrison.style.top);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                const moveSpeed = 2;
                garrison.style.left = (parseFloat(garrison.style.left) + (dx / dist) * moveSpeed) + 'px';
                garrison.style.top = (parseFloat(garrison.style.top) + (dy / dist) * moveSpeed) + 'px';
            }
            return;
        }
        
        // Find closest enemy
        let closestEnemy = null;
        let closestDist = Infinity;
        
        gameState.enemies.forEach(enemy => {
            const dx = enemy.x - parseFloat(garrison.style.left);
            const dy = enemy.y - parseFloat(garrison.style.top);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closestEnemy = enemy;
            }
        });
        
        if (closestEnemy) {
            const dx = closestEnemy.x - parseFloat(garrison.style.left);
            const dy = closestEnemy.y - parseFloat(garrison.style.top);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 50) {
                // Attack!
                damageEnemy(closestEnemy, garrisonData.damage);
                garrison.classList.add('garrison-attacking');
                setTimeout(() => garrison.classList.remove('garrison-attacking'), 200);
                
                // Slash effect
                const slash = document.createElement('div');
                slash.className = 'knight-slash';
                slash.style.left = closestEnemy.x + 'px';
                slash.style.top = closestEnemy.y + 'px';
                gameArena.appendChild(slash);
                setTimeout(() => slash.remove(), 300);
            } else if (dist < 200) {
                // Move towards enemy (slower than knight)
                const moveSpeed = 3;
                const moveX = (dx / dist) * moveSpeed;
                const moveY = (dy / dist) * moveSpeed;
                garrison.style.left = (parseFloat(garrison.style.left) + moveX) + 'px';
                garrison.style.top = (parseFloat(garrison.style.top) + moveY) + 'px';
            } else {
                // Return home if enemy too far
                const homeX = garrisonData.homeX - parseFloat(garrison.style.left);
                const homeY = garrisonData.homeY - parseFloat(garrison.style.top);
                const homeDist = Math.sqrt(homeX * homeX + homeY * homeY);
                if (homeDist > 5) {
                    const moveSpeed = 2;
                    garrison.style.left = (parseFloat(garrison.style.left) + (homeX / homeDist) * moveSpeed) + 'px';
                    garrison.style.top = (parseFloat(garrison.style.top) + (homeY / homeDist) * moveSpeed) + 'px';
                }
            }
        }
    }, 50);
}

// Clear all garrisons (called on game reset)
function clearGarrisons() {
    if (gameState.garrisons) {
        gameState.garrisons.forEach(g => {
            if (g.attackInterval) clearInterval(g.attackInterval);
            if (g.element) g.element.remove();
        });
        gameState.garrisons = [];
    }
    // Also reset the garrison count stat
    if (gameState.stats) {
        gameState.stats.garrisonCount = 0;
    }
}

// Sync garrisons with current garrison count (removes excess or adds missing)
function syncGarrisons() {
    const targetCount = gameState.stats.garrisonCount || 0;
    const currentCount = gameState.garrisons ? gameState.garrisons.length : 0;
    
    if (targetCount < currentCount) {
        // Remove excess garrisons
        const toRemove = currentCount - targetCount;
        for (let i = 0; i < toRemove; i++) {
            const garrison = gameState.garrisons.pop();
            if (garrison) {
                if (garrison.attackInterval) clearInterval(garrison.attackInterval);
                if (garrison.element) garrison.element.remove();
            }
        }
    } else if (targetCount > currentCount) {
        // Add missing garrisons
        for (let i = currentCount; i < targetCount; i++) {
            spawnGarrison();
        }
    }
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
    
    // Re-render deck and update power
    renderCardDeck();
    updatePowerDisplay();
    
    // Visual feedback - enhanced card use flash
    const flash = document.createElement('div');
    flash.className = 'card-use-flash';
    flash.textContent = card.icon;
    flash.style.fontSize = '4rem';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);
}

function addActionCard(cardId, context = 'direct') {
    // Max 6 cards in deck
    if (gameState.actionCards.length >= 6) {
        // Store pending card info and show swap modal
        gameState.pendingActionCard = { cardId, context };
        showCardSwapModal(cardId, context);
        return 'pending';
    }
    gameState.actionCards.push(cardId);
    renderCardDeck();
    updatePowerDisplay();
    return true;
}

// ===== CARD SWAP MODAL =====
function showCardSwapModal(newCardId, context = 'direct') {
    const newCard = ACTION_CARDS[newCardId];
    if (!newCard) return;
    
    const newRarityInfo = RARITIES[newCard.rarity];
    
    // Helper function to proceed after swap/discard for upgrade selection
    const proceedToNextWave = () => {
        if (context === 'upgrade-selection') {
            upgradeModal.classList.add('hidden');
            gameState.wave++;
            gameState.waveKills = 0;
            gameState.mysteryBoxesBought = 0;
            gameState.goldenBoxBought = false;
            gameState.isRunning = true;
            updateWaveDisplay();
            setTimeout(() => startWave(), 500);
        }
    };
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-swap-overlay';
    overlay.innerHTML = `
        <div class="card-swap-modal">
            <div class="card-swap-title">⚠️ Deck Full!</div>
            <div class="card-swap-subtitle">Your action deck is full (6/6). Choose an option:</div>
            
            <div class="card-swap-new-card-section">
                <div class="card-swap-label">New Card:</div>
                <div class="card-swap-new-card ${newCard.rarity}" style="border-color: ${newRarityInfo.borderColor}; background: linear-gradient(180deg, ${newRarityInfo.bgColor} 0%, rgba(26, 20, 16, 0.95) 100%);">
                    <div class="deck-card-rarity" style="color: ${newRarityInfo.color};">${newRarityInfo.name}</div>
                    <div class="deck-card-icon-large">${newCard.icon}</div>
                    <div class="deck-card-name" style="color: ${newRarityInfo.color};">${newCard.name}</div>
                    <div class="deck-card-desc">${newCard.desc}</div>
                </div>
            </div>
            
            <div class="card-swap-label">Swap with one of your cards:</div>
            <div class="card-swap-current-deck">
                ${gameState.actionCards.map((cardId, index) => {
                    const card = ACTION_CARDS[cardId];
                    if (!card) return '';
                    const rarityInfo = RARITIES[card.rarity];
                    return `
                        <div class="card-swap-deck-card ${card.rarity}" data-swap-index="${index}" style="border-color: ${rarityInfo.borderColor}; background: linear-gradient(180deg, ${rarityInfo.bgColor} 0%, rgba(26, 20, 16, 0.95) 100%);">
                            <div class="deck-card-rarity" style="color: ${rarityInfo.color};">${rarityInfo.name}</div>
                            <div class="deck-card-icon">${card.icon}</div>
                            <div class="deck-card-name" style="color: ${rarityInfo.color};">${card.name}</div>
                            <div class="swap-card-hint">Click to swap</div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="card-swap-buttons">
                <button class="card-swap-discard-btn">🗑️ Discard New Card</button>
                ${context === 'upgrade-selection' ? '<button class="card-swap-back-btn">↩️ Choose Different Card</button>' : ''}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Add click handlers for swap cards
    overlay.querySelectorAll('.card-swap-deck-card').forEach(cardEl => {
        cardEl.addEventListener('click', () => {
            const swapIndex = parseInt(cardEl.dataset.swapIndex);
            swapActionCard(swapIndex, newCardId);
            playSound('upgrade');
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                proceedToNextWave();
            }, 300);
        });
        
        cardEl.addEventListener('mouseenter', () => {
            playSound('cardHover');
        });
    });
    
    // Discard button
    const discardBtn = overlay.querySelector('.card-swap-discard-btn');
    discardBtn.addEventListener('click', () => {
        playSound('cardHover');
        showShopMessage('Card discarded');
        gameState.pendingActionCard = null;
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.remove();
            proceedToNextWave();
        }, 300);
    });
    
    // Back button (only for upgrade selection context)
    const backBtn = overlay.querySelector('.card-swap-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            playSound('cardHover');
            gameState.pendingActionCard = null;
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                // Don't close the upgrade modal - let user pick something else
            }, 300);
        });
    }
    
    // Click outside to close (only for upgrade selection)
    if (context === 'upgrade-selection') {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                playSound('cardHover');
                gameState.pendingActionCard = null;
                overlay.classList.add('fade-out');
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }
}

function swapActionCard(swapIndex, newCardId) {
    if (swapIndex >= 0 && swapIndex < gameState.actionCards.length) {
        const oldCardId = gameState.actionCards[swapIndex];
        const oldCard = ACTION_CARDS[oldCardId];
        const newCard = ACTION_CARDS[newCardId];
        gameState.actionCards[swapIndex] = newCardId;
        renderCardDeck();
        updatePowerDisplay();
        showShopMessage(`Swapped ${oldCard?.name || 'card'} for ${newCard?.name || 'new card'}!`);
    }
    gameState.pendingActionCard = null;
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
    const sliderTrack = document.querySelector('.slider-track');
    
    function updateSliderFill() {
        if (difficultySlider && sliderFill && sliderTrack) {
            const percent = ((difficultySlider.value - 1) / 9) * 100;
            const trackWidth = sliderTrack.offsetWidth;
            const fillWidth = (percent / 100) * trackWidth;
            sliderFill.style.width = fillWidth + 'px';
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
        startHomescreenMusic(); // Ensure music is playing before we muffle it
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
        startHomescreenMusic();
        playSound('click');
        openModal(patchNotesModal);
    });
    
    // Help button
    helpBtn.addEventListener('click', () => {
        initAudio();
        startHomescreenMusic();
        playSound('click');
        openModal(helpModal);
    });
    
    // Credits button - Confetti!
    creditsBtn.addEventListener('click', () => {
        initAudio();
        startHomescreenMusic();
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
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
        // Debug: log key events
        // console.log('Keydown:', e.key, 'repeat:', e.repeat);
        if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && !e.repeat) {
            // Don't trigger if focused on input or textarea
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
            if (patchNotesModal && patchNotesModal.classList.contains('active')) closeModal(patchNotesModal);
            else if (helpModal && helpModal.classList.contains('active')) closeModal(helpModal);
            // Only check debugModal if it exists
            else if (typeof debugModal !== 'undefined' && debugModal && debugModal.classList.contains('active')) closeModal(debugModal);
            else if (gameScreen && !gameScreen.classList.contains('hidden')) togglePause();
        }
    });
    
    // Initialize debug panel
    initDebugPanel();
}

// ===== DEBUG MODE =====
const debugState = {
    enabled: false,        // Master toggle for debug mode
    infiniteGold: false,
    infiniteHealth: false,
    noEnemies: false,
    fastWaves: false,
    manualWaveEnd: false,  // Player controls when waves end
    sidebarOpen: false,
    forceGoldenBox: false  // Force show golden box in shop
};

let debugIndicator;

function initDebugPanel() {
    const debugBtn = document.getElementById('debugBtn');
    const debugSidebar = document.getElementById('debugSidebar');
    const debugSidebarToggle = document.getElementById('debugSidebarToggle');
    const closeDebugSidebar = document.getElementById('closeDebugSidebar');
    const debugEndWaveBtn = document.getElementById('debugEndWaveBtn');
    
    if (!debugBtn) return;
    
    const DEBUG_PASSWORD = 'orc3922';
    
    // Toggle debug mode on/off
    debugBtn.addEventListener('click', () => {
        initAudio();
        playSound('click');
        
        // If turning ON, require password
        if (!debugState.enabled) {
            const enteredPassword = prompt('Enter debug password:');
            if (enteredPassword !== DEBUG_PASSWORD) {
                playSound('error');
                return;
            }
        }
        
        debugState.enabled = !debugState.enabled;
        
        if (debugState.enabled) {
            debugBtn.classList.add('active');
            debugBtn.textContent = '🛠️ ON';
            debugSidebarToggle?.classList.remove('hidden');
            updateDebugIndicator();
            populateDebugPanel();
        } else {
            debugBtn.classList.remove('active');
            debugBtn.textContent = '🛠️ Debug';
            debugSidebarToggle?.classList.add('hidden');
            debugSidebar?.classList.remove('open');
            debugState.sidebarOpen = false;
            // Reset all debug toggles
            debugState.infiniteGold = false;
            debugState.infiniteHealth = false;
            debugState.noEnemies = false;
            debugState.fastWaves = false;
            debugState.manualWaveEnd = false;
            updateDebugIndicator();
            updateDebugHUD();
            updateEndWaveButton();
            // Uncheck all checkboxes
            document.querySelectorAll('.debug-toggle input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
    });
    
    // Open/close sidebar
    debugSidebarToggle?.addEventListener('click', () => {
        debugState.sidebarOpen = !debugState.sidebarOpen;
        if (debugState.sidebarOpen) {
            debugSidebar?.classList.add('open');
            populateDebugPanel();
        } else {
            debugSidebar?.classList.remove('open');
        }
    });
    
    closeDebugSidebar?.addEventListener('click', () => {
        debugState.sidebarOpen = false;
        debugSidebar?.classList.remove('open');
    });
    
    // End Wave button
    debugEndWaveBtn?.addEventListener('click', () => {
        if (debugState.manualWaveEnd && gameScreen && !gameScreen.classList.contains('hidden')) {
            playSound('waveComplete');
            forceEndWave();
        }
    });
    
    // Toggle handlers
    document.getElementById('debugInfiniteGold')?.addEventListener('change', (e) => {
        debugState.infiniteGold = e.target.checked;
        updateDebugHUD();
        updateDebugIndicator();
    });
    
    document.getElementById('debugInfiniteHealth')?.addEventListener('change', (e) => {
        debugState.infiniteHealth = e.target.checked;
        if (debugState.infiniteHealth && gameState) {
            gameState.castle.health = gameState.stats.maxHealth;
            updateHealthBar();
        }
        updateDebugHUD();
        updateDebugIndicator();
    });
    
    document.getElementById('debugNoEnemies')?.addEventListener('change', (e) => {
        debugState.noEnemies = e.target.checked;
        updateDebugIndicator();
    });
    
    document.getElementById('debugFastWaves')?.addEventListener('change', (e) => {
        debugState.fastWaves = e.target.checked;
        updateDebugIndicator();
    });
    
    document.getElementById('debugManualWaveEnd')?.addEventListener('change', (e) => {
        debugState.manualWaveEnd = e.target.checked;
        updateEndWaveButton();
        updateDebugIndicator();
    });
    
    // Screen navigation
    document.getElementById('debugShowUpgrade')?.addEventListener('click', () => {
        if (!gameScreen || gameScreen.classList.contains('hidden')) {
            debugStartGame();
            setTimeout(() => showUpgradeSelection(), 500);
        } else {
            showUpgradeSelection();
        }
    });
    
    document.getElementById('debugShowShop')?.addEventListener('click', () => {
        if (!gameScreen || gameScreen.classList.contains('hidden')) {
            debugStartGame();
            setTimeout(() => {
                gameState.goldenBoxBought = false; // Reset so golden box shows
                debugState.forceGoldenBox = true;  // Force golden box to appear
                showUpgradeSelection();
            }, 500);
        } else {
            gameState.goldenBoxBought = false; // Reset so golden box shows
            debugState.forceGoldenBox = true;  // Force golden box to appear
            showUpgradeSelection();
        }
    });
    
    document.getElementById('debugShowGameOver')?.addEventListener('click', () => {
        if (!gameScreen || gameScreen.classList.contains('hidden')) {
            debugStartGame();
            setTimeout(() => endGame(), 500);
        } else {
            endGame();
        }
    });
    
    document.getElementById('debugStartGame')?.addEventListener('click', () => {
        debugStartGame();
    });
    
    // Quick actions
    document.getElementById('debugAddGold')?.addEventListener('click', () => {
        if (gameState) {
            gameState.gold += 1000;
            updateGoldDisplay();
            playSound('goldEarn');
            updateDebugStatsDisplay();
        }
    });
    
    document.getElementById('debugNextWave')?.addEventListener('click', () => {
        if (gameScreen && !gameScreen.classList.contains('hidden') && gameState) {
            playSound('waveComplete');
            forceEndWave();
        }
    });
    
    document.getElementById('debugKillAll')?.addEventListener('click', () => {
        if (gameState) {
            const enemiesToKill = [...gameState.enemies];
            enemiesToKill.forEach(e => {
                if (!e.isDead && !e.killed) {
                    e.health = 0;
                    killEnemy(e);
                }
            });
            playSound('bossKill');
            updateDebugStatsDisplay();
        }
    });
    
    document.getElementById('debugResetStats')?.addEventListener('click', () => {
        if (gameState) {
            gameState.stats = {
                damage: 25,
                attackSpeed: 1.3,
                projectiles: 1,
                critChance: 0.05,
                critDamage: 1.5,
                maxHealth: 150,
                armor: 0,
                regen: 0,
                thorns: 0,
                freezeChance: 0,
                goldMultiplier: 1,
                damageMultiplier: 1,
                hasFireball: false,
                hasLightning: false,
                hasMeteor: false,
                explosiveArrows: false,
                ricochet: 0,
                invincible: false,
                enemySpeedDebuff: 1,
                enemyDamageDebuff: 1
            };
            gameState.castle.health = gameState.stats.maxHealth;
            gameState.gold = 0;
            gameState.earnedUpgrades = [];
            gameState.appliedDebuffs = [];
            updateHealthBar();
            updateGoldDisplay();
            updateDebugStatsDisplay();
            playSound('click');
        }
    });
    
    document.getElementById('debugMaxStats')?.addEventListener('click', () => {
        if (gameState) {
            gameState.stats.damage = 500;
            gameState.stats.attackSpeed = 5;
            gameState.stats.projectiles = 10;
            gameState.stats.critChance = 0.8;
            gameState.stats.critDamage = 4;
            gameState.stats.maxHealth = 1000;
            gameState.stats.armor = 0.8;
            gameState.stats.regen = 10;
            gameState.stats.hasFireball = true;
            gameState.stats.hasLightning = true;
            gameState.stats.hasMeteor = true;
            gameState.stats.ricochet = 5;
            gameState.stats.goldMultiplier = 3;
            gameState.castle.health = gameState.stats.maxHealth;
            updateHealthBar();
            updateDebugStatsDisplay();
            playSound('legendaryUpgrade');
        }
    });
    
    // Add upgrade button
    document.getElementById('debugAddUpgrade')?.addEventListener('click', () => {
        const select = document.getElementById('debugUpgradeSelect');
        const upgradeId = select?.value;
        if (upgradeId && UPGRADES[upgradeId] && gameState) {
            const upgrade = UPGRADES[upgradeId];
            upgrade.effect();
            gameState.earnedUpgrades.push(upgradeId);
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('upgrade');
        }
    });
    
    // Remove upgrade button
    document.getElementById('debugRemoveUpgrade')?.addEventListener('click', () => {
        const select = document.getElementById('debugUpgradeSelect');
        const upgradeId = select?.value;
        if (upgradeId && UPGRADES[upgradeId] && gameState) {
            const idx = gameState.earnedUpgrades.indexOf(upgradeId);
            if (idx > -1) {
                gameState.earnedUpgrades.splice(idx, 1);
                // Handle garrison removal specially
                if (upgradeId === 'garrison_e') {
                    gameState.stats.garrisonCount = Math.max(0, (gameState.stats.garrisonCount || 0) - 1);
                    syncGarrisons();
                }
                updateDebugStatsDisplay();
                // Update pause menu if open
                if (gameState.isPaused) renderPauseMenu();
                playSound('click');
            }
        }
    });
    
    // Add all upgrades button
    document.getElementById('debugAddAllUpgrades')?.addEventListener('click', () => {
        if (gameState) {
            Object.entries(UPGRADES).forEach(([id, upgrade]) => {
                upgrade.effect();
                gameState.earnedUpgrades.push(id);
            });
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('legendaryUpgrade');
        }
    });
    
    // Remove all upgrades button
    document.getElementById('debugRemoveAllUpgrades')?.addEventListener('click', () => {
        if (gameState) {
            gameState.earnedUpgrades = [];
            // Clear all garrisons first
            clearGarrisons();
            // Reset to base stats including all special properties
            gameState.stats = {
                damage: 25,
                attackSpeed: 1.3,
                projectiles: 1,
                critChance: 0.05,
                critDamage: 1.5,
                maxHealth: 150,
                armor: 0,
                regen: 0,
                thorns: 0,
                freezeChance: 0,
                goldMultiplier: 1,
                damageMultiplier: 1,
                hasFireball: false,
                hasLightning: false,
                hasMeteor: false,
                explosiveArrows: false,
                ricochet: 0,
                invincible: false,
                garrisonCount: 0,
                enemySpeedDebuff: 1,
                enemyDamageDebuff: 1
            };
            gameState.castle.health = Math.min(gameState.castle.health, gameState.stats.maxHealth);
            updateHealthBar();
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('click');
        }
    });
    
    // Add debuff button
    document.getElementById('debugAddDebuff')?.addEventListener('click', () => {
        const select = document.getElementById('debugDebuffSelect');
        const debuffId = select?.value;
        const allDebuffs = { ...DEBUFF_CARDS, ...DEVASTATING_DEBUFFS };
        if (debuffId && allDebuffs[debuffId] && gameState) {
            applyDebuffWithTracking(debuffId);
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('debuff');
        }
    });
    
    // Remove debuff button (removes from active debuffs and reverses effect)
    document.getElementById('debugRemoveDebuff')?.addEventListener('click', () => {
        const select = document.getElementById('debugDebuffSelect');
        const debuffId = select?.value;
        if (debuffId && gameState) {
            // Remove from appliedDebuffs
            if (gameState.appliedDebuffs) {
                const idx = gameState.appliedDebuffs.indexOf(debuffId);
                if (idx > -1) {
                    gameState.appliedDebuffs.splice(idx, 1);
                }
            }
            // Remove from activeDebuffs and reverse the effect
            if (gameState.activeDebuffs) {
                const activeIdx = gameState.activeDebuffs.findIndex(d => d.id === debuffId);
                if (activeIdx > -1) {
                    const activeDebuff = gameState.activeDebuffs[activeIdx];
                    removeDebuffEffect(activeDebuff);
                    gameState.activeDebuffs.splice(activeIdx, 1);
                }
            }
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('click');
        }
    });
    
    // Apply all debuffs button
    document.getElementById('debugApplyAllDebuffs')?.addEventListener('click', () => {
        if (gameState) {
            const allDebuffs = { ...DEBUFF_CARDS, ...DEVASTATING_DEBUFFS };
            Object.keys(allDebuffs).forEach(id => {
                applyDebuffWithTracking(id);
            });
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('debuff');
        }
    });
    
    // Remove all debuffs button (reset debuff-related stats and clear active debuffs)
    document.getElementById('debugRemoveAllDebuffs')?.addEventListener('click', () => {
        if (gameState) {
            // Remove each active debuff and reverse its effect
            if (gameState.activeDebuffs) {
                gameState.activeDebuffs.forEach(activeDebuff => {
                    removeDebuffEffect(activeDebuff);
                });
            }
            gameState.appliedDebuffs = [];
            gameState.activeDebuffs = [];
            // Also reset any remaining debuff stats to neutral values just in case
            gameState.stats.damageDebuffMult = 1;
            gameState.stats.attackSpeedDebuffMult = 1;
            gameState.stats.armorDebuff = 0;
            gameState.stats.critChanceDebuff = 0;
            gameState.stats.enemySpeedDebuff = 1;
            gameState.stats.enemyDamageDebuff = 1;
            updateDebugStatsDisplay();
            // Update pause menu if open
            if (gameState.isPaused) renderPauseMenu();
            playSound('click');
        }
    });
    
    // ===== ACTION CARDS DEBUG =====
    // Add action card button
    document.getElementById('debugAddActionCard')?.addEventListener('click', () => {
        const select = document.getElementById('debugActionCardSelect');
        const cardId = select?.value;
        if (cardId && ACTION_CARDS[cardId] && gameState) {
            if (gameState.actionCards.length < 6) {
                gameState.actionCards.push(cardId); // Push ID string, not object
                renderCardDeck();
                playSound('upgrade');
            } else {
                playSound('click');
            }
        }
    });
    
    // Remove action card button
    document.getElementById('debugRemoveActionCard')?.addEventListener('click', () => {
        const select = document.getElementById('debugActionCardSelect');
        const cardId = select?.value;
        if (cardId && gameState) {
            const idx = gameState.actionCards.indexOf(cardId); // Use indexOf for ID strings
            if (idx > -1) {
                gameState.actionCards.splice(idx, 1);
                renderCardDeck();
                playSound('click');
            }
        }
    });
    
    // Fill deck with 6 random action cards
    document.getElementById('debugAddAllActionCards')?.addEventListener('click', () => {
        if (gameState) {
            const cardKeys = Object.keys(ACTION_CARDS);
            gameState.actionCards = []; // Clear deck first
            for (let i = 0; i < 6; i++) {
                const randomCard = cardKeys[Math.floor(Math.random() * cardKeys.length)];
                gameState.actionCards.push(randomCard);
            }
            renderCardDeck();
            playSound('legendaryUpgrade');
        }
    });
    
    // Clear deck button
    document.getElementById('debugClearDeck')?.addEventListener('click', () => {
        if (gameState) {
            gameState.actionCards = [];
            renderCardDeck();
            playSound('click');
        }
    });
}

// Force end the current wave
function forceEndWave() {
    // Clear all pending spawns
    if (gameState.pendingSpawns) {
        gameState.pendingSpawns.forEach(s => {
            if (s.timeoutId) clearTimeout(s.timeoutId);
        });
        gameState.pendingSpawns = [];
    }
    
    // Remove all enemies
    gameState.enemies.forEach(e => {
        if (e.element) e.element.remove();
    });
    gameState.enemies = [];
    gameState.waveEnemies = 0;
    updateEnemyCount();
    
    // Mark wave as complete
    gameState.isRunning = false;
    gameState.waveStarted = false;
    
    // Hide end wave button
    updateEndWaveButton();
    
    // Show upgrade selection
    setTimeout(() => {
        showUpgradeSelection();
    }, 500);
}

// List of boss enemy types
const BOSS_ENEMY_TYPES = ['boss', 'dragon', 'orcChampion', 'trollKing', 'elderDragon', 'lichLord', 'demonLord', 'titan', 'worldEater'];

function populateDebugPanel() {
    // Populate regular enemy grid
    const enemyGrid = document.getElementById('debugEnemyGrid');
    if (enemyGrid && enemyGrid.children.length === 0) {
        Object.entries(ENEMY_TYPES).forEach(([type, data]) => {
            // Skip bosses for regular grid
            if (BOSS_ENEMY_TYPES.includes(type)) return;
            
            const btn = document.createElement('button');
            btn.className = 'debug-enemy-btn';
            btn.innerHTML = `<span class="emoji">${data.emoji}</span>${data.name}`;
            btn.addEventListener('click', () => {
                if (gameScreen && !gameScreen.classList.contains('hidden')) {
                    spawnEnemy(type);
                    gameState.waveEnemies++;
                    playSound('waveStart');
                }
            });
            enemyGrid.appendChild(btn);
        });
    }
    
    // Populate boss grid
    const bossGrid = document.getElementById('debugBossGrid');
    if (bossGrid && bossGrid.children.length === 0) {
        Object.entries(ENEMY_TYPES).forEach(([type, data]) => {
            // Only bosses
            if (!BOSS_ENEMY_TYPES.includes(type)) return;
            
            const btn = document.createElement('button');
            btn.className = 'debug-enemy-btn boss';
            btn.innerHTML = `<span class="emoji">${data.emoji}</span>${data.name}`;
            btn.addEventListener('click', () => {
                if (gameScreen && !gameScreen.classList.contains('hidden')) {
                    spawnEnemy(type);
                    gameState.waveEnemies++;
                    playSound('bossSpawn');
                }
            });
            bossGrid.appendChild(btn);
        });
    }
    
    // Populate upgrade select
    const upgradeSelect = document.getElementById('debugUpgradeSelect');
    if (upgradeSelect && upgradeSelect.options.length <= 1) {
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        const sortedUpgrades = Object.entries(UPGRADES).sort((a, b) => {
            return rarityOrder.indexOf(a[1].rarity) - rarityOrder.indexOf(b[1].rarity);
        });
        
        sortedUpgrades.forEach(([id, upgrade]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `[${upgrade.rarity.toUpperCase()}] ${upgrade.icon} ${upgrade.name}`;
            upgradeSelect.appendChild(option);
        });
    }
    
    // Populate debuff select
    const debuffSelect = document.getElementById('debugDebuffSelect');
    if (debuffSelect && debuffSelect.options.length <= 1) {
        // Regular debuffs from DEBUFF_CARDS (minor/moderate)
        Object.entries(DEBUFF_CARDS).forEach(([id, debuff]) => {
            const option = document.createElement('option');
            option.value = id;
            const severityLabel = debuff.severity ? debuff.severity.charAt(0).toUpperCase() + debuff.severity.slice(1) : 'Unknown';
            option.textContent = `[${severityLabel}] ${debuff.icon} ${debuff.name}`;
            debuffSelect.appendChild(option);
        });
        
        // Devastating debuffs from DEVASTATING_DEBUFFS
        Object.entries(DEVASTATING_DEBUFFS).forEach(([id, debuff]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `[Devastating] ${debuff.icon} ${debuff.name}`;
            debuffSelect.appendChild(option);
        });
    }
    
    // Populate action cards select
    const actionCardSelect = document.getElementById('debugActionCardSelect');
    if (actionCardSelect && actionCardSelect.options.length <= 1) {
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        const sortedCards = Object.entries(ACTION_CARDS).sort((a, b) => {
            return rarityOrder.indexOf(a[1].rarity) - rarityOrder.indexOf(b[1].rarity);
        });
        
        sortedCards.forEach(([id, card]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `[${card.rarity.toUpperCase()}] ${card.icon} ${card.name}`;
            actionCardSelect.appendChild(option);
        });
    }
    
    // Update stats display
    updateDebugStatsDisplay();
}

function updateDebugStatsDisplay() {
    const statsDisplay = document.getElementById('debugStatsDisplay');
    if (!statsDisplay || !gameState) return;
    
    const stats = [
        { label: 'Damage', value: Math.round(gameState.stats.damage) },
        { label: 'Attack Speed', value: gameState.stats.attackSpeed.toFixed(2) },
        { label: 'Projectiles', value: gameState.stats.projectiles },
        { label: 'Crit Chance', value: (gameState.stats.critChance * 100).toFixed(0) + '%' },
        { label: 'Crit Damage', value: (gameState.stats.critDamage * 100).toFixed(0) + '%' },
        { label: 'Max Health', value: gameState.stats.maxHealth },
        { label: 'Armor', value: (gameState.stats.armor * 100).toFixed(0) + '%' },
        { label: 'Regen', value: gameState.stats.regen.toFixed(1) + '/s' },
        { label: 'Gold', value: debugState.infiniteGold ? '∞' : gameState.gold },
        { label: 'Wave', value: gameState.wave },
        { label: 'Kills', value: gameState.kills },
        { label: 'Castle Power', value: calculateCastlePower() }
    ];
    
    statsDisplay.innerHTML = stats.map(s => 
        `<div class="debug-stat"><span class="debug-stat-label">${s.label}</span><span class="debug-stat-value">${s.value}</span></div>`
    ).join('');
}

function updateDebugIndicator() {
    const anyFeatureActive = debugState.infiniteGold || debugState.infiniteHealth || 
                             debugState.noEnemies || debugState.fastWaves || debugState.manualWaveEnd;
    
    if (debugState.enabled && !debugIndicator) {
        debugIndicator = document.createElement('div');
        debugIndicator.className = 'debug-indicator';
        debugIndicator.textContent = '🛠️ DEBUG';
        document.body.appendChild(debugIndicator);
    } else if (!debugState.enabled && debugIndicator) {
        debugIndicator.remove();
        debugIndicator = null;
    }
}

function updateDebugHUD() {
    // Update gold display with infinity symbol
    if (goldCount) {
        if (debugState.infiniteGold) {
            goldCount.innerHTML = '<span class="debug-infinity">∞</span>';
        } else if (gameState) {
            goldCount.textContent = gameState.gold;
        }
    }
    
    // Update health bar with infinity
    if (debugState.infiniteHealth && castleHealthText) {
        castleHealthText.innerHTML = '<span class="debug-infinity">∞</span>';
        if (castleHealthFill) {
            castleHealthFill.style.width = '100%';
        }
    } else if (gameState) {
        updateHealthBar();
    }
}

function updateEndWaveButton() {
    const btn = document.getElementById('debugEndWaveBtn');
    if (!btn) return;
    
    if (debugState.manualWaveEnd && debugState.enabled && gameScreen && !gameScreen.classList.contains('hidden')) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

function debugStartGame() {
    const difficultySlider = document.getElementById('difficultySlider');
    if (difficultySlider) {
        gameDifficulty = parseFloat(difficultySlider.value);
    }
    homeScreen.classList.add('hidden');
    actuallyStartGame();
    
    // Show end wave button if needed
    setTimeout(() => {
        updateEndWaveButton();
        updateDebugHUD();
    }, 100);
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
