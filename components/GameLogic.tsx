import React, { useEffect, useRef } from 'react';
import { 
  EntityType, GameStatus, GameState, 
  PlayerEntity, EnemyEntity, ArrowEntity, TrapEntity, ParticleEntity, PlatformEntity, DoorEntity,
  EnemyTier, Entity
} from '../types';
import { playSound } from '../utils/audio';

// --- ENGINE CONFIG ---
const GRAVITY = 0.5;
const FRICTION = 0.85;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 0.8;
const MAX_SPEED = 5;
const ARROW_SPEED = 18;
const NET_SPEED = 12; // Slower than arrow, arcing
const ARROW_GRAVITY = 0.25;
const NET_GRAVITY = 0.4;
const TRAP_COOLDOWN_FRAMES = 120; // 2 seconds
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

// UI CONSTANTS
const TRAP_BTN_X = CANVAS_WIDTH - 80;
const TRAP_BTN_Y = CANVAS_HEIGHT - 140;
const TRAP_BTN_RADIUS = 45; // Increased for better touch

const GameLogic: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- STATE CONTAINERS ---
  const state = useRef<GameState>({
    status: GameStatus.MENU,
    level: 1,
    score: 0,
    waveProgress: 0,
    maxWaves: 5,
    enemiesKilled: 0,
    enemiesRequired: 4
  });

  const entities = useRef<{
    player: PlayerEntity | null;
    enemies: EnemyEntity[];
    arrows: ArrowEntity[];
    traps: TrapEntity[]; // Nets
    particles: ParticleEntity[];
    platforms: PlatformEntity[];
    door: DoorEntity | null;
  }>({ player: null, enemies: [], arrows: [], traps: [], particles: [], platforms: [], door: null });

  const input = useRef({
    keys: new Set<string>(),
    mouse: { x: 0, y: 0, leftDown: false },
    touch: {
      leftStick: { active: false, x: 0, y: 0, originX: 0, originY: 0 },
      rightStick: { active: false, x: 0, y: 0, originX: 0, originY: 0 },
      trapBtnPressed: false // New input state
    }
  });

  const engine = useRef({
    shake: 0,
    spawnTimer: 0,
    frameCount: 0,
    fireflies: Array.from({ length: 20 }, () => ({ // Reduced count for stability
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * (CANVAS_HEIGHT - 50),
      offset: Math.random() * 100,
      speed: 0.005 + Math.random() * 0.01,
      size: Math.random() * 2 + 1
    }))
  });

  // --- STATE MANAGEMENT ---

  const initGame = () => {
    state.current = {
      status: GameStatus.PLAYING,
      level: 1,
      score: 0,
      waveProgress: 0,
      maxWaves: 5,
      enemiesKilled: 0,
      enemiesRequired: 4 // Base requirement
    };
    startLevel(1);
  };

  const startLevel = (level: number) => {
    state.current.level = level;
    state.current.waveProgress = 0;
    state.current.enemiesKilled = 0;
    state.current.enemiesRequired = 4 + (level * 2); // Scales: 6, 8, 10...
    
    // Reset Entities
    entities.current.enemies = [];
    entities.current.arrows = [];
    entities.current.traps = [];
    entities.current.particles = [];
    entities.current.platforms = [];
    entities.current.door = null;
    
    // Generate Level Layout
    generateLevel(level);

    entities.current.player = {
      id: 0,
      type: EntityType.PLAYER,
      x: 50,
      y: CANVAS_HEIGHT - 100,
      width: 24,
      height: 48,
      vx: 0,
      vy: 0,
      grounded: false,
      markedForDeletion: false,
      facingRight: true,
      health: 100,
      maxHealth: 100,
      aimAngle: 0,
      isAiming: false,
      trapCooldown: 0,
      animTimer: 0
    };

    engine.current.spawnTimer = 0;
  };

  const generateLevel = (level: number) => {
    const platforms = entities.current.platforms;
    
    // Different layouts per level
    if (level === 1) {
       // "Forest Entrance": Simple steps
       platforms.push({ id: 1, type: EntityType.PLATFORM, x: 200, y: 400, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
       platforms.push({ id: 2, type: EntityType.PLATFORM, x: 500, y: 300, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
       platforms.push({ id: 3, type: EntityType.PLATFORM, x: 800, y: 200, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    } else if (level === 2) {
        // "The Bridge": Long central platform
        platforms.push({ id: 1, type: EntityType.PLATFORM, x: 100, y: 350, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 2, type: EntityType.PLATFORM, x: 300, y: 300, width: 400, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 3, type: EntityType.PLATFORM, x: 800, y: 350, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    } else if (level === 3) {
        // "Tree Tops": High verticality
        platforms.push({ id: 1, type: EntityType.PLATFORM, x: 150, y: 400, width: 80, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 2, type: EntityType.PLATFORM, x: 300, y: 300, width: 80, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 3, type: EntityType.PLATFORM, x: 450, y: 200, width: 80, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 4, type: EntityType.PLATFORM, x: 600, y: 300, width: 80, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 5, type: EntityType.PLATFORM, x: 750, y: 400, width: 80, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    } else if (level === 4) {
        // "Cave": Claustrophobic low platforms
        platforms.push({ id: 1, type: EntityType.PLATFORM, x: 0, y: 250, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 2, type: EntityType.PLATFORM, x: 300, y: 400, width: 300, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 3, type: EntityType.PLATFORM, x: 700, y: 250, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    } else {
        // "Alpha's Lair": Arena style
        platforms.push({ id: 1, type: EntityType.PLATFORM, x: 100, y: 350, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 2, type: EntityType.PLATFORM, x: 660, y: 350, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 3, type: EntityType.PLATFORM, x: 380, y: 200, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    }

    // Door Placement (Usually end of level or hard to reach)
    const doorX = level % 2 === 0 ? 50 : CANVAS_WIDTH - 80;
    const doorY = level === 3 ? 140 : CANVAS_HEIGHT - 32 - 64; // High door for level 3

    entities.current.door = {
        id: 999,
        type: EntityType.DOOR,
        x: doorX,
        y: doorY, 
        width: 40,
        height: 64,
        vx: 0, vy: 0, grounded: true, markedForDeletion: false,
        isOpen: false
    };
  };

  const nextLevel = () => {
    if (state.current.level >= state.current.maxWaves) {
      state.current.status = GameStatus.VICTORY;
      playSound('win');
    } else {
      state.current.status = GameStatus.LEVEL_TRANSITION;
      playSound('win'); 
      setTimeout(() => {
        startLevel(state.current.level + 1);
        state.current.status = GameStatus.PLAYING;
      }, 3000);
    }
  };

  const setGameOver = () => {
    state.current.status = GameStatus.GAME_OVER;
    playSound('explosion');
  };

  // --- PHYSICS & LOGIC ---

  const update = () => {
    engine.current.frameCount++;
    if (state.current.status !== GameStatus.PLAYING) return;

    const player = entities.current.player;
    if (!player) return;

    // Check Door Condition
    if (entities.current.door) {
        entities.current.door.isOpen = state.current.enemiesKilled >= state.current.enemiesRequired;
    }

    // 1. INPUT HANDLING
    let dx = 0;
    let jump = false;
    let throwNet = false;
    let shootCommand = false;
    
    // Keyboard
    if (input.current.keys.has('KeyA') || input.current.keys.has('ArrowLeft')) dx = -1;
    if (input.current.keys.has('KeyD') || input.current.keys.has('ArrowRight')) dx = 1;
    if (input.current.keys.has('Space') || input.current.keys.has('ArrowUp')) jump = true;
    if (input.current.keys.has('KeyT')) throwNet = true;
    
    // Aiming
    const mx = input.current.mouse.x;
    const my = input.current.mouse.y;
    if (input.current.mouse.x !== 0 || input.current.mouse.y !== 0 && !input.current.touch.rightStick.active) {
        player.aimAngle = Math.atan2(my - (player.y + 15), mx - (player.x + 12));
    }
    if (input.current.mouse.leftDown) shootCommand = true;

    // Mobile Inputs
    const { leftStick, rightStick, trapBtnPressed } = input.current.touch;
    
    // Check Trap Button (One frame trigger)
    if (trapBtnPressed) {
        throwNet = true;
        input.current.touch.trapBtnPressed = false; // Reset immediately
    }

    if (leftStick.active) {
      if (Math.abs(leftStick.x) > 10) dx = Math.sign(leftStick.x);
      if (leftStick.y < -30) jump = true;
    }
    if (rightStick.active) {
      player.aimAngle = Math.atan2(rightStick.y, rightStick.x);
      player.isAiming = true;
    } else {
      player.isAiming = false;
    }

    // 2. PLAYER MECHANICS
    const wasGrounded = player.grounded;

    player.vx += dx * MOVEMENT_SPEED;
    player.vx *= FRICTION;
    player.vx = Math.max(Math.min(player.vx, MAX_SPEED), -MAX_SPEED);
    
    if (jump && player.grounded) {
      player.vy = JUMP_FORCE;
      player.grounded = false;
      playSound('jump');
      spawnParticles(player.x + 10, player.y + 40, '#e5e7eb', 5, 0.5); // Jump Dust - reduced count
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    
    player.facingRight = Math.abs(player.aimAngle) < Math.PI / 2;

    checkPlatformCollisions(player);

    // Floor
    if (player.y + player.height > CANVAS_HEIGHT - 32) {
      player.y = CANVAS_HEIGHT - 32 - player.height;
      player.vy = 0;
      player.grounded = true;
    }

    // Landing Dust
    if (!wasGrounded && player.grounded) {
        spawnParticles(player.x + 10, player.y + 45, '#e5e7eb', 4, 0.3);
    }

    if (player.x < 0) player.x = 0;
    if (player.x > CANVAS_WIDTH - player.width) player.x = CANVAS_WIDTH - player.width;

    // Door Interaction
    if (entities.current.door && entities.current.door.isOpen) {
        if (checkCollision(player, entities.current.door)) {
            nextLevel();
            return;
        }
    }

    // Shoot
    if (shootCommand) {
        if (engine.current.frameCount % 20 === 0) fireArrow(player);
    }

    // Net Throwing
    if (player.trapCooldown > 0) player.trapCooldown--;
    if (throwNet && player.trapCooldown <= 0) {
      fireNet(player);
      player.trapCooldown = TRAP_COOLDOWN_FRAMES;
      playSound('jump'); // "Whoosh" sound
    }

    // 3. ENTITIES UPDATE
    updateEnemies(player);
    updateArrows();
    updateNets();
    updateParticles();
  };

  const checkPlatformCollisions = (entity: Entity) => {
    if (entity.vy < 0) return;

    const feetX = entity.x + entity.width / 2;
    const feetY = entity.y + entity.height;

    for (const plat of entities.current.platforms) {
        if (feetX > plat.x && feetX < plat.x + plat.width) {
            const prevY = feetY - entity.vy;
            if (feetY >= plat.y && prevY <= plat.y + 10) {
                entity.y = plat.y - entity.height;
                entity.vy = 0;
                entity.grounded = true;
                return;
            }
        }
    }
  };

  const updateEnemies = (player: PlayerEntity) => {
    // Spawning - Max 4 active enemies at a time
    engine.current.spawnTimer++;
    const activeEnemies = entities.current.enemies.filter(e => !e.markedForDeletion).length;
    
    if (engine.current.spawnTimer > 100 && activeEnemies < 4) {
      spawnEnemy();
      engine.current.spawnTimer = 0;
    }

    entities.current.enemies.forEach(enemy => {
      // Net Stun Logic
      if (enemy.stunTimer > 0) {
        enemy.stunTimer--;
        enemy.vx = 0;
        enemy.vy += GRAVITY; // Fall if stunned in air
      } else {
        // Wolf AI
        const dx = (player.x + player.width/2) - (enemy.x + enemy.width/2);
        const dy = (player.y + player.height/2) - (enemy.y + enemy.height/2);
        
        // Slower movement for wolves (cautious)
        let speed = enemy.tier === EnemyTier.SMALL ? 1.5 : (enemy.tier === EnemyTier.MEDIUM ? 1.0 : 0.6);
        enemy.vx += (dx > 0 ? 0.1 : -0.1);
        enemy.vx *= FRICTION;
        
        if (enemy.vx > speed) enemy.vx = speed;
        if (enemy.vx < -speed) enemy.vx = -speed;

        // Jump Logic
        if ((dy < -40 || checkWallInFront(enemy)) && enemy.grounded && Math.random() < 0.02) {
          enemy.vy = JUMP_FORCE;
          enemy.grounded = false;
        }
      }

      enemy.vy += GRAVITY;
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;

      checkPlatformCollisions(enemy);

      if (enemy.y + enemy.height > CANVAS_HEIGHT - 32) {
        enemy.y = CANVAS_HEIGHT - 32 - enemy.height;
        enemy.vy = 0;
        enemy.grounded = true;
      }

      // Damage Player
      if (checkCollision(player, enemy) && enemy.stunTimer <= 0) {
        player.health -= enemy.tier === EnemyTier.LARGE ? 10 : 5;
        engine.current.shake = 5;
        // Bounce back
        player.vx = Math.sign(player.x - enemy.x) * 10;
        player.vy = -5;
        spawnParticles((player.x + enemy.x)/2, (player.y + enemy.y)/2, '#ef4444', 4); // Blood
        if (player.health <= 0) setGameOver();
      }
    });

    entities.current.enemies = entities.current.enemies.filter(e => !e.markedForDeletion);
  };

  const checkWallInFront = (enemy: EnemyEntity) => {
    // Simple lookahead
    return enemy.x <= 10 || enemy.x >= CANVAS_WIDTH - 10 - enemy.width;
  };

  const updateArrows = () => {
    entities.current.arrows.forEach(arrow => {
      arrow.vy += ARROW_GRAVITY; 
      arrow.x += arrow.vx;
      arrow.y += arrow.vy;
      arrow.rotation = Math.atan2(arrow.vy, arrow.vx);
      arrow.lifeTime--;

      if (arrow.lifeTime <= 0) arrow.markedForDeletion = true;
      
      if (arrow.y > CANVAS_HEIGHT - 32) {
        arrow.markedForDeletion = true;
        spawnParticles(arrow.x, arrow.y, '#fbbf24', 3, 0.5);
      }
      
      entities.current.platforms.forEach(p => {
        if (checkCollision(arrow, p)) {
            arrow.markedForDeletion = true;
            spawnParticles(arrow.x, arrow.y, '#fbbf24', 3, 0.5);
        }
      });

      entities.current.enemies.forEach(enemy => {
        if (checkCollision(arrow, enemy)) {
          arrow.markedForDeletion = true;
          // Critical hit on stunned enemies
          const dmg = enemy.stunTimer > 0 ? 2 : 1; 
          enemy.health -= dmg;
          enemy.vx += arrow.vx * 0.5;
          playSound('hit');
          spawnParticles(enemy.x, enemy.y, '#ef4444', 6, 1.2); // Hit Blood

          if (enemy.health <= 0) {
            enemy.markedForDeletion = true;
            playSound('explosion');
            spawnParticles(enemy.x, enemy.y, enemy.color, 15, 1.5); // Explosion
            state.current.score += enemy.tier === EnemyTier.LARGE ? 500 : 100;
            state.current.enemiesKilled++;
          }
        }
      });
    });
    entities.current.arrows = entities.current.arrows.filter(a => !a.markedForDeletion);
  };

  const updateNets = () => {
    entities.current.traps.forEach(net => {
      if (net.state === 'FLYING') {
          net.vy += NET_GRAVITY;
          net.x += net.vx;
          net.y += net.vy;
          net.rotation += 0.2; // Spin

          // Collide with Enemy
          entities.current.enemies.forEach(enemy => {
              if (checkCollision(net, enemy) && enemy.stunTimer <= 0) {
                  net.markedForDeletion = true;
                  enemy.stunTimer = 600; // 10 seconds capture
                  enemy.vx = 0;
                  playSound('coin'); // Distinct capture sound
                  spawnParticles(enemy.x, enemy.y, '#fff', 8, 1);
              }
          });

          // Ground/Platform Miss
          if (net.y > CANVAS_HEIGHT - 32) net.markedForDeletion = true;
          entities.current.platforms.forEach(p => {
             if (checkCollision(net, p)) net.markedForDeletion = true;
          });
      }
    });
    entities.current.traps = entities.current.traps.filter(t => !t.markedForDeletion);
  };

  const updateParticles = () => {
    entities.current.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94; // Air Resistance
      p.vy += GRAVITY * 0.4;
      p.lifeTime--;
    });
    entities.current.particles = entities.current.particles.filter(p => p.lifeTime > 0);
  };

  // --- ACTIONS ---

  const fireArrow = (player: PlayerEntity) => {
    playSound('shoot');
    engine.current.shake = 3;
    entities.current.arrows.push({
      id: Math.random(),
      type: EntityType.ARROW,
      x: player.x + 12,
      y: player.y + 15,
      width: 10,
      height: 4,
      vx: Math.cos(player.aimAngle) * ARROW_SPEED,
      vy: Math.sin(player.aimAngle) * ARROW_SPEED,
      rotation: player.aimAngle,
      grounded: false,
      markedForDeletion: false,
      lifeTime: 120
    });
  };

  const fireNet = (player: PlayerEntity) => {
      // Launches a net in a higher arc
      entities.current.traps.push({
          id: Math.random(),
          type: EntityType.TRAP,
          x: player.x + 12,
          y: player.y + 10,
          width: 16, height: 16,
          vx: Math.cos(player.aimAngle) * NET_SPEED,
          vy: Math.sin(player.aimAngle) * NET_SPEED - 2, // Slight upward bias
          rotation: 0,
          grounded: false,
          markedForDeletion: false,
          state: 'FLYING'
      });
  };

  const spawnEnemy = () => {
    const rand = Math.random();
    let tier = EnemyTier.SMALL;
    if (state.current.level > 1 && rand > 0.6) tier = EnemyTier.MEDIUM;
    if (state.current.level > 3 && rand > 0.85) tier = EnemyTier.LARGE;

    // Wolves are wider than tall
    const width = tier === EnemyTier.LARGE ? 60 : (tier === EnemyTier.MEDIUM ? 48 : 36);
    const height = tier === EnemyTier.LARGE ? 36 : (tier === EnemyTier.MEDIUM ? 28 : 20);
    const hp = tier === EnemyTier.LARGE ? 8 : (tier === EnemyTier.MEDIUM ? 4 : 2);
    const color = tier === EnemyTier.LARGE ? '#111827' : (tier === EnemyTier.MEDIUM ? '#374151' : '#6b7280'); // Dark greys
    
    const side = Math.random() > 0.5 ? 1 : -1;
    const startX = side === 1 ? -60 : CANVAS_WIDTH + 60;
    
    // Attempt spawn on platforms
    let startY = CANVAS_HEIGHT - 100;
    if (Math.random() > 0.5 && entities.current.platforms.length > 0) {
        const p = entities.current.platforms[Math.floor(Math.random() * entities.current.platforms.length)];
        startY = p.y - 60;
    }

    entities.current.enemies.push({
      id: Math.random(),
      type: EntityType.ENEMY,
      x: startX,
      y: startY,
      width,
      height,
      vx: 0,
      vy: 0,
      grounded: false,
      markedForDeletion: false,
      tier,
      health: hp,
      maxHealth: hp,
      stunTimer: 0,
      color
    });
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, speedMult: number = 1.0) => {
    for (let i = 0; i < count; i++) {
      entities.current.particles.push({
        id: Math.random(),
        type: EntityType.PARTICLE,
        x, y,
        vx: (Math.random() - 0.5) * 8 * speedMult,
        vy: (Math.random() - 0.5) * 8 * speedMult,
        width: 4, height: 4,
        grounded: false,
        markedForDeletion: false,
        color,
        lifeTime: 20 + Math.random() * 20,
        size: Math.random() * 3 + 2
      });
    }
  };

  const checkCollision = (r1: Entity, r2: Entity) => {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  };

  // --- RENDERING ---

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Screen Shake
    ctx.save();
    if (engine.current.shake > 0) {
      const mag = engine.current.shake;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      engine.current.shake *= 0.9;
    }

    drawBackground(ctx);
    drawPlatforms(ctx);
    
    if (entities.current.door) drawDoor(ctx, entities.current.door);

    if (entities.current.player) drawPlayer(ctx, entities.current.player);
    drawEnemies(ctx);
    drawArrows(ctx);
    drawNets(ctx);
    drawParticles(ctx);
    
    if (entities.current.player?.isAiming) {
        drawTrajectory(ctx, entities.current.player);
    }

    // Ground
    ctx.fillStyle = '#020617'; 
    ctx.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 32);
    ctx.fillStyle = '#14532d'; 
    ctx.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 6);

    ctx.restore(); // End Shake

    drawMobileControls(ctx);
    drawUI(ctx);
  };

  const drawTrajectory = (ctx: CanvasRenderingContext2D, p: PlayerEntity) => {
    let simX = p.x + 12;
    let simY = p.y + 15;
    let simVx = Math.cos(p.aimAngle) * ARROW_SPEED;
    let simVy = Math.sin(p.aimAngle) * ARROW_SPEED;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for(let i=0; i<30; i++) {
        simX += simVx;
        simY += simVy;
        simVy += ARROW_GRAVITY;
        if (i % 3 === 0) {
            ctx.beginPath();
            ctx.arc(simX, simY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        if (simY > CANVAS_HEIGHT - 32) break;
    }
  };

  const drawPlatforms = (ctx: CanvasRenderingContext2D) => {
    entities.current.platforms.forEach(p => {
        ctx.fillStyle = '#1e293b'; 
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#15803d'; 
        ctx.fillRect(p.x, p.y, p.width, 5);
        // Vines decoration
        ctx.fillStyle = '#166534';
        if (p.id % 2 === 0) ctx.fillRect(p.x + 10, p.y + 20, 4, 15);
        if (p.id % 3 === 0) ctx.fillRect(p.x + p.width - 20, p.y + 20, 4, 10);
    });
  };

  const drawDoor = (ctx: CanvasRenderingContext2D, d: DoorEntity) => {
      ctx.fillStyle = d.isOpen ? '#22d3ee' : '#374151'; // Cyan glow if open
      ctx.fillRect(d.x, d.y, d.width, d.height);
      
      // Frame
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 4;
      ctx.strokeRect(d.x, d.y, d.width, d.height);

      if (d.isOpen) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(d.x + 5, d.y + 5, d.width - 10, d.height - 10);
      } else {
          // Lock Icon
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(d.x + 15, d.y + 25, 10, 14);
      }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const time = engine.current.frameCount;
    
    // Gradient is drawn in clear step now to avoid issues
    
    // Moon
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#fef3c7';
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(800, 80, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Fireflies
    ctx.fillStyle = 'rgba(253, 224, 71, 0.6)'; // Yellow-ish
    engine.current.fireflies.forEach(f => {
        const y = f.y + Math.sin((time * f.speed) + f.offset) * 20;
        const x = (f.x + time * 0.2) % CANVAS_WIDTH;
        ctx.globalAlpha = 0.5 + Math.sin(time * 0.1 + f.offset) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, f.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Distant Mountains
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT - 32);
    for (let i = 0; i <= CANVAS_WIDTH; i += 100) {
      ctx.lineTo(i, CANVAS_HEIGHT - 120 - Math.sin(i * 0.01 + state.current.level) * 60);
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 32);
    ctx.fill();
    
    // Trees (Animated)
    ctx.fillStyle = '#020617';
    for (let i = 40; i < CANVAS_WIDTH; i += 180) {
      const sway = Math.sin(time * 0.02 + i) * 5;
      
      // Trunk
      ctx.fillRect(i, CANVAS_HEIGHT - 180, 24, 150);
      
      // Leaves (Circle top)
      ctx.beginPath();
      ctx.arc(i + 12 + sway, CANVAS_HEIGHT - 180, 40 + (state.current.level * 5), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: PlayerEntity) => {
    ctx.save();
    ctx.translate(p.x + p.width/2, p.y + p.height/2);

    if (Math.abs(p.aimAngle) > Math.PI / 2) ctx.scale(-1, 1);

    // Legs
    const walkCycle = Math.sin(engine.current.frameCount * 0.3) * 6;
    ctx.fillStyle = '#57534e';
    if (Math.abs(p.vx) > 0.1 && p.grounded) {
      ctx.fillRect(-6 + walkCycle, 10, 6, 14);
      ctx.fillRect(0 - walkCycle, 10, 6, 14);
    } else {
      ctx.fillRect(-6, 10, 6, 14);
      ctx.fillRect(0, 10, 6, 14);
    }

    // Body
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-8, -10, 16, 20);

    // Head
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(-6, -22, 12, 12);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-7, -24, 14, 4);

    // Arms/Bow
    ctx.save();
    let armAngle = p.aimAngle;
    if (Math.abs(p.aimAngle) > Math.PI / 2) armAngle = Math.PI - armAngle;
    ctx.rotate(armAngle);
    
    ctx.fillStyle = '#22c55e'; 
    ctx.fillRect(0, -3, 16, 6);
    
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14, 0, 12, -Math.PI/2, Math.PI/2);
    ctx.stroke();

    if (p.isAiming) {
        ctx.beginPath();
        ctx.moveTo(14, -12); ctx.lineTo(8, 0); ctx.lineTo(14, 12);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(8, -1, 14, 2);
    } else {
        ctx.beginPath();
        ctx.moveTo(14, -12); ctx.lineTo(14, 12);
        ctx.strokeStyle = '#fff'; ctx.stroke();
    }

    ctx.restore();
    ctx.restore();
  };

  const drawEnemies = (ctx: CanvasRenderingContext2D) => {
    entities.current.enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x + e.width/2, e.y + e.height/2);
      
      // Face player direction approximately
      const facingRight = e.vx > 0;
      if (!facingRight) ctx.scale(-1, 1);

      ctx.fillStyle = e.color; // Wolf fur color

      // WOLF VISUALS
      const cycle = Math.sin(engine.current.frameCount * 0.2) * 5;
      
      // Body
      ctx.fillRect(-e.width/2, -e.height/2 + 5, e.width, e.height - 10);
      
      // Head
      ctx.fillRect(e.width/2 - 10, -e.height/2 - 5, 20, 20);
      // Snout
      ctx.fillStyle = '#000';
      ctx.fillRect(e.width/2 + 8, -e.height/2, 6, 8);
      // Ears
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.width/2, -e.height/2 - 5);
      ctx.lineTo(e.width/2 + 5, -e.height/2 - 15);
      ctx.lineTo(e.width/2 + 10, -e.height/2 - 5);
      ctx.fill();

      // Legs (Animated)
      const legH = 12;
      ctx.fillStyle = e.color;
      if (Math.abs(e.vx) > 0.1) {
          ctx.fillRect(-e.width/2, e.height/2 - 5, 6, legH + cycle); // Back L
          ctx.fillRect(-e.width/2 + 10, e.height/2 - 5, 6, legH - cycle); // Back R
          ctx.fillRect(e.width/2 - 10, e.height/2 - 5, 6, legH + cycle); // Front L
          ctx.fillRect(e.width/2 - 20, e.height/2 - 5, 6, legH - cycle); // Front R
      } else {
          ctx.fillRect(-e.width/2, e.height/2 - 5, 6, legH);
          ctx.fillRect(-e.width/2 + 10, e.height/2 - 5, 6, legH);
          ctx.fillRect(e.width/2 - 10, e.height/2 - 5, 6, legH);
          ctx.fillRect(e.width/2 - 20, e.height/2 - 5, 6, legH);
      }

      // Tail
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(-e.width/2, -e.height/2 + 10);
      ctx.lineTo(-e.width/2 - 10, -e.height/2 + 5 + cycle/2);
      ctx.lineTo(-e.width/2, -e.height/2 + 15);
      ctx.fill();

      // NET OVERLAY (If Stunned)
      if (e.stunTimer > 0) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          for(let i = -e.width/2; i < e.width/2; i+=5) {
              ctx.beginPath(); ctx.moveTo(i, -e.height/2); ctx.lineTo(i+5, e.height/2); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-e.width/2, i/2); ctx.lineTo(e.width/2, i/2+5); ctx.stroke();
          }
      }

      // Health Bar
      ctx.fillStyle = 'red';
      ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width, 4);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width * (e.health/e.maxHealth), 4);

      ctx.restore();
    });
  };

  const drawArrows = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#facc15';
    entities.current.arrows.forEach(a => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.fillRect(-5, -1, 10, 2);
      ctx.restore();
    });
  };

  const drawNets = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      entities.current.traps.forEach(n => {
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.rotate(n.rotation);
          // Draw a grid/web shape
          ctx.beginPath();
          ctx.rect(-6, -6, 12, 12);
          ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
          ctx.moveTo(0, -6); ctx.lineTo(0, 6);
          ctx.stroke();
          ctx.restore();
      });
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    entities.current.particles.forEach(p => {
      // Fade out logic
      const alpha = Math.max(0, p.lifeTime / 40);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1.0;
    });
  };

  const drawMobileControls = (ctx: CanvasRenderingContext2D) => {
    // Left Stick
    const ls = input.current.touch.leftStick;
    if (ls.active) {
      ctx.save();
      ctx.translate(ls.originX, ls.originY);
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      const dist = Math.min(40, Math.sqrt(ls.x * ls.x + ls.y * ls.y));
      const angle = Math.atan2(ls.y, ls.x);
      ctx.beginPath(); ctx.arc(Math.cos(angle)*dist, Math.sin(angle)*dist, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.6)'; ctx.fill();
      ctx.restore();
    }

    // Right Stick
    const rs = input.current.touch.rightStick;
    if (rs.active) {
      ctx.save();
      ctx.translate(rs.originX, rs.originY);
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      const dist = Math.min(40, Math.sqrt(rs.x * rs.x + rs.y * rs.y));
      const angle = Math.atan2(rs.y, rs.x);
      ctx.beginPath(); ctx.arc(Math.cos(angle)*dist, Math.sin(angle)*dist, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.6)'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('RELEASE', 0, -50);
      ctx.restore();
    }

    // Trap Button
    const player = entities.current.player;
    if (player) {
        ctx.save();
        ctx.translate(TRAP_BTN_X, TRAP_BTN_Y);
        
        const cooldown = player.trapCooldown;
        const ready = cooldown <= 0;
        
        // Button Base
        ctx.beginPath();
        ctx.arc(0, 0, TRAP_BTN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ready ? 'rgba(34, 211, 238, 0.5)' : 'rgba(100, 100, 100, 0.5)'; // Cyan if ready
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        // Icon (Net)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(15, 0); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.lineTo(-15, 0); ctx.closePath();
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-5, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(5, 10); ctx.stroke();
        
        // Cooldown Overlay (Pie Chart style)
        if (!ready) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.arc(0, 0, TRAP_BTN_RADIUS, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * (cooldown / TRAP_COOLDOWN_FRAMES)));
            ctx.fill();
        } else {
             ctx.fillStyle = '#fff';
             ctx.font = '10px monospace';
             ctx.textAlign = 'center';
             ctx.fillText('TRAP', 0, 25);
        }

        ctx.restore();
    }
  };

  const drawUI = (ctx: CanvasRenderingContext2D) => {
    if (state.current.status === GameStatus.MENU) {
      // Overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // Dark blue-ish overlay
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.textAlign = 'center';

      // "WOOLF"
      ctx.font = '72px "Press Start 2P"';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000';
      ctx.strokeText('WOOLF', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 80);
      ctx.fillStyle = '#9ca3af'; // Grey/Silver
      ctx.fillText('WOOLF', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 80);

      // "HUNTERS"
      ctx.font = '72px "Press Start 2P"';
      ctx.strokeText('HUNTERS', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      ctx.fillStyle = '#ef4444'; // Red
      ctx.fillText('HUNTERS', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);

      // Credits
      ctx.font = '14px "Press Start 2P"';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('criado por corvobranco360🐺', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 60);

      // Instructions
      if (Math.floor(engine.current.frameCount / 30) % 2 === 0) {
          ctx.font = '24px "Press Start 2P"';
          ctx.fillStyle = '#fbbf24'; // Amber
          ctx.fillText('PRESS SPACE OR TAP', CANVAS_WIDTH/2, CANVAS_HEIGHT - 80);
      }
      return;
    }

    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '16px "Press Start 2P"';
    ctx.fillText(`HP: ${Math.floor(entities.current.player?.health || 0)}`, 20, 40);
    
    // Door/Wolf Status
    const needed = state.current.enemiesRequired - state.current.enemiesKilled;
    ctx.textAlign = 'center';
    if (needed > 0) {
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`HUNT ${needed} WOLVES`, CANVAS_WIDTH/2, 40);
    } else {
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(`FIND THE DOOR!`, CANVAS_WIDTH/2, 40);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`LEVEL ${state.current.level}/5`, CANVAS_WIDTH - 20, 40);

    const cd = entities.current.player?.trapCooldown || 0;
    if (cd > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`NET: ${(cd/60).toFixed(1)}s`, CANVAS_WIDTH - 20, 70);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillText('NET READY [T]', CANVAS_WIDTH - 20, 70);
    }

    if (state.current.status === GameStatus.GAME_OVER || state.current.status === GameStatus.VICTORY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = state.current.status === GameStatus.VICTORY ? '#fbbf24' : '#ef4444';
      ctx.font = '48px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText(state.current.status === GameStatus.VICTORY ? 'ESCAPED!' : 'DEVOURED', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);
      ctx.fillStyle = '#fff'; ctx.font = '16px "Press Start 2P"';
      ctx.fillText('TAP OR SPACE TO RESTART', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 90);
    }
  };

  // --- LOOPS & HANDLERS ---
  
  const loop = () => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    
    const onKeyDown = (e: KeyboardEvent) => {
      input.current.keys.add(e.code);
      if (e.code === 'Space') {
        if (state.current.status !== GameStatus.PLAYING && state.current.status !== GameStatus.LEVEL_TRANSITION) {
          initGame();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => input.current.keys.delete(e.code);
    
    const onMouseMove = (e: MouseEvent) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (r) {
        input.current.mouse.x = (e.clientX - r.left) * (CANVAS_WIDTH / r.width);
        input.current.mouse.y = (e.clientY - r.top) * (CANVAS_HEIGHT / r.height);
      }
    };
    const onMouseDown = () => input.current.mouse.leftDown = true;
    const onMouseUp = () => input.current.mouse.leftDown = false;

    // Mobile Touch
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      
      if (state.current.status !== GameStatus.PLAYING) {
        initGame();
        return;
      }

      Array.from(e.changedTouches).forEach(t => {
        const x = (t.clientX - r.left) * (CANVAS_WIDTH / r.width);
        const y = (t.clientY - r.top) * (CANVAS_HEIGHT / r.height);
        
        // Trap Button Detection
        const distTrap = Math.sqrt(Math.pow(x - TRAP_BTN_X, 2) + Math.pow(y - TRAP_BTN_Y, 2));
        if (distTrap < TRAP_BTN_RADIUS) {
            input.current.touch.trapBtnPressed = true;
            return; // Capture touch
        }

        if (x < CANVAS_WIDTH / 2) {
          input.current.touch.leftStick = { active: true, x: 0, y: 0, originX: x, originY: y };
        } else {
          input.current.touch.rightStick = { active: true, x: 0, y: 0, originX: x, originY: y };
        }
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;

      Array.from(e.changedTouches).forEach(t => {
        const x = (t.clientX - r.left) * (CANVAS_WIDTH / r.width);
        const y = (t.clientY - r.top) * (CANVAS_HEIGHT / r.height);
        const ls = input.current.touch.leftStick;
        const rs = input.current.touch.rightStick;
        if (ls.active && x < CANVAS_WIDTH / 2) { ls.x = x - ls.originX; ls.y = y - ls.originY; }
        if (rs.active && x > CANVAS_WIDTH / 2) { rs.x = x - rs.originX; rs.y = y - rs.originY; }
      });
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      Array.from(e.changedTouches).forEach(t => {
        const x = (t.clientX - r.left) * (CANVAS_WIDTH / r.width);
        if (input.current.touch.rightStick.active && x >= CANVAS_WIDTH / 2) {
           input.current.touch.rightStick.active = false;
           if (entities.current.player && entities.current.player.health > 0) fireArrow(entities.current.player);
        }
        if (x < CANVAS_WIDTH / 2) input.current.touch.leftStick.active = false;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    
    const cvs = canvasRef.current;
    if (cvs) {
      cvs.addEventListener('touchstart', onTouchStart, { passive: false });
      cvs.addEventListener('touchmove', onTouchMove, { passive: false });
      cvs.addEventListener('touchend', onTouchEnd, { passive: false });
    }

    return () => {
      cancelAnimationFrame(requestRef.current!);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      if (cvs) {
        cvs.removeEventListener('touchstart', onTouchStart);
        cvs.removeEventListener('touchmove', onTouchMove);
        cvs.removeEventListener('touchend', onTouchEnd);
      }
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      width={CANVAS_WIDTH} 
      height={CANVAS_HEIGHT} 
      className="w-full h-full object-contain bg-black cursor-crosshair"
      style={{ touchAction: 'none' }}
    />
  );
};

export default GameLogic;