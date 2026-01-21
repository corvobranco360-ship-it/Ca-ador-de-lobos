import React, { useEffect, useRef } from 'react';
import { 
  EntityType, GameStatus, GameState, 
  PlayerEntity, EnemyEntity, ArrowEntity, TrapEntity, ParticleEntity, PlatformEntity, DoorEntity, CageEntity, DogEntity, DuckEntity, MeatEntity, PowerUpEntity, FloatingTextEntity, CrowEntity, BushEntity, RabbitEntity,
  EnemyTier, Entity
} from '../types';
import { playSound } from '../utils/audio';

// --- ENGINE CONFIG ---
const GRAVITY = 0.5;
const FRICTION = 0.85;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 0.8;
const RPG_MOVEMENT_SPEED = 3.5;
const MAX_SPEED = 5;
const ARROW_SPEED = 18;
const NET_SPEED = 12;
const ARROW_GRAVITY = 0.25;
const NET_GRAVITY = 0.4;
const TRAP_COOLDOWN_FRAMES = 120;
const DASH_COOLDOWN_FRAMES = 60;
const DASH_SPEED = 15;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const LAKE_LEVEL_Y = CANVAS_HEIGHT - 32;

// --- UI CONSTANTS ---
const LEFT_STICK_X = 120;
const LEFT_STICK_Y = CANVAS_HEIGHT - 80;
const RIGHT_STICK_X = CANVAS_WIDTH - 120;
const RIGHT_STICK_Y = CANVAS_HEIGHT - 80;
const JOYSTICK_RADIUS = 50;
const JOYSTICK_HIT_RADIUS = 80;

const BUTTON_Y = CANVAS_HEIGHT - 220;
const BUTTON_HIT_RADIUS = 55;
const TRAP_BTN_X = CANVAS_WIDTH - 70;
const TRAP_BTN_Y = BUTTON_Y;
const TRAP_BTN_RADIUS = 40; 
const WHISTLE_BTN_X = CANVAS_WIDTH - 170;
const WHISTLE_BTN_Y = BUTTON_Y;
const WHISTLE_BTN_RADIUS = 35;
const DASH_BTN_X = CANVAS_WIDTH - 270;
const DASH_BTN_Y = BUTTON_Y;
const DASH_BTN_RADIUS = 40; 

const GameLogic: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- STATE ---
  const state = useRef<GameState>({
    status: GameStatus.MENU,
    level: 1,
    score: 0,
    lives: 3, 
    waveProgress: 0,
    maxWaves: 5,
    enemiesKilled: 0,
    enemiesRequired: 4,
    isRaining: false,
    lightningTimer: 0
  });

  const entities = useRef<{
    player: PlayerEntity | null;
    enemies: EnemyEntity[];
    crows: CrowEntity[]; 
    arrows: ArrowEntity[];
    traps: TrapEntity[];
    particles: ParticleEntity[];
    platforms: PlatformEntity[];
    door: DoorEntity | null;
    cages: CageEntity[];
    dog: DogEntity | null;
    ducks: DuckEntity[]; 
    meats: MeatEntity[]; 
    powerups: PowerUpEntity[];
    floatingTexts: FloatingTextEntity[];
    rainDrops: {x: number, y: number, speed: number, length: number}[];
    bushes: BushEntity[];
    rabbits: RabbitEntity[];
  }>({ 
      player: null, enemies: [], crows: [], arrows: [], traps: [], particles: [], platforms: [], 
      door: null, cages: [], dog: null, ducks: [], meats: [], powerups: [], floatingTexts: [], rainDrops: [],
      bushes: [], rabbits: []
  });

  const input = useRef({
    keys: new Set<string>(),
    mouse: { x: 0, y: 0, leftDown: false },
    touch: {
      leftStick: { active: false, x: 0, y: 0, touchId: null as number | null },
      rightStick: { active: false, x: 0, y: 0, touchId: null as number | null },
      trapBtnPressed: false,
      whistleBtnPressed: false,
      dashBtnPressed: false 
    }
  });

  const engine = useRef({
    shake: 0,
    spawnTimer: 0,
    frameCount: 0,
    clouds: Array.from({ length: 5 }, (_, i) => ({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * 150,
        speed: 0.2 + Math.random() * 0.3,
        scale: 0.5 + Math.random() * 0.5
    })),
    fireflies: Array.from({ length: 20 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * (CANVAS_HEIGHT - 50),
      offset: Math.random() * 100,
      speed: 0.005 + Math.random() * 0.01,
      size: Math.random() * 2 + 1
    }))
  });

  const isTopDown = () => state.current.level === 3;

  // --- HELPERS ---
  const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
    entities.current.floatingTexts.push({
      id: Math.random(),
      type: EntityType.FLOATING_TEXT,
      x, y, width: 0, height: 0, vx: 0, vy: -1,
      grounded: false, markedForDeletion: false,
      text, color, lifeTime: 60, opacity: 1
    });
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, speed: number = 1) => {
    for (let i = 0; i < count; i++) {
      entities.current.particles.push({
        id: Math.random(),
        type: EntityType.PARTICLE,
        x, y, width: 4, height: 4,
        vx: (Math.random() - 0.5) * 5 * speed,
        vy: (Math.random() - 0.5) * 5 * speed,
        grounded: false, markedForDeletion: false,
        color, lifeTime: 30 + Math.random() * 20, size: Math.random() * 3 + 1
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

  // --- INIT & LEVELS ---
  const initGame = () => {
    state.current = {
      status: GameStatus.PLAYING,
      level: 1,
      score: 0,
      lives: 3, 
      waveProgress: 0,
      maxWaves: 5,
      enemiesKilled: 0,
      enemiesRequired: 4,
      isRaining: false,
      lightningTimer: 0
    };
    entities.current.dog = null;
    startLevel(1);
  };

  const startLevel = (level: number) => {
    state.current.level = level;
    state.current.waveProgress = 0;
    state.current.enemiesKilled = 0;
    state.current.enemiesRequired = level === 1 ? 4 : 4 + (level * 2); 
    state.current.isRaining = level === 2 || level === 5; 
    
    entities.current.enemies = [];
    entities.current.crows = [];
    entities.current.arrows = [];
    entities.current.traps = [];
    entities.current.particles = [];
    entities.current.platforms = [];
    entities.current.cages = [];
    entities.current.ducks = [];
    entities.current.meats = [];
    entities.current.powerups = [];
    entities.current.floatingTexts = [];
    entities.current.rainDrops = [];
    entities.current.bushes = [];
    entities.current.rabbits = [];
    entities.current.door = null;

    if (state.current.isRaining) {
        for(let i=0; i<100; i++) {
            entities.current.rainDrops.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                speed: 15 + Math.random() * 10,
                length: 10 + Math.random() * 10
            });
        }
    }
    
    generateLevel(level);

    if (entities.current.dog) {
        entities.current.dog.x = 20;
        entities.current.dog.y = CANVAS_HEIGHT - 100;
        entities.current.dog.vx = 0;
        entities.current.dog.vy = 0;
        entities.current.dog.state = 'IDLE';
        entities.current.dog.aggroTimer = 0;
        entities.current.dog.target = null;
    } else if (level === 3) {
        entities.current.dog = {
            id: 777,
            type: EntityType.DOG,
            x: 100, y: CANVAS_HEIGHT / 2,
            width: 32, height: 24,
            vx: 0, vy: 0,
            grounded: false, markedForDeletion: false,
            facingRight: true,
            state: 'IDLE',
            target: null,
            barkTimer: 0,
            tongueOut: false,
            animTimer: 0,
            aggroTimer: 0,
            healTimer: 0
        };
    }

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
      animTimer: 0,
      powerUpTimer: 0,
      dashTimer: 0,
      isDashing: false,
      invulnerableTimer: 0
    };

    if (isTopDown()) {
        entities.current.player.x = 50;
        entities.current.player.y = CANVAS_HEIGHT / 2;
    }

    engine.current.spawnTimer = 0;
  };

  const spawnBushesAndRabbits = () => {
      for(let i=0; i<8; i++) {
          const x = 200 + Math.random() * (CANVAS_WIDTH - 300);
          const y = 100 + Math.random() * (CANVAS_HEIGHT - 200);
          entities.current.bushes.push({
              id: Math.random(), type: EntityType.BUSH, x, y, width: 40, height: 30,
              vx: 0, vy: 0, grounded: true, markedForDeletion: false, hasRabbit: true, shakeTimer: 0
          });
          entities.current.rabbits.push({
              id: Math.random(), type: EntityType.RABBIT, x: x + 10, y: y + 10, width: 16, height: 16,
              vx: 0, vy: 0, grounded: true, markedForDeletion: false, state: 'HIDDEN', isHidden: true, facingRight: true, fleeTimer: 0, health: 1
          });
      }
  };

  const generateLevel = (level: number) => {
    const platforms = entities.current.platforms;
    if (level === 3) {
        spawnBushesAndRabbits();
        state.current.enemiesRequired = 5; 
    } else {
        if (level === 1) {
           platforms.push({ id: 1, type: EntityType.PLATFORM, x: 200, y: 400, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
           platforms.push({ id: 2, type: EntityType.PLATFORM, x: 500, y: 300, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
           platforms.push({ id: 3, type: EntityType.PLATFORM, x: 800, y: 200, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        } else if (level === 2) {
            platforms.push({ id: 1, type: EntityType.PLATFORM, x: 100, y: 400, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 2, type: EntityType.PLATFORM, x: 300, y: 350, width: 400, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 3, type: EntityType.PLATFORM, x: 800, y: 400, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            if (!entities.current.dog) {
                entities.current.cages.push({ id: 888, type: EntityType.CAGE, x: 600, y: 290, width: 60, height: 60, vx: 0, vy: 0, grounded: true, markedForDeletion: false, health: 3 });
            }
        } else if (level === 4) {
            platforms.push({ id: 1, type: EntityType.PLATFORM, x: 100, y: 400, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 2, type: EntityType.PLATFORM, x: 300, y: 300, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 3, type: EntityType.PLATFORM, x: 500, y: 200, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 4, type: EntityType.PLATFORM, x: 700, y: 280, width: 80, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 5, type: EntityType.PLATFORM, x: 840, y: 210, width: 120, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        } else {
            platforms.push({ id: 1, type: EntityType.PLATFORM, x: 100, y: 350, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 2, type: EntityType.PLATFORM, x: 660, y: 350, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
            platforms.push({ id: 3, type: EntityType.PLATFORM, x: 380, y: 200, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        }
    }

    const doorX = level % 2 === 0 ? 50 : CANVAS_WIDTH - 80;
    const doorY = level === 4 ? 140 : CANVAS_HEIGHT - 32 - 64; 
    entities.current.door = {
        id: 999, type: EntityType.DOOR, x: doorX, y: isTopDown() ? 50 : doorY, width: 40, height: 64, vx: 0, vy: 0, grounded: true, markedForDeletion: false, isOpen: false
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

  const handlePlayerDeath = () => {
      state.current.lives--;
      playSound('explosion');
      if (state.current.lives > 0) {
          spawnFloatingText(entities.current.player!.x, entities.current.player!.y - 20, "TRY AGAIN!", "#fde047");
          engine.current.shake = 10;
          setTimeout(() => {
              if (state.current.status === GameStatus.PLAYING) startLevel(state.current.level); 
          }, 500);
      } else {
          setGameOver();
      }
  };

  const setGameOver = () => {
    state.current.status = GameStatus.GAME_OVER;
    playSound('explosion');
  };

  const fireArrow = (player: PlayerEntity) => {
    const speed = ARROW_SPEED;
    let vx = 0; 
    let vy = 0;
    
    // Check if aiming via stick/mouse, OR just fire in facing direction
    if (player.isAiming || input.current.mouse.leftDown || input.current.touch.rightStick.active) {
        vx = Math.cos(player.aimAngle) * speed;
        vy = Math.sin(player.aimAngle) * speed;
    } else {
        vx = player.facingRight ? speed : -speed;
        vy = 0;
    }

    entities.current.arrows.push({
        id: Math.random(),
        type: EntityType.ARROW,
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        width: 24, height: 6, // Larger arrows for visibility
        vx, vy,
        grounded: false, markedForDeletion: false,
        rotation: Math.atan2(vy, vx),
        lifeTime: 120
    });
    
    playSound('shoot');
  };

  const fireNet = (player: PlayerEntity) => {
    const speed = NET_SPEED;
    let vx = player.facingRight ? speed : -speed;
    let vy = -5;
    if (player.isAiming) {
            vx = Math.cos(player.aimAngle) * speed;
            vy = Math.sin(player.aimAngle) * speed;
    }
    entities.current.traps.push({
        id: Math.random(), type: EntityType.TRAP, x: player.x + player.width / 2, y: player.y + player.height / 2, width: 16, height: 16,
        vx, vy, grounded: false, markedForDeletion: false, rotation: 0, state: 'FLYING'
    });
  };

  // --- UPDATE LOOP ---
  const update = () => {
    engine.current.frameCount++;
    if (state.current.status !== GameStatus.PLAYING) return;

    if (state.current.isRaining) {
        if (Math.random() < 0.005) { 
            state.current.lightningTimer = 5;
            playSound('explosion'); 
        }
        if (state.current.lightningTimer > 0) state.current.lightningTimer--;
        entities.current.rainDrops.forEach(d => {
            d.y += d.speed; d.x -= 2; 
            if (d.y > CANVAS_HEIGHT) { d.y = -20; d.x = Math.random() * CANVAS_WIDTH; }
        });
    }

    const player = entities.current.player;
    if (!player) return;

    if (entities.current.door) {
        entities.current.door.isOpen = state.current.enemiesKilled >= state.current.enemiesRequired;
    }

    let dx = 0;
    let dy = 0;
    let jump = false;
    let throwNet = false;
    let whistle = false;
    let dash = false;
    let shootCommand = false;
    
    if (input.current.keys.has('KeyA') || input.current.keys.has('ArrowLeft')) dx = -1;
    if (input.current.keys.has('KeyD') || input.current.keys.has('ArrowRight')) dx = 1;
    if (input.current.keys.has('KeyW') || input.current.keys.has('ArrowUp')) dy = -1; 
    if (input.current.keys.has('KeyS') || input.current.keys.has('ArrowDown')) dy = 1; 
    
    if (input.current.keys.has('Space') || input.current.keys.has('ArrowUp')) jump = true;
    if (input.current.keys.has('KeyT')) throwNet = true;
    if (input.current.keys.has('KeyR')) whistle = true; 
    if (input.current.keys.has('ShiftLeft')) dash = true;
    
    const mx = input.current.mouse.x;
    const my = input.current.mouse.y;
    // Mouse aiming
    if (input.current.mouse.x !== 0 || input.current.mouse.y !== 0 && !input.current.touch.rightStick.active) {
        player.aimAngle = Math.atan2(my - (player.y + 15), mx - (player.x + 12));
    }
    // Touch aiming logic
    if (input.current.touch.rightStick.active) {
        player.isAiming = true;
        // Auto-fire when using right stick (Twin Stick style)
        shootCommand = true;
    }

    if (input.current.mouse.leftDown) shootCommand = true;

    const { leftStick, rightStick, trapBtnPressed, whistleBtnPressed, dashBtnPressed } = input.current.touch;
    if (trapBtnPressed) { throwNet = true; input.current.touch.trapBtnPressed = false; }
    if (whistleBtnPressed) { whistle = true; input.current.touch.whistleBtnPressed = false; }
    if (dashBtnPressed) { dash = true; input.current.touch.dashBtnPressed = false; }

    if (leftStick.active) {
      if (Math.abs(leftStick.x) > 10) dx = Math.sign(leftStick.x);
      if (isTopDown()) {
          if (Math.abs(leftStick.y) > 10) dy = Math.sign(leftStick.y);
      } else {
          if (leftStick.y < -30) jump = true;
      }
    }
    
    // Set aim angle from stick
    if (rightStick.active) {
      player.aimAngle = Math.atan2(rightStick.y, rightStick.x);
    } 

    if (isTopDown()) updateRPGPhysics(player, dx, dy, dash, whistle);
    else updatePlatformerPhysics(player, dx, jump, dash);

    if (entities.current.door && entities.current.door.isOpen) {
        if (checkCollision(player, entities.current.door)) {
            nextLevel();
            return;
        }
    }

    if (player.powerUpTimer > 0) player.powerUpTimer--;

    // SHOOTING LOGIC
    if (shootCommand) {
        const fireRate = player.powerUpTimer > 0 ? 10 : 20;
        if (engine.current.frameCount % fireRate === 0) {
            fireArrow(player);
        }
    }

    if (player.trapCooldown > 0) player.trapCooldown--;
    if (throwNet && player.trapCooldown <= 0) {
      fireNet(player);
      player.trapCooldown = TRAP_COOLDOWN_FRAMES;
      playSound('jump'); 
    }

    updateEnemies(player);
    updateCrows(player);
    updateDucks(whistle);
    updateArrows();
    updateNets();
    updateParticles();
    updateMeats(player);
    updatePowerUps(player);
    updateFloatingTexts();
    if (entities.current.dog) updateDog(player, whistle);
    if (isTopDown() && entities.current.dog) updateBushesAndRabbits(player, entities.current.dog);
  };

  const updateRPGPhysics = (player: PlayerEntity, dx: number, dy: number, dash: boolean, whistle: boolean) => {
      if (player.dashTimer > 0) player.dashTimer--;
      
      if (dash && player.dashTimer <= 0 && (dx !== 0 || dy !== 0)) {
          player.isDashing = true;
          player.dashTimer = DASH_COOLDOWN_FRAMES;
          player.vx = dx * DASH_SPEED;
          player.vy = dy * DASH_SPEED;
          playSound('jump');
          spawnParticles(player.x + 10, player.y + 40, '#fff', 8, 0.5);
      }

      if (player.isDashing) {
          player.vx *= 0.85;
          player.vy *= 0.85;
          if (Math.abs(player.vx) < RPG_MOVEMENT_SPEED && Math.abs(player.vy) < RPG_MOVEMENT_SPEED) player.isDashing = false;
      } else {
          player.vx = dx * RPG_MOVEMENT_SPEED;
          player.vy = dy * RPG_MOVEMENT_SPEED;
      }

      player.x += player.vx;
      player.y += player.vy;
      
      if (!input.current.touch.rightStick.active && input.current.mouse.x === 0) {
          if (dx !== 0) player.facingRight = dx > 0;
      } else {
          player.facingRight = Math.abs(player.aimAngle) < Math.PI / 2;
      }

      if (player.x < 0) player.x = 0;
      if (player.x > CANVAS_WIDTH - player.width) player.x = CANVAS_WIDTH - player.width;
      if (player.y < 0) player.y = 0;
      if (player.y > CANVAS_HEIGHT - player.height) player.y = CANVAS_HEIGHT - player.height;
  };

  const updatePlatformerPhysics = (player: PlayerEntity, dx: number, jump: boolean, dash: boolean) => {
        if (player.dashTimer > 0) player.dashTimer--;
        if (player.invulnerableTimer > 0) player.invulnerableTimer--;

        if (dash && player.dashTimer <= 0) {
            let dashDir = dx;
            if (dashDir === 0) dashDir = player.facingRight ? 1 : -1;
            player.isDashing = true;
            player.dashTimer = DASH_COOLDOWN_FRAMES;
            player.invulnerableTimer = 15; 
            player.vx = dashDir * DASH_SPEED;
            playSound('jump');
            spawnParticles(player.x + 10, player.y + 40, '#fff', 8, 0.5);
        }

        const wasGrounded = player.grounded;
        
        if (player.isDashing) {
            player.vx *= 0.85; 
            if (Math.abs(player.vx) < MAX_SPEED) player.isDashing = false;
        } else {
            player.vx += dx * MOVEMENT_SPEED;
            player.vx *= FRICTION;
            player.vx = Math.max(Math.min(player.vx, MAX_SPEED), -MAX_SPEED);
        }
        
        if (jump && player.grounded) {
            player.vy = JUMP_FORCE;
            player.grounded = false;
            playSound('jump');
            spawnParticles(player.x + 10, player.y + 40, '#e5e7eb', 5, 0.5);
        }

        player.vy += GRAVITY;
        player.x += player.vx;
        player.y += player.vy;
        player.facingRight = Math.abs(player.aimAngle) < Math.PI / 2;

        checkPlatformCollisions(player);

        if (player.y + player.height > CANVAS_HEIGHT - 32) {
            player.y = CANVAS_HEIGHT - 32 - player.height;
            player.vy = 0;
            player.grounded = true;
        }
        if (!wasGrounded && player.grounded) {
            spawnParticles(player.x + 10, player.y + 45, '#e5e7eb', 4, 0.3);
        }
        if (player.x < 0) player.x = 0;
        if (player.x > CANVAS_WIDTH - player.width) player.x = CANVAS_WIDTH - player.width;
  };

  const updateBushesAndRabbits = (player: PlayerEntity, dog: DogEntity) => {
      entities.current.bushes.forEach(bush => {
          if (bush.shakeTimer > 0) bush.shakeTimer--;
      });

      entities.current.rabbits.forEach(rabbit => {
          if (rabbit.state === 'HIDDEN') {
              const bush = entities.current.bushes.find(b => Math.abs(b.x - rabbit.x + 10) < 10 && Math.abs(b.y - rabbit.y + 10) < 10);
              if (!bush) { rabbit.state = 'IDLE'; rabbit.isHidden = false; return; }

              const distP = Math.sqrt(Math.pow(player.x - rabbit.x, 2) + Math.pow(player.y - rabbit.y, 2));
              const distD = Math.sqrt(Math.pow(dog.x - rabbit.x, 2) + Math.pow(dog.y - rabbit.y, 2));
              
              if (distP < 30 || (dog.state === 'FLUSH' && distD < 30)) {
                  rabbit.state = 'FLEE';
                  rabbit.isHidden = false;
                  rabbit.fleeTimer = 300; 
                  playSound('splash'); 
                  bush.shakeTimer = 20;
                  spawnParticles(bush.x, bush.y, '#166534', 5);
                  spawnFloatingText(rabbit.x, rabbit.y - 10, "!", "#fff");
              }
          } else if (rabbit.state === 'FLEE') {
              rabbit.fleeTimer--;
              const dxDog = rabbit.x - dog.x;
              const dyDog = rabbit.y - dog.y;
              const dxPlay = rabbit.x - player.x;
              const dyPlay = rabbit.y - player.y;
              let runX = dxDog * 1.5 + dxPlay * 0.8;
              let runY = dyDog * 1.5 + dyPlay * 0.8;
              const mag = Math.sqrt(runX*runX + runY*runY);
              rabbit.vx = (runX/mag) * 3.5; 
              rabbit.vy = (runY/mag) * 3.5;
              rabbit.x += rabbit.vx;
              rabbit.y += rabbit.vy;
              rabbit.facingRight = rabbit.vx > 0;

              if (rabbit.fleeTimer % 10 === 0) { 
                  const bush = entities.current.bushes.find(b => Math.abs(b.x - rabbit.x) < 20 && Math.abs(b.y - rabbit.y) < 20);
                  if (bush) {
                      rabbit.state = 'HIDDEN';
                      rabbit.isHidden = true;
                      rabbit.vx = 0; rabbit.vy = 0;
                      bush.shakeTimer = 10;
                      if (dog.target === rabbit) {
                          dog.state = 'IDLE';
                          dog.target = null;
                          spawnFloatingText(dog.x, dog.y - 20, "?", "#fff");
                      }
                  }
              }
              if(rabbit.x < 0 || rabbit.x > CANVAS_WIDTH) rabbit.vx *= -1;
              if(rabbit.y < 0 || rabbit.y > CANVAS_HEIGHT) rabbit.vy *= -1;
          } 
      });
  };

  const updateMeats = (player: PlayerEntity) => {
      entities.current.meats.forEach(m => {
          if (!isTopDown()) m.vy += GRAVITY;
          m.y += m.vy;
          if (!isTopDown()) {
              checkPlatformCollisions(m);
              if (m.y + m.height > CANVAS_HEIGHT - 32) {
                  m.y = CANVAS_HEIGHT - 32 - m.height;
                  m.vy = 0;
              }
          }
          if (checkCollision(player, m)) {
              m.markedForDeletion = true;
              player.health = Math.min(player.maxHealth, player.health + 20);
              state.current.score += 50;
              spawnFloatingText(player.x, player.y - 10, "+20 HP", "#22c55e");
              playSound('coin');
              spawnParticles(m.x, m.y, '#f87171', 10, 1);
          }
      });
      entities.current.meats = entities.current.meats.filter(m => !m.markedForDeletion);
  };

  const updateDog = (player: PlayerEntity, whistleTriggered: boolean) => {
    const dog = entities.current.dog!;
    if (state.current.level === 3) {
        if (dog.state === 'CARRY') {
            const dx = player.x - dog.x;
            const dy = player.y - dog.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 40) {
                dog.vx = (dx/dist) * 3.5;
                dog.vy = (dy/dist) * 3.5;
            } else {
                entities.current.meats.push({
                    id: Math.random(), type: EntityType.MEAT, x: dog.x, y: dog.y, width: 16, height: 16, vx: 0, vy: 0, grounded: true, markedForDeletion: false, value: 50
                });
                state.current.enemiesKilled++;
                playSound('coin');
                dog.state = 'IDLE';
                dog.target = null;
                spawnFloatingText(dog.x, dog.y - 20, "GOOD BOY!", "#fbbf24");
            }
            dog.x += dog.vx;
            dog.y += dog.vy;
            dog.facingRight = dog.vx > 0;
            return; 
        }
        if (whistleTriggered) {
            if (dog.state === 'POINTING') {
                dog.state = 'FLUSH';
                dog.aggroTimer = 60; 
                playSound('bark');
            } else {
                dog.state = 'FOLLOW';
                playSound('whistle');
            }
        }
        const visibleRabbit = entities.current.rabbits.find(r => r.state === 'FLEE' && !r.isHidden);
        if (visibleRabbit && dog.state !== 'CARRY') {
            dog.state = 'CHASE';
            dog.target = visibleRabbit;
        }
        if (dog.state === 'CHASE' && dog.target) {
            const rabbit = dog.target as RabbitEntity;
            if (rabbit.state === 'HIDDEN' || rabbit.markedForDeletion) {
                dog.state = 'IDLE'; dog.target = null; 
            } else {
                const dx = rabbit.x - dog.x;
                const dy = rabbit.y - dog.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 20) {
                    dog.state = 'CARRY';
                    rabbit.markedForDeletion = true;
                    playSound('hit');
                    spawnParticles(dog.x, dog.y, '#fff', 10);
                } else {
                    dog.vx = (dx/dist) * 4.2; 
                    dog.vy = (dy/dist) * 4.2;
                    spawnParticles(dog.x, dog.y + 20, '#d1d5db', 1); 
                }
            }
        } else if (dog.state === 'FLUSH' && dog.target) {
            const dx = dog.target.x - dog.x;
            const dy = dog.target.y - dog.y;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                const bush = dog.target as BushEntity;
                bush.shakeTimer = 30;
                const rabbit = entities.current.rabbits.find(r => r.state === 'HIDDEN' && Math.abs(r.x - bush.x) < 20);
                if (rabbit) {
                    rabbit.state = 'FLEE';
                    rabbit.isHidden = false;
                    rabbit.fleeTimer = 300;
                    playSound('splash');
                } else {
                    dog.state = 'IDLE';
                }
            } else {
                dog.vx = Math.sign(dx) * 4;
                dog.vy = Math.sign(dy) * 4;
            }
        } else if (dog.state === 'POINTING') {
            dog.vx = 0; dog.vy = 0;
            if (engine.current.frameCount % 60 === 0) spawnFloatingText(dog.x, dog.y - 10, "!", "#fbbf24");
        } else {
            let smellTarget = null;
            let minDist = 400;
            entities.current.bushes.forEach(bush => {
                const dist = Math.sqrt(Math.pow(bush.x - dog.x, 2) + Math.pow(bush.y - dog.y, 2));
                const hasHiddenRabbit = entities.current.rabbits.some(r => r.state === 'HIDDEN' && Math.abs(r.x - bush.x) < 20);
                if (dist < minDist && hasHiddenRabbit) {
                    minDist = dist;
                    smellTarget = bush;
                }
            });
            if (smellTarget) {
                const dx = smellTarget.x - dog.x;
                const dy = smellTarget.y - dog.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 60) {
                    dog.vx = (dx/dist) * 3;
                    dog.vy = (dy/dist) * 3;
                } else {
                    dog.state = 'POINTING';
                    dog.target = smellTarget;
                    playSound('bark');
                }
            } else {
                const dx = (player.x - 30) - dog.x;
                const dy = player.y - dog.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 60) {
                    dog.vx = (dx/dist) * 2.5;
                    dog.vy = (dy/dist) * 2.5;
                } else {
                    dog.vx = 0; dog.vy = 0;
                }
            }
        }
        dog.x += dog.vx;
        dog.y += dog.vy;
        dog.facingRight = dog.vx > 0;
    } else {
        if (whistleTriggered) {
            dog.aggroTimer = 300;
            playSound('whistle');
            spawnParticles(dog.x, dog.y, '#fbbf24', 10, 2);
            dog.target = null;
            dog.state = 'IDLE';
        }
        if (dog.aggroTimer > 0) dog.aggroTimer--;
        if (dog.aggroTimer > 0) {
            let nearestEnemy: EnemyEntity | null = null;
            let minDist = 600;
            if (dog.target && (dog.target as EnemyEntity).markedForDeletion) {
                dog.target = null;
                dog.state = 'IDLE';
            }
            if (dog.state !== 'BRAWL' && !dog.target) {
                entities.current.enemies.forEach(e => {
                    if (e.stunTimer <= 0 && !e.markedForDeletion) { 
                        const d = Math.sqrt(Math.pow(e.x - dog.x, 2) + Math.pow(e.y - dog.y, 2));
                        if (d < minDist) { minDist = d; nearestEnemy = e; }
                    }
                });
                if (nearestEnemy) { dog.state = 'CHASE'; dog.target = nearestEnemy; }
            }
        } else {
            const distToPlayer = Math.sqrt(Math.pow(player.x - dog.x, 2) + Math.pow(player.y - dog.y, 2));
            const enemiesNearby = entities.current.enemies.length > 0 && entities.current.enemies.some(e => Math.sqrt(Math.pow(e.x - dog.x, 2) + Math.pow(e.y - dog.y, 2)) < 300);
            if (distToPlayer < 50 && !enemiesNearby && player.health < player.maxHealth) {
                dog.healTimer = (dog.healTimer || 0) + 1;
                if (dog.healTimer > 60) dog.state = 'HEAL';
            } else {
                dog.healTimer = 0;
                dog.state = 'FOLLOW';
                dog.target = player;
            }
            if (dog.state === 'FOLLOW') {
                if (Math.abs(player.x - dog.x) < 50 && Math.abs(player.y - dog.y) < 50) {
                    dog.state = 'IDLE';
                    dog.target = null;
                }
            }
        }
        if (dog.state === 'HEAL') {
             dog.vx = 0;
             if (engine.current.frameCount % 60 === 0) {
                 player.health = Math.min(player.maxHealth, player.health + 5);
                 spawnFloatingText(player.x, player.y - 20, "❤", "#f43f5e");
                 spawnParticles(dog.x, dog.y, '#f43f5e', 3, 0.5);
             }
        } else if (dog.state === 'BRAWL' && dog.target) {
            const enemy = dog.target as EnemyEntity;
            if (enemy.health <= 0 || enemy.markedForDeletion) { dog.state = 'IDLE'; dog.target = null; return; }
            enemy.vx = 0; 
            dog.x = enemy.x + (Math.random() - 0.5) * 5; 
            dog.y = enemy.y - 10;
            if (engine.current.frameCount % 10 === 0) {
                enemy.health -= 0.5;
                playSound('break');
                spawnParticles(dog.x + 10, dog.y + 10, '#ef4444', 3, 2);
                spawnFloatingText(enemy.x, enemy.y, "1", "#ef4444");
                if (enemy.health <= 0) { killEnemy(enemy, player); dog.state = 'IDLE'; dog.target = null; }
            }
        } else if (dog.state === 'FOLLOW' || dog.state === 'CHASE') {
            if (dog.target) {
                const dx = (dog.target.x + dog.target.width/2) - (dog.x + dog.width/2);
                dog.vx += Math.sign(dx) * (dog.state === 'CHASE' ? 3 : 1.5); 
                dog.facingRight = dx > 0;
                const dy = dog.target.y - dog.y;
                if (dy < -40 && dog.grounded) { dog.vy = JUMP_FORCE * 1.2; dog.grounded = false; }
                const dist = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                if (dist > 400 && dog.state === 'FOLLOW') { dog.x = dog.target.x; dog.y = dog.target.y; dog.vx = 0; spawnParticles(dog.x, dog.y, '#fff', 10); }
                if (dog.state === 'CHASE' && checkCollision(dog, dog.target) && dog.target.type === EntityType.ENEMY) { dog.state = 'BRAWL'; }
            }
        } else if (dog.state === 'IDLE') { dog.vx *= 0.5; }
        if (dog.state !== 'BRAWL') {
            dog.vx *= 0.8;
            dog.vy += GRAVITY;
            dog.x += dog.vx;
            dog.y += dog.vy;
            checkPlatformCollisions(dog);
            if (dog.y + dog.height > CANVAS_HEIGHT - 32) { dog.y = CANVAS_HEIGHT - 32 - dog.height; dog.vy = 0; dog.grounded = true; }
        }
    }
    if (dog.x < 0) dog.x = 0;
    if (dog.x > CANVAS_WIDTH - dog.width) dog.x = CANVAS_WIDTH - dog.width;
  };

  const checkPlatformCollisions = (entity: Entity) => {
    entity.grounded = false;
    entities.current.platforms.forEach(p => {
        if (
            entity.x < p.x + p.width &&
            entity.x + entity.width > p.x &&
            entity.y + entity.height > p.y &&
            entity.y + entity.height < p.y + p.height + 10 &&
            entity.vy >= 0
        ) {
            entity.grounded = true;
            entity.vy = 0;
            entity.y = p.y - entity.height;
        }
    });
  };

  const checkPlatformCollisionsSimple = (entity: Entity): boolean => {
    const feetX = entity.x + entity.width / 2;
    const feetY = entity.y + entity.height;
    for (const plat of entities.current.platforms) {
        if (feetX > plat.x && feetX < plat.x + plat.width) {
            if (feetY >= plat.y && feetY <= plat.y + 10) return true;
        }
    }
    return false;
  };

  const killEnemy = (enemy: EnemyEntity, player: PlayerEntity) => {
      enemy.markedForDeletion = true;
      state.current.enemiesKilled++;
      state.current.score += 100;
      playSound('explosion');
      spawnParticles(enemy.x, enemy.y, enemy.color, 10, 2);
      spawnFloatingText(enemy.x, enemy.y, "+100", "#fff");
      if (Math.random() < 0.3) {
          entities.current.meats.push({ id: Math.random(), type: EntityType.MEAT, x: enemy.x, y: enemy.y, width: 16, height: 16, vx: 0, vy: -2, grounded: false, markedForDeletion: false, value: 20 });
      }
      if (Math.random() < 0.1) {
          entities.current.powerups.push({ id: Math.random(), type: EntityType.POWERUP, kind: 'TRIPLE_SHOT', x: enemy.x, y: enemy.y, width: 16, height: 16, vx: 0, vy: -2, grounded: false, markedForDeletion: false, timer: 600 });
      }
  };

  const updateEnemies = (player: PlayerEntity) => {
      if (engine.current.frameCount % (60 * (3 - Math.min(2, state.current.level * 0.5))) === 0 && entities.current.enemies.length < 5 && state.current.level !== 3) {
          const tier = Math.random() < 0.3 ? EnemyTier.LARGE : (Math.random() < 0.5 ? EnemyTier.MEDIUM : EnemyTier.SMALL);
          let width = 36, height = 24, health = 2, color = '#9ca3af';
          if (tier === EnemyTier.MEDIUM) { width = 44; height = 28; health = 4; color = '#4b5563'; }
          if (tier === EnemyTier.LARGE) { width = 56; height = 36; health = 8; color = '#1f2937'; }

          entities.current.enemies.push({
              id: Math.random(), type: EntityType.ENEMY, tier, x: Math.random() > 0.5 ? -50 : CANVAS_WIDTH + 50, y: Math.random() * (CANVAS_HEIGHT - 100), width, height, vx: 0, vy: 0, grounded: false, markedForDeletion: false, health, maxHealth: health, stunTimer: 0, color
          });
      }

      entities.current.enemies.forEach(e => {
          if (e.stunTimer > 0) { e.stunTimer--; e.vx = 0; } else {
              const dx = player.x - e.x;
              const dy = player.y - e.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < 400) {
                  e.vx = (dx / dist) * (1 + state.current.level * 0.2);
                  if (isTopDown()) e.vy = (dy / dist) * (1 + state.current.level * 0.2);
                  else {
                      e.vx = Math.sign(dx) * (isTopDown() ? 1 : 0.5);
                      // Jump
                      if(e.grounded && (Math.random() < 0.01 || (dy < -50 && Math.abs(dx) < 100))) {
                          e.vy = JUMP_FORCE; e.grounded = false;
                      }
                  }
              }
          }
          if (!isTopDown()) { e.vy += GRAVITY; checkPlatformCollisions(e); if (e.y + e.height > CANVAS_HEIGHT - 32) { e.y = CANVAS_HEIGHT - 32 - e.height; e.vy = 0; e.grounded = true; } }
          e.x += e.vx; e.y += e.vy;
          if (checkCollision(player, e) && player.invulnerableTimer <= 0 && e.stunTimer <= 0) {
              player.health -= 10; player.invulnerableTimer = 60; player.vx = Math.sign(player.x - e.x) * 10; player.vy = -5;
              playSound('hit'); engine.current.shake = 5; spawnFloatingText(player.x, player.y, "-10", "#ef4444");
              if (player.health <= 0) handlePlayerDeath();
          }
      });
      entities.current.enemies = entities.current.enemies.filter(e => !e.markedForDeletion);
  };

  const updateCrows = (player: PlayerEntity) => {
        if (state.current.level !== 3 && engine.current.frameCount % 300 === 0 && entities.current.crows.length < 3) {
             entities.current.crows.push({
                 id: Math.random(), type: EntityType.CROW, state: 'FLY', x: Math.random() > 0.5 ? -50 : CANVAS_WIDTH + 50, y: 50 + Math.random() * 100, width: 24, height: 24, vx: Math.random() > 0.5 ? 2 : -2, vy: 0, grounded: false, markedForDeletion: false, startX: 0, startY: 0, diveTimer: 0, facingRight: true, health: 2, color: '#374151'
             });
        }
        entities.current.crows.forEach(c => {
             if (c.state === 'FLY') {
                 c.x += c.vx; c.y = c.y + Math.sin(engine.current.frameCount * 0.05) * 2;
                 if (c.x < -100 || c.x > CANVAS_WIDTH + 100) c.vx *= -1;
                 if (Math.abs(c.x - player.x) < 100 && c.y < player.y) { c.state = 'DIVE'; c.startX = c.x; c.startY = c.y; const dx = player.x - c.x; const dy = player.y - c.y; const dist = Math.sqrt(dx*dx + dy*dy); c.vx = (dx/dist) * 6; c.vy = (dy/dist) * 6; playSound('whistle'); }
             } else if (c.state === 'DIVE') {
                 c.x += c.vx; c.y += c.vy;
                 if (c.y > CANVAS_HEIGHT - 50 || c.y > player.y + 100) { c.state = 'RETURN'; c.vy = -4; }
             } else if (c.state === 'RETURN') {
                 c.x += c.vx * 0.5; c.y += c.vy;
                 if (c.y <= 100) { c.state = 'FLY'; c.vy = 0; c.vx = c.vx > 0 ? 3 : -3; }
             }
             c.facingRight = c.vx > 0;
             if (checkCollision(c, player) && player.invulnerableTimer <= 0) {
                  player.health -= 15; player.invulnerableTimer = 60; playSound('hit'); spawnFloatingText(player.x, player.y, "-15", "#ef4444");
                  if (player.health <= 0) handlePlayerDeath();
             }
        });
        entities.current.crows = entities.current.crows.filter(c => !c.markedForDeletion);
  };

  const updateDucks = (whistle: boolean) => {
      entities.current.ducks.forEach(d => {
           if (d.state === 'SWIM') { d.x += d.facingRight ? 0.5 : -0.5; if (d.x > CANVAS_WIDTH) d.x = 0; if (d.x < 0) d.x = CANVAS_WIDTH; }
      });
  };

  const updateArrows = () => {
      entities.current.arrows.forEach(a => {
          a.lifeTime--;
          if (a.lifeTime <= 0) a.markedForDeletion = true;
          a.vy += ARROW_GRAVITY;
          a.x += a.vx;
          a.y += a.vy;
          a.rotation = Math.atan2(a.vy, a.vx);

          entities.current.enemies.forEach(e => {
              if (checkCollision(a, e)) {
                  a.markedForDeletion = true;
                  e.health -= 1 * (entities.current.player?.powerUpTimer && entities.current.player.powerUpTimer > 0 ? 3 : 1);
                  playSound('hit');
                  spawnParticles(e.x, e.y, e.color, 5, 1);
                  if (e.health <= 0) { killEnemy(e, entities.current.player!); } else { e.vx = -e.vx; e.stunTimer = 10; }
              }
          });
          entities.current.crows.forEach(c => {
               if (checkCollision(a, c)) {
                   a.markedForDeletion = true; c.health -= 1; playSound('hit');
                   if (c.health <= 0) { c.markedForDeletion = true; state.current.score += 150; spawnParticles(c.x, c.y, '#374151', 10); playSound('explosion'); }
               }
          });
          if (!isTopDown() && checkPlatformCollisionsSimple(a)) { a.markedForDeletion = true; spawnParticles(a.x, a.y, '#9ca3af', 3); }
      });
      entities.current.arrows = entities.current.arrows.filter(a => !a.markedForDeletion);
  };

  const updateNets = () => {
      entities.current.traps.forEach(t => {
          if (t.state === 'FLYING') {
               t.vy += NET_GRAVITY; t.x += t.vx; t.y += t.vy; t.rotation += 0.2;
               if (t.y > CANVAS_HEIGHT) t.markedForDeletion = true;
               entities.current.enemies.forEach(e => {
                   if (checkCollision(t, e)) { t.markedForDeletion = true; e.stunTimer = 180; playSound('hit'); spawnFloatingText(e.x, e.y - 10, "STUNNED!", "#facc15"); }
               });
          }
      });
      entities.current.traps = entities.current.traps.filter(t => !t.markedForDeletion);
  };

  const updateParticles = () => {
      entities.current.particles.forEach(p => {
          p.lifeTime--;
          if (p.lifeTime <= 0) p.markedForDeletion = true;
          p.x += p.vx; p.y += p.vy; p.vy += 0.1;
      });
      entities.current.particles = entities.current.particles.filter(p => !p.markedForDeletion);
  };

  const updatePowerUps = (player: PlayerEntity) => {
      entities.current.powerups.forEach(p => {
          if (!isTopDown()) { p.vy += GRAVITY; checkPlatformCollisions(p); if (p.y + p.height > CANVAS_HEIGHT - 32) { p.y = CANVAS_HEIGHT - 32 - p.height; p.vy = 0; } }
          p.y += p.vy;
          if (checkCollision(player, p)) {
              p.markedForDeletion = true; player.powerUpTimer = p.timer; playSound('coin'); spawnFloatingText(player.x, player.y - 20, "TRIPLE SHOT!", "#a855f7");
          }
      });
      entities.current.powerups = entities.current.powerups.filter(p => !p.markedForDeletion);
  };

  const updateFloatingTexts = () => {
      entities.current.floatingTexts.forEach(t => {
          t.lifeTime--; t.y -= 1;
          if (t.lifeTime <= 0) t.markedForDeletion = true;
      });
      entities.current.floatingTexts = entities.current.floatingTexts.filter(t => !t.markedForDeletion);
  };
  
  // --- RENDERING ---

  const drawDog = (ctx: CanvasRenderingContext2D, d: DogEntity) => {
      ctx.save();
      ctx.translate(d.x + d.width/2, d.y + d.height/2);
      if (!d.facingRight) ctx.scale(-1, 1);
      
      const cycle = (Math.abs(d.vx) > 0.1 || Math.abs(d.vy) > 0.1) ? Math.sin(engine.current.frameCount * 0.5) * 5 : 0;
      
      // -- CHUNKY DOG PIXEL ART --
      ctx.fillStyle = '#d97706'; // Base Orange
      // Body
      ctx.fillRect(-12, -6, 24, 12);
      // Head
      ctx.fillRect(8, -12, 12, 12);
      // Snout
      ctx.fillRect(18, -8, 6, 6);
      // Nose
      ctx.fillStyle = '#000';
      ctx.fillRect(22, -8, 2, 2);
      // Ears
      ctx.fillStyle = '#92400e';
      ctx.fillRect(10, -14, 4, 4);
      
      // Legs
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-10 + cycle, 6, 4, 8); // Back
      ctx.fillRect(10 - cycle, 6, 4, 8); // Front

      // Tail
      ctx.fillStyle = '#d97706';
      const wag = Math.sin(engine.current.frameCount * 0.5) * 5;
      ctx.fillRect(-16, -8 + wag, 4, 8);

      if (d.state === 'CARRY') { ctx.fillStyle = '#fff'; ctx.fillRect(18, -4, 10, 8); }
      ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const time = engine.current.frameCount;
    if (state.current.level === 3) {
        ctx.fillStyle = '#4ade80'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#22c55e'; for(let i=0; i<100; i++) { const x = (i * 37) % CANVAS_WIDTH; const y = (i * 101) % CANVAS_HEIGHT; ctx.fillRect(x, y, 4, 4); }
        ctx.shadowBlur = 40; ctx.shadowColor = '#fde047'; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(800, 80, 50, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        engine.current.clouds.forEach(c => { const x = (c.x + time * c.speed) % (CANVAS_WIDTH + 100) - 50; ctx.beginPath(); ctx.arc(x, c.y, 30 * c.scale, 0, Math.PI*2); ctx.arc(x + 25 * c.scale, c.y - 10 * c.scale, 35 * c.scale, 0, Math.PI*2); ctx.arc(x + 50 * c.scale, c.y, 30 * c.scale, 0, Math.PI*2); ctx.fill(); });
    } else {
        const isStorm = state.current.isRaining;
        if (state.current.lightningTimer > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            if (isStorm) { gradient.addColorStop(0, '#0f172a'); gradient.addColorStop(1, '#020617'); } else { gradient.addColorStop(0, '#0f172a'); gradient.addColorStop(1, '#1e1b4b'); }
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        if (!state.current.isRaining) { 
            ctx.shadowBlur = 20; ctx.shadowColor = '#fef3c7'; ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(800, 80, 40, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(253, 224, 71, 0.6)'; engine.current.fireflies.forEach(f => { const y = f.y + Math.sin((time * f.speed) + f.offset) * 20; const x = (f.x + time * 0.2) % CANVAS_WIDTH; ctx.globalAlpha = 0.5 + Math.sin(time * 0.1 + f.offset) * 0.5; ctx.beginPath(); ctx.arc(x, y, f.size, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1.0;
        }
    }
    if (!isTopDown()) {
        ctx.fillStyle = state.current.level === 3 ? '#166534' : '#1e293b'; ctx.beginPath(); ctx.moveTo(0, CANVAS_HEIGHT - 32);
        for (let i = 0; i <= CANVAS_WIDTH; i += 100) { ctx.lineTo(i, CANVAS_HEIGHT - 120 - Math.sin(i * 0.01 + state.current.level) * 60); }
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 32); ctx.fill();
        ctx.fillStyle = state.current.level === 3 ? '#14532d' : '#020617';
        for (let i = 40; i < CANVAS_WIDTH; i += 180) { const sway = Math.sin(time * 0.02 + i) * 5; ctx.fillRect(i, CANVAS_HEIGHT - 180, 24, 150); ctx.beginPath(); ctx.arc(i + 12 + sway, CANVAS_HEIGHT - 180, 40 + (state.current.level * 5), 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#020617'; ctx.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 32); ctx.fillStyle = '#14532d'; ctx.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 6);
    }
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx);

    if (engine.current.shake > 0) {
        ctx.save(); const dx = (Math.random() - 0.5) * engine.current.shake; const dy = (Math.random() - 0.5) * engine.current.shake; ctx.translate(dx, dy); engine.current.shake *= 0.9; if (engine.current.shake < 0.5) engine.current.shake = 0;
    }

    ctx.fillStyle = '#404040';
    entities.current.platforms.forEach(p => {
        ctx.fillStyle = state.current.level === 3 ? '#57534e' : '#1e293b'; ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = state.current.level === 3 ? '#84cc16' : '#15803d'; ctx.fillRect(p.x, p.y, p.width, 5);
    });

    if (entities.current.door) {
        const d = entities.current.door;
        ctx.fillStyle = d.isOpen ? '#22c55e' : '#7f1d1d'; ctx.fillRect(d.x, d.y, d.width, d.height);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(d.x, d.y, d.width, d.height);
    }

    entities.current.bushes.forEach(b => {
         ctx.save(); ctx.translate(b.x + b.width/2, b.y + b.height/2);
         if (b.shakeTimer > 0) ctx.rotate((Math.random() - 0.5) * 0.2);
         ctx.fillStyle = '#14532d'; ctx.beginPath(); ctx.arc(-10, 5, 15, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(10, 5, 15, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.arc(0, -5, 18, 0, Math.PI*2); ctx.fill();
         if (b.id % 2 > 1) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(-5, -5, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5, 0, 3, 0, Math.PI*2); ctx.fill(); }
         ctx.restore();
    });

    entities.current.rabbits.forEach(r => {
        if (!r.isHidden && r.state !== 'DEAD') {
            ctx.save(); ctx.translate(r.x + r.width/2, r.y + r.height/2);
            if (!r.facingRight) ctx.scale(-1, 1);
            const hop = Math.abs(Math.sin(engine.current.frameCount * 0.5)) * 5;
            ctx.fillStyle = '#fff'; ctx.fillRect(-8, -4 - hop, 16, 12); ctx.fillRect(4, -10 - hop, 10, 10);
            ctx.fillStyle = '#fca5a5'; ctx.fillRect(6, -18 - hop, 2, 8); ctx.fillRect(10, -18 - hop, 2, 8);
            ctx.fillStyle = '#000'; ctx.fillRect(10, -8 - hop, 2, 2);
            ctx.restore();
        }
    });

    ctx.strokeStyle = '#fff';
    entities.current.traps.forEach(t => {
        ctx.save(); ctx.translate(t.x + t.width/2, t.y + t.height/2); ctx.rotate(t.rotation);
        ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.strokeRect(-8, -8, 16, 16); ctx.restore();
    });

    // DRAW ARROWS (VISIBLE)
    entities.current.arrows.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);
        
        // Outline
        ctx.fillStyle = '#000';
        ctx.fillRect(-10, -3, 20, 6);
        
        // Shaft
        ctx.fillStyle = '#fbbf24'; // Bright yellow for visibility
        ctx.fillRect(-8, -1, 16, 2);
        
        // Tip
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(14, 0); ctx.lineTo(8, 3); ctx.fill();
        
        ctx.restore();
    });

    // --- DRAW ENEMIES (WOLVES - SOLID CHUNKY STYLE) ---
    entities.current.enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x + e.width/2, e.y + e.height/2);
        const facingRight = e.vx > 0;
        if (!facingRight) ctx.scale(-1, 1);

        const cycle = Math.sin(engine.current.frameCount * 0.3) * 5;
        const color = e.stunTimer > 0 ? '#facc15' : e.color;
        
        // Outline
        // ctx.fillStyle = '#000';
        // ctx.fillRect(-e.width/2 - 2, -e.height/2 - 2, e.width + 4, e.height + 4);

        ctx.fillStyle = color;

        // BODY
        ctx.fillRect(-15, -8, 30, 16); // Main body block
        ctx.fillRect(10, -16, 12, 12); // Neck/Head block connecting

        // HEAD
        ctx.fillRect(12, -20, 16, 16); // Main Head
        ctx.fillRect(26, -14, 8, 8);   // Snout
        ctx.fillStyle = '#000'; 
        ctx.fillRect(32, -14, 4, 4);   // Nose

        // EYES (RED)
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(20, -16, 4, 4);

        // EARS
        ctx.fillStyle = color;
        ctx.fillRect(14, -26, 4, 6);
        ctx.fillRect(22, -26, 4, 6);

        // LEGS (Animated)
        ctx.fillStyle = '#1f2937'; // Darker for legs
        if (Math.abs(e.vx) > 0.1) {
            ctx.fillRect(-12 + cycle, 8, 6, 10);
            ctx.fillRect(12 - cycle, 8, 6, 10);
        } else {
            ctx.fillRect(-12, 8, 6, 10);
            ctx.fillRect(12, 8, 6, 10);
        }

        // TAIL
        ctx.fillStyle = color;
        ctx.fillRect(-20, -10 + (cycle/2), 6, 14);

        // Health Bar
        ctx.fillStyle = '#7f1d1d'; 
        ctx.fillRect(-15, -40, 30, 4);
        ctx.fillStyle = '#22c55e'; 
        ctx.fillRect(-15, -40, 30 * (e.health/e.maxHealth), 4);
        
        ctx.restore();
    });

    // --- DRAW CROWS (CHUNKY PIXEL) ---
    entities.current.crows.forEach(c => {
         ctx.save(); 
         ctx.translate(c.x + c.width/2, c.y + c.height/2); 
         if (!c.facingRight) ctx.scale(-1, 1);
         
         // Body
         ctx.fillStyle = '#1f2937';
         ctx.fillRect(-10, -5, 20, 10);
         
         // Head
         ctx.fillRect(5, -10, 10, 10);
         
         // Beak
         ctx.fillStyle = '#fbbf24';
         ctx.fillRect(15, -6, 6, 4);
         
         // Wing (Animated)
         ctx.fillStyle = '#000';
         if (c.state === 'FLY') {
             const flap = Math.floor(Math.sin(engine.current.frameCount * 0.5) * 8);
             ctx.fillRect(-5, -10 + flap, 12, 6);
         } else {
             ctx.fillRect(-8, -8, 12, 6); // Dive wings
         }

         ctx.restore();
    });

    // --- DRAW PLAYER (RETRO LINK STYLE) ---
    const p = entities.current.player;
    if (p) {
        ctx.save();
        ctx.translate(p.x + p.width/2, p.y + p.height/2);
        if (!p.facingRight) ctx.scale(-1, 1);

        if (p.isDashing) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; }

        // Boots
        ctx.fillStyle = '#78350f';
        const walk = (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) && (p.grounded || isTopDown()) ? Math.sin(engine.current.frameCount * 0.4) * 6 : 0;
        ctx.fillRect(-10 + walk, 12, 8, 12); // Left Leg
        ctx.fillRect(2 - walk, 12, 8, 12);  // Right Leg

        // Tunic (Green)
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(-10, -12, 20, 24); 
        
        // Belt
        ctx.fillStyle = '#92400e';
        ctx.fillRect(-10, 4, 20, 4);

        // Head (Skin)
        ctx.fillStyle = '#fca5a5';
        ctx.fillRect(-8, -26, 16, 14);

        // Hat (Green Hood)
        ctx.fillStyle = '#15803d';
        ctx.fillRect(-10, -32, 20, 8); // Top part
        ctx.fillRect(-12, -30, 4, 24); // Back part/Cap tail

        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(2, -22, 2, 4);

        // ARMS & BOW
        ctx.save();
        // Arms should aim towards aimAngle
        let armAngle = p.facingRight ? p.aimAngle : Math.PI - p.aimAngle;
        ctx.rotate(armAngle);
        
        // Arm
        ctx.fillStyle = '#16a34a'; 
        ctx.fillRect(-4, -4, 16, 8);
        // Hand
        ctx.fillStyle = '#fca5a5';
        ctx.fillRect(10, -4, 4, 8);

        // BOW
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(14, 0, 14, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        
        // String
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (p.isAiming || input.current.mouse.leftDown || input.current.touch.rightStick.active) {
            ctx.moveTo(14, -14); ctx.lineTo(4, 0); ctx.lineTo(14, 14); // Pulled
            // Arrow Loaded
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(4, -1, 20, 2);
        } else {
            ctx.moveTo(14, -14); ctx.lineTo(14, 14); // Idle
        }
        ctx.stroke();

        ctx.restore();
        
        if (p.powerUpTimer > 0) {
            ctx.fillStyle = '#22d3ee'; ctx.fillRect(-10, -35, 20, 4);
            ctx.fillStyle = '#fff'; ctx.fillRect(-10, -35, 20 * (p.powerUpTimer / 300), 4);
        }
        ctx.restore();
    }

    if (entities.current.dog) drawDog(ctx, entities.current.dog);

    entities.current.particles.forEach(pt => {
        ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    });

    entities.current.meats.forEach(m => {
         ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(m.x + m.width/2, m.y + m.height/2, 8, 0, Math.PI * 2); ctx.fill();
         ctx.fillStyle = '#fff'; ctx.fillRect(m.x + 4, m.y + 6, 8, 4);
    });

    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    entities.current.floatingTexts.forEach(t => {
        ctx.fillStyle = t.color; ctx.globalAlpha = Math.max(0, t.lifeTime / 60); ctx.fillText(t.text, t.x, t.y); ctx.globalAlpha = 1;
    });

    if (engine.current.shake > 0) ctx.restore();

    // UI HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '20px monospace';
    ctx.fillText(`LIVES: ${state.current.lives}`, 20, 30);
    ctx.fillText(`LEVEL: ${state.current.level}`, 20, 60);
    ctx.fillText(`SCORE: ${state.current.score}`, 20, 90);
    
    ctx.textAlign = 'right';
    if (state.current.level === 3) {
        ctx.fillText(`RABBITS: ${state.current.enemiesKilled}/${state.current.enemiesRequired}`, CANVAS_WIDTH - 20, 30);
    } else {
        ctx.fillText(`ENEMIES: ${state.current.enemiesKilled}/${state.current.enemiesRequired}`, CANVAS_WIDTH - 20, 30);
    }

    // Controls
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(LEFT_STICK_X, LEFT_STICK_Y, JOYSTICK_RADIUS, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); const ls = input.current.touch.leftStick; ctx.arc(LEFT_STICK_X + ls.x, LEFT_STICK_Y + ls.y, 20, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();

    ctx.beginPath(); ctx.arc(RIGHT_STICK_X, RIGHT_STICK_Y, JOYSTICK_RADIUS, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
    const rs = input.current.touch.rightStick; ctx.beginPath(); ctx.arc(RIGHT_STICK_X + rs.x, RIGHT_STICK_Y + rs.y, 20, 0, Math.PI*2); ctx.fill();

    ctx.textAlign = 'center';
    ctx.beginPath(); ctx.arc(TRAP_BTN_X, TRAP_BTN_Y, TRAP_BTN_RADIUS, 0, Math.PI*2); ctx.fillStyle = '#facc15'; ctx.fill(); ctx.fillStyle = '#000'; ctx.font = '12px monospace'; ctx.fillText('NET', TRAP_BTN_X, TRAP_BTN_Y + 5);
    ctx.beginPath(); ctx.arc(WHISTLE_BTN_X, WHISTLE_BTN_Y, WHISTLE_BTN_RADIUS, 0, Math.PI*2); ctx.fillStyle = '#3b82f6'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('CALL', WHISTLE_BTN_X, WHISTLE_BTN_Y + 5);
    ctx.beginPath(); ctx.arc(DASH_BTN_X, DASH_BTN_Y, DASH_BTN_RADIUS, 0, Math.PI*2); ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('DASH', DASH_BTN_X, DASH_BTN_Y + 5);
    ctx.globalAlpha = 1;

    // Screens
    if (state.current.status === GameStatus.GAME_OVER) {
         ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); ctx.fillStyle = '#ef4444'; ctx.font = '60px monospace'; ctx.fillText('GAME OVER', CANVAS_WIDTH/2, CANVAS_HEIGHT/2); ctx.fillStyle = '#fff'; ctx.font = '20px monospace'; ctx.fillText('Press SPACE or Tap to Retry', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 50);
    } else if (state.current.status === GameStatus.VICTORY) {
         ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); ctx.fillStyle = '#facc15'; ctx.font = '60px monospace'; ctx.fillText('VICTORY!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2); ctx.fillStyle = '#fff'; ctx.font = '20px monospace'; ctx.fillText('Final Score: ' + state.current.score, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 50);
    } else if (state.current.status === GameStatus.MENU) {
         ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); ctx.fillStyle = '#fff'; ctx.font = '50px monospace'; ctx.fillText('HUNTER & DOG', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 50); ctx.font = '20px monospace'; ctx.fillText('WASD/Arrows to Move', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 20); ctx.fillText('Mouse/Right Stick to Aim & Shoot', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 50); ctx.fillText('T/Trap Button to Throw Net', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 80); ctx.fillText('R/Call Button to Command Dog', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 110); ctx.fillStyle = '#3b82f6'; ctx.fillText('CLICK TO START', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 160);
    }
  };

  // --- GAME LOOP ---
  useEffect(() => {
    const loop = () => { update(); draw(); requestRef.current = requestAnimationFrame(loop); };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // --- INPUT ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        input.current.keys.add(e.code);
        if (state.current.status === GameStatus.MENU || state.current.status === GameStatus.GAME_OVER || state.current.status === GameStatus.VICTORY) { if (e.code === 'Space' || e.code === 'Enter') initGame(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => input.current.keys.delete(e.code);
    const handleMouseDown = (e: MouseEvent) => {
        input.current.mouse.leftDown = true;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) { input.current.mouse.x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width); input.current.mouse.y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height); }
        if (state.current.status !== GameStatus.PLAYING) initGame();
        else if (entities.current.player) fireArrow(entities.current.player); // Instant fire on click
    };
    const handleMouseUp = () => input.current.mouse.leftDown = false;
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) { input.current.mouse.x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width); input.current.mouse.y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height); }
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); window.addEventListener('mousedown', handleMouseDown); window.addEventListener('mouseup', handleMouseUp); window.addEventListener('mousemove', handleMouseMove);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('mousedown', handleMouseDown); window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('mousemove', handleMouseMove); };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    if (state.current.status !== GameStatus.PLAYING) { initGame(); return; }
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const t = touches[i]; const tx = (t.clientX - rect.left) * (CANVAS_WIDTH / rect.width); const ty = (t.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
        if (Math.hypot(tx - LEFT_STICK_X, ty - LEFT_STICK_Y) < JOYSTICK_HIT_RADIUS) { input.current.touch.leftStick.active = true; input.current.touch.leftStick.touchId = t.identifier; input.current.touch.leftStick.x = 0; input.current.touch.leftStick.y = 0; continue; }
        if (Math.hypot(tx - RIGHT_STICK_X, ty - RIGHT_STICK_Y) < JOYSTICK_HIT_RADIUS) { input.current.touch.rightStick.active = true; input.current.touch.rightStick.touchId = t.identifier; input.current.touch.rightStick.x = 0; input.current.touch.rightStick.y = 0; continue; }
        if (Math.hypot(tx - TRAP_BTN_X, ty - TRAP_BTN_Y) < BUTTON_HIT_RADIUS) input.current.touch.trapBtnPressed = true;
        if (Math.hypot(tx - WHISTLE_BTN_X, ty - WHISTLE_BTN_Y) < BUTTON_HIT_RADIUS) input.current.touch.whistleBtnPressed = true;
        if (Math.hypot(tx - DASH_BTN_X, ty - DASH_BTN_Y) < BUTTON_HIT_RADIUS) input.current.touch.dashBtnPressed = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault(); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const t = touches[i]; const tx = (t.clientX - rect.left) * (CANVAS_WIDTH / rect.width); const ty = (t.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
        if (t.identifier === input.current.touch.leftStick.touchId) { let dx = tx - LEFT_STICK_X; let dy = ty - LEFT_STICK_Y; const dist = Math.hypot(dx, dy); if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; } input.current.touch.leftStick.x = dx; input.current.touch.leftStick.y = dy; }
        if (t.identifier === input.current.touch.rightStick.touchId) { let dx = tx - RIGHT_STICK_X; let dy = ty - RIGHT_STICK_Y; const dist = Math.hypot(dx, dy); if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; } input.current.touch.rightStick.x = dx; input.current.touch.rightStick.y = dy; }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault(); const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (t.identifier === input.current.touch.leftStick.touchId) { input.current.touch.leftStick.active = false; input.current.touch.leftStick.x = 0; input.current.touch.leftStick.y = 0; input.current.touch.leftStick.touchId = null; }
        if (t.identifier === input.current.touch.rightStick.touchId) { 
            input.current.touch.rightStick.active = false; input.current.touch.rightStick.x = 0; input.current.touch.rightStick.y = 0; input.current.touch.rightStick.touchId = null; 
            if (entities.current.player) fireArrow(entities.current.player);
        }
    }
  };

  return (
    <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full object-contain cursor-crosshair touch-none"
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    />
  );
};

export default GameLogic;