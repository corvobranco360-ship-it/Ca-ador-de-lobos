import React, { useEffect, useRef } from 'react';
import { 
  EntityType, GameStatus, GameState, 
  PlayerEntity, EnemyEntity, ArrowEntity, TrapEntity, ParticleEntity, PlatformEntity, DoorEntity, CageEntity, DogEntity, DuckEntity, MeatEntity,
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
const NET_SPEED = 12;
const ARROW_GRAVITY = 0.25;
const NET_GRAVITY = 0.4;
const TRAP_COOLDOWN_FRAMES = 120;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const LAKE_LEVEL_Y = CANVAS_HEIGHT - 32;

// UI CONSTANTS
const TRAP_BTN_X = CANVAS_WIDTH - 80;
const TRAP_BTN_Y = CANVAS_HEIGHT - 140;
const TRAP_BTN_RADIUS = 45; 
const WHISTLE_BTN_X = CANVAS_WIDTH - 180;
const WHISTLE_BTN_Y = CANVAS_HEIGHT - 80;
const WHISTLE_BTN_RADIUS = 35;

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
    traps: TrapEntity[];
    particles: ParticleEntity[];
    platforms: PlatformEntity[];
    door: DoorEntity | null;
    cages: CageEntity[];
    dog: DogEntity | null;
    ducks: DuckEntity[]; 
    meats: MeatEntity[]; 
  }>({ 
      player: null, enemies: [], arrows: [], traps: [], particles: [], platforms: [], 
      door: null, cages: [], dog: null, ducks: [], meats: [] 
  });

  const input = useRef({
    keys: new Set<string>(),
    mouse: { x: 0, y: 0, leftDown: false },
    touch: {
      leftStick: { active: false, x: 0, y: 0, originX: 0, originY: 0 },
      rightStick: { active: false, x: 0, y: 0, originX: 0, originY: 0 },
      trapBtnPressed: false,
      whistleBtnPressed: false
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

  // --- STATE MANAGEMENT ---

  const initGame = () => {
    state.current = {
      status: GameStatus.PLAYING,
      level: 1,
      score: 0,
      waveProgress: 0,
      maxWaves: 5,
      enemiesKilled: 0,
      enemiesRequired: 4
    };
    entities.current.dog = null;
    startLevel(1);
  };

  const startLevel = (level: number) => {
    state.current.level = level;
    state.current.waveProgress = 0;
    state.current.enemiesKilled = 0;
    state.current.enemiesRequired = level === 1 ? 4 : 4 + (level * 2); 
    
    // Reset Entities
    entities.current.enemies = [];
    entities.current.arrows = [];
    entities.current.traps = [];
    entities.current.particles = [];
    entities.current.platforms = [];
    entities.current.cages = [];
    entities.current.ducks = [];
    entities.current.meats = [];
    entities.current.door = null;
    
    generateLevel(level);

    // Keep dog if unlocked
    if (entities.current.dog) {
        entities.current.dog.x = 20;
        entities.current.dog.y = CANVAS_HEIGHT - 100;
        entities.current.dog.vx = 0;
        entities.current.dog.vy = 0;
        entities.current.dog.state = 'IDLE';
        entities.current.dog.aggroTimer = 0;
        entities.current.dog.target = null;
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
      animTimer: 0
    };

    if (level === 3) {
        spawnDucks(5);
    }

    engine.current.spawnTimer = 0;
  };

  const spawnDucks = (count: number) => {
      for(let i=0; i<count; i++) {
          entities.current.ducks.push({
              id: Math.random(),
              type: EntityType.DUCK,
              x: 300 + Math.random() * (CANVAS_WIDTH - 400),
              y: LAKE_LEVEL_Y, // On water surface
              width: 32, height: 22, // Bigger Ducks (requested)
              vx: (Math.random() - 0.5) * 0.5,
              vy: 0,
              grounded: true, markedForDeletion: false,
              state: 'SWIM',
              facingRight: Math.random() > 0.5,
              flightTimer: 0,
              flapTimer: 0,
              color: '#15803d' // Mallard green head
          });
      }
  };

  const generateLevel = (level: number) => {
    const platforms = entities.current.platforms;
    
    if (level === 1) {
       platforms.push({ id: 1, type: EntityType.PLATFORM, x: 200, y: 400, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
       platforms.push({ id: 2, type: EntityType.PLATFORM, x: 500, y: 300, width: 200, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
       platforms.push({ id: 3, type: EntityType.PLATFORM, x: 800, y: 200, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    } else if (level === 2) {
        platforms.push({ id: 1, type: EntityType.PLATFORM, x: 100, y: 400, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 2, type: EntityType.PLATFORM, x: 300, y: 350, width: 400, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 3, type: EntityType.PLATFORM, x: 800, y: 400, width: 100, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        if (!entities.current.dog) {
            entities.current.cages.push({
                id: 888, type: EntityType.CAGE,
                x: 600, y: 290, width: 60, height: 60,
                vx: 0, vy: 0, grounded: true, markedForDeletion: false,
                health: 3
            });
        }
    } else if (level === 3) {
        // LAKE LEVEL (Moved from 4 to 3)
        platforms.push({ id: 1, type: EntityType.PLATFORM, x: 0, y: 400, width: 250, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
        platforms.push({ id: 2, type: EntityType.PLATFORM, x: 850, y: 400, width: 110, height: 20, vx: 0, vy: 0, grounded: true, markedForDeletion: false });
    } else if (level === 4) {
        // TREE TOPS (Moved from 3 to 4)
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

    const doorX = level % 2 === 0 ? 50 : CANVAS_WIDTH - 80;
    const doorY = level === 4 ? 140 : CANVAS_HEIGHT - 32 - 64; 
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

    if (entities.current.door) {
        if (state.current.level === 3) {
            entities.current.door.isOpen = true;
        } else {
            entities.current.door.isOpen = state.current.enemiesKilled >= state.current.enemiesRequired;
        }
    }

    // INPUT
    let dx = 0;
    let jump = false;
    let throwNet = false;
    let whistle = false;
    let shootCommand = false;
    
    if (input.current.keys.has('KeyA') || input.current.keys.has('ArrowLeft')) dx = -1;
    if (input.current.keys.has('KeyD') || input.current.keys.has('ArrowRight')) dx = 1;
    if (input.current.keys.has('Space') || input.current.keys.has('ArrowUp')) jump = true;
    if (input.current.keys.has('KeyT')) throwNet = true;
    if (input.current.keys.has('KeyR')) whistle = true; 
    
    const mx = input.current.mouse.x;
    const my = input.current.mouse.y;
    if (input.current.mouse.x !== 0 || input.current.mouse.y !== 0 && !input.current.touch.rightStick.active) {
        player.aimAngle = Math.atan2(my - (player.y + 15), mx - (player.x + 12));
    }
    if (input.current.mouse.leftDown) shootCommand = true;

    const { leftStick, rightStick, trapBtnPressed, whistleBtnPressed } = input.current.touch;
    if (trapBtnPressed) { throwNet = true; input.current.touch.trapBtnPressed = false; }
    if (whistleBtnPressed) { whistle = true; input.current.touch.whistleBtnPressed = false; }

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

    // PLAYER PHYSICS
    const wasGrounded = player.grounded;
    player.vx += dx * MOVEMENT_SPEED;
    player.vx *= FRICTION;
    player.vx = Math.max(Math.min(player.vx, MAX_SPEED), -MAX_SPEED);
    
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

    if (entities.current.door && entities.current.door.isOpen) {
        if (checkCollision(player, entities.current.door)) {
            nextLevel();
            return;
        }
    }

    if (shootCommand) {
        if (engine.current.frameCount % 20 === 0) fireArrow(player);
    }

    if (player.trapCooldown > 0) player.trapCooldown--;
    if (throwNet && player.trapCooldown <= 0) {
      fireNet(player);
      player.trapCooldown = TRAP_COOLDOWN_FRAMES;
      playSound('jump'); 
    }

    // UPDATE ENTITIES
    updateEnemies(player);
    updateDucks(whistle);
    updateArrows();
    updateNets();
    updateParticles();
    updateMeats(player);
    if (entities.current.dog) updateDog(player, whistle);
  };

  const updateDucks = (whistle: boolean) => {
      entities.current.ducks.forEach(d => {
          d.flapTimer++;

          if (d.state === 'SWIM') {
              // Float on water
              d.y = LAKE_LEVEL_Y - 12 + Math.sin(engine.current.frameCount * 0.05) * 2;
              d.x += d.vx;
              if (d.x < 0 || d.x > CANVAS_WIDTH - d.width) d.vx *= -1;
              d.facingRight = d.vx > 0;

              // Whistle scares them
              if (whistle) {
                  d.state = 'FLY';
                  d.flightTimer = 300; // 5 seconds of flight
                  d.vy = -1.5 - Math.random() * 1.5; // Slow initial take off
                  d.vx = (Math.random() - 0.5) * 3;
                  playSound('quack');
                  playSound('splash');
                  spawnParticles(d.x, d.y + 10, '#fff', 5, 1);
              }
          } else if (d.state === 'FLY') {
              d.x += d.vx;
              d.y += d.vy;
              
              if (d.flightTimer > 0) {
                  d.flightTimer--;
                  // Slower, smoother flight
                  d.vx += (Math.random() - 0.5) * 0.1;
                  d.vy += (Math.random() - 0.5) * 0.1;
                  
                  // Cap velocity to keep them "floating" rather than zooming
                  d.vx = Math.max(Math.min(d.vx, 2), -2);
                  d.vy = Math.max(Math.min(d.vy, 1.5), -1.5);
                  
                  // Keep in bounds (Upper Sky)
                  if (d.y < 50) d.vy += 0.05;
                  if (d.y > 200) d.vy -= 0.05;
                  
                  if (d.x < 0) d.vx += 0.1;
                  if (d.x > CANVAS_WIDTH) d.vx -= 0.1;

              } else {
                  // RETURN TO WATER LOGIC
                  // Don't fall on player. Glide to water level.
                  const waterTargetY = LAKE_LEVEL_Y - 14;
                  
                  // Slow down horizontal movement significantly to land
                  d.vx *= 0.95; 

                  if (d.y < waterTargetY) {
                      d.vy = 1.0; // Gentle descent speed
                  } else {
                      // Landed on water
                      d.state = 'SWIM';
                      d.y = waterTargetY;
                      d.vy = 0;
                      // Resume swimming speed
                      d.vx = (Math.random() - 0.5) * 0.5;
                      playSound('splash');
                      spawnParticles(d.x, d.y + d.height, '#fff', 6, 0.5);
                  }
              }
              d.facingRight = d.vx > 0;
          } else if (d.state === 'FALL') {
              d.vy += GRAVITY;
              d.x += d.vx;
              d.y += d.vy;
              // Spin effect
              d.facingRight = engine.current.frameCount % 10 > 5;

              if (d.y >= LAKE_LEVEL_Y - 10 || checkPlatformCollisionsSimple(d)) {
                  d.state = 'DEAD';
                  d.y = Math.min(d.y, LAKE_LEVEL_Y - 10);
                  d.vx = 0;
                  d.vy = 0;
                  playSound('hit');
              }
          } else if (d.state === 'CARRIED') {
              // Position handled by dog
          }
      });
      // Remove collected ducks
      entities.current.ducks = entities.current.ducks.filter(d => !d.markedForDeletion);
  };

  const updateMeats = (player: PlayerEntity) => {
      entities.current.meats.forEach(m => {
          m.vy += GRAVITY;
          m.y += m.vy;
          checkPlatformCollisions(m);
          if (m.y + m.height > CANVAS_HEIGHT - 32) {
              m.y = CANVAS_HEIGHT - 32 - m.height;
              m.vy = 0;
          }

          if (checkCollision(player, m)) {
              m.markedForDeletion = true;
              player.health = Math.min(player.maxHealth, player.health + 20);
              state.current.score += 50;
              playSound('coin');
              spawnParticles(m.x, m.y, '#f87171', 10, 1);
          }
      });
      entities.current.meats = entities.current.meats.filter(m => !m.markedForDeletion);
  };

  const updateDog = (player: PlayerEntity, whistleTriggered: boolean) => {
    const dog = entities.current.dog!;

    // LEVEL 3 SPECIAL BEHAVIOR (LAKE)
    if (state.current.level === 3) {
        
        // 1. Check for Carried Duck (Drop logic)
        const carriedDuck = entities.current.ducks.find(d => d.state === 'CARRIED');
        if (carriedDuck) {
            dog.state = 'RETRIEVE';
            // Run to player
            const dx = player.x - dog.x;
            dog.vx = Math.sign(dx) * 2;
            dog.facingRight = dx > 0;
            
            // Sync duck position
            carriedDuck.x = dog.x + (dog.facingRight ? 10 : -10);
            carriedDuck.y = dog.y + 4;

            // Delivery
            if (Math.abs(dx) < 40) {
                // Drop Meat
                entities.current.meats.push({
                    id: Math.random(),
                    type: EntityType.MEAT,
                    x: carriedDuck.x, y: carriedDuck.y,
                    width: 16, height: 16,
                    vx: 0, vy: -3,
                    grounded: false, markedForDeletion: false,
                    value: 20
                });
                carriedDuck.markedForDeletion = true;
                dog.state = 'IDLE';
                playSound('bark');
                spawnParticles(dog.x, dog.y, '#fbbf24', 5, 1);
            }
        } 
        // 2. Check for Dead Ducks (Fetch logic)
        else {
             const deadDuck = entities.current.ducks.find(d => d.state === 'DEAD');
             if (deadDuck) {
                 dog.state = 'RETRIEVE';
                 const dx = deadDuck.x - dog.x;
                 dog.vx = Math.sign(dx) * 2.5; // Run fast to fetch
                 dog.facingRight = dx > 0;

                 if (Math.abs(dx) < 10 && Math.abs(dog.y - deadDuck.y) < 20) {
                     deadDuck.state = 'CARRIED';
                     playSound('bark');
                 }
             } else {
                 // 3. Whistle Logic (Scare)
                 if (whistleTriggered) {
                    dog.aggroTimer = 100;
                    playSound('bark');
                    spawnParticles(dog.x, dog.y, '#fff', 5);
                 }

                 if (dog.aggroTimer > 0) {
                     // Run to water edge and bark
                     dog.state = 'CHASE';
                     dog.aggroTimer--;
                     const targetX = CANVAS_WIDTH / 2;
                     const dx = targetX - dog.x;
                     dog.vx = Math.sign(dx) * 3;
                     dog.facingRight = dx > 0;
                 } else {
                     // Passive Follow
                     dog.state = 'FOLLOW';
                     const dx = (player.x - 30) - dog.x; // Stay a bit behind
                     if (Math.abs(dx) > 30) {
                         dog.vx = Math.sign(dx) * 1.5;
                         dog.facingRight = dx > 0;
                     } else {
                         dog.state = 'IDLE';
                         dog.vx = 0;
                     }
                 }
             }
        }

    } else {
        // --- STANDARD LOGIC (Levels 1,2,4,5) ---
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
                        if (d < minDist) {
                            minDist = d;
                            nearestEnemy = e;
                        }
                    }
                });
                if (nearestEnemy) {
                    dog.state = 'CHASE';
                    dog.target = nearestEnemy;
                }
            }
        } else {
            dog.state = 'FOLLOW';
            dog.target = player;
            if (Math.abs(player.x - dog.x) < 50 && Math.abs(player.y - dog.y) < 50) {
                dog.state = 'IDLE';
                dog.target = null;
            }
        }

        if (dog.state === 'BRAWL' && dog.target) {
            const enemy = dog.target as EnemyEntity;
            if (enemy.health <= 0 || enemy.markedForDeletion) {
                dog.state = 'IDLE'; dog.target = null; return;
            }
            enemy.vx = 0; 
            dog.x = enemy.x + (Math.random() - 0.5) * 5; 
            dog.y = enemy.y - 10;
            
            if (engine.current.frameCount % 10 === 0) {
                enemy.health -= 0.5;
                playSound('break');
                spawnParticles(dog.x + 10, dog.y + 10, '#ef4444', 3, 2);
                if (enemy.health <= 0) {
                    killEnemy(enemy, player);
                    dog.state = 'IDLE';
                    dog.target = null;
                }
            }
        } else if (dog.state === 'FOLLOW' || dog.state === 'CHASE') {
            if (dog.target) {
                const dx = (dog.target.x + dog.target.width/2) - (dog.x + dog.width/2);
                dog.vx += Math.sign(dx) * (dog.state === 'CHASE' ? 3 : 1.5); 
                dog.facingRight = dx > 0;
                
                const dy = dog.target.y - dog.y;
                if (dy < -40 && dog.grounded) {
                    dog.vy = JUMP_FORCE * 1.2;
                    dog.grounded = false;
                }
                const dist = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                if (dist > 400 && dog.state === 'FOLLOW') {
                     dog.x = dog.target.x; dog.y = dog.target.y; dog.vx = 0;
                     spawnParticles(dog.x, dog.y, '#fff', 10);
                }
                if (dog.state === 'CHASE' && checkCollision(dog, dog.target) && dog.target.type === EntityType.ENEMY) {
                    dog.state = 'BRAWL';
                }
            }
        } else if (dog.state === 'IDLE') {
            dog.vx *= 0.5;
        }
    }

    if (dog.state !== 'BRAWL') {
        dog.vx *= 0.8;
        dog.vy += GRAVITY;
        dog.x += dog.vx;
        dog.y += dog.vy;

        checkPlatformCollisions(dog);

        if (dog.y + dog.height > CANVAS_HEIGHT - 32) {
          dog.y = CANVAS_HEIGHT - 32 - dog.height;
          dog.vy = 0;
          dog.grounded = true;
        }
    }
    if (dog.x < 0) dog.x = 0;
    if (dog.x > CANVAS_WIDTH - dog.width) dog.x = CANVAS_WIDTH - dog.width;
  };

  const killEnemy = (enemy: EnemyEntity, player: PlayerEntity) => {
      enemy.markedForDeletion = true;
      playSound('explosion');
      spawnParticles(enemy.x, enemy.y, enemy.color, 15, 1.5);
      state.current.score += enemy.tier === EnemyTier.LARGE ? 500 : 100;
      state.current.enemiesKilled++;
      playSound('coin');
      player.health = Math.min(player.maxHealth, player.health + 10);
      spawnParticles(player.x, player.y, '#22c55e', 10, 0.5);
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

  const updateEnemies = (player: PlayerEntity) => {
    if (state.current.level === 3) return; // NO ENEMIES IN LAKE LEVEL (3)

    engine.current.spawnTimer++;
    const activeEnemies = entities.current.enemies.filter(e => !e.markedForDeletion).length;
    
    if (engine.current.spawnTimer > 100 && activeEnemies < 4) {
      spawnEnemy();
      engine.current.spawnTimer = 0;
    }

    entities.current.enemies.forEach(enemy => {
      if (enemy.stunTimer > 0) {
        enemy.stunTimer--;
        enemy.vx = 0;
        enemy.vy += GRAVITY;
      } else {
        const dx = (player.x + player.width/2) - (enemy.x + enemy.width/2);
        const dy = (player.y + player.height/2) - (enemy.y + enemy.height/2);
        let speed = enemy.tier === EnemyTier.SMALL ? 1.5 : (enemy.tier === EnemyTier.MEDIUM ? 1.0 : 0.6);
        enemy.vx += (dx > 0 ? 0.1 : -0.1);
        enemy.vx *= FRICTION;
        
        if (enemy.vx > speed) enemy.vx = speed;
        if (enemy.vx < -speed) enemy.vx = -speed;
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

      if (checkCollision(player, enemy) && enemy.stunTimer <= 0) {
        player.health -= enemy.tier === EnemyTier.LARGE ? 10 : 5;
        engine.current.shake = 5;
        player.vx = Math.sign(player.x - enemy.x) * 10;
        player.vy = -5;
        spawnParticles((player.x + enemy.x)/2, (player.y + enemy.y)/2, '#ef4444', 4);
        if (player.health <= 0) setGameOver();
      }
    });

    entities.current.enemies = entities.current.enemies.filter(e => !e.markedForDeletion);
  };

  const checkWallInFront = (enemy: Entity) => {
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

      // Hit Ducks
      entities.current.ducks.forEach(d => {
          if (d.state === 'FLY' && checkCollision(arrow, d)) {
              d.state = 'FALL';
              d.vx = arrow.vx * 0.2;
              d.vy = -2; // Pop up slightly
              arrow.markedForDeletion = true;
              playSound('hit');
              spawnParticles(d.x, d.y, '#fff', 5, 0.5); // Feathers
          }
      });
      
      entities.current.cages.forEach(c => {
          if (checkCollision(arrow, c)) {
              arrow.markedForDeletion = true;
              c.health--;
              spawnParticles(arrow.x, arrow.y, '#9ca3af', 5);
              playSound('break');
              if (c.health <= 0) {
                  c.markedForDeletion = true;
                  releaseDog(c.x, c.y);
              }
          }
      });

      entities.current.enemies.forEach(enemy => {
        if (checkCollision(arrow, enemy)) {
          arrow.markedForDeletion = true;
          const dmg = enemy.stunTimer > 0 ? 2 : 1.0; 
          enemy.health -= dmg;
          enemy.vx += arrow.vx * 0.5;
          playSound('hit');
          spawnParticles(enemy.x, enemy.y, '#ef4444', 6, 1.2);
          if (enemy.health <= 0) {
            killEnemy(enemy, entities.current.player!);
          }
        }
      });
    });
    entities.current.arrows = entities.current.arrows.filter(a => !a.markedForDeletion);
    entities.current.cages = entities.current.cages.filter(c => !c.markedForDeletion);
  };

  const releaseDog = (x: number, y: number) => {
      entities.current.dog = {
          id: 777,
          type: EntityType.DOG,
          x: x, y: y + 20,
          width: 32, height: 24,
          vx: 0, vy: -5,
          grounded: false, markedForDeletion: false,
          facingRight: true,
          state: 'IDLE',
          target: null,
          barkTimer: 0,
          tongueOut: false,
          animTimer: 0,
          aggroTimer: 0
      };
      playSound('bark');
      spawnParticles(x, y, '#fbbf24', 20, 2);
  };

  const updateNets = () => {
    entities.current.traps.forEach(net => {
      if (net.state === 'FLYING') {
          net.vy += NET_GRAVITY;
          net.x += net.vx;
          net.y += net.vy;
          net.rotation += 0.2; 
          entities.current.enemies.forEach(enemy => {
              if (checkCollision(net, enemy) && enemy.stunTimer <= 0) {
                  net.markedForDeletion = true;
                  enemy.stunTimer = 600; 
                  enemy.vx = 0;
                  playSound('coin');
                  spawnParticles(enemy.x, enemy.y, '#fff', 8, 1);
              }
          });
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
      p.vx *= 0.94; 
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
      entities.current.traps.push({
          id: Math.random(),
          type: EntityType.TRAP,
          x: player.x + 12,
          y: player.y + 10,
          width: 16, height: 16,
          vx: Math.cos(player.aimAngle) * NET_SPEED,
          vy: Math.sin(player.aimAngle) * NET_SPEED - 2, 
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
    const width = tier === EnemyTier.LARGE ? 60 : (tier === EnemyTier.MEDIUM ? 48 : 36);
    const height = tier === EnemyTier.LARGE ? 36 : (tier === EnemyTier.MEDIUM ? 28 : 20);
    const hp = tier === EnemyTier.LARGE ? 8 : (tier === EnemyTier.MEDIUM ? 4 : 2);
    const color = tier === EnemyTier.LARGE ? '#111827' : (tier === EnemyTier.MEDIUM ? '#374151' : '#6b7280'); 
    
    const side = Math.random() > 0.5 ? 1 : -1;
    const startX = side === 1 ? -60 : CANVAS_WIDTH + 60;
    
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

    // Clear / Sky
    if (state.current.level === 3) {
        // DAY THEME
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#38bdf8'); // Sky blue
        gradient.addColorStop(1, '#bae6fd'); // Light blue
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        // NIGHT THEME
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.save();
    if (engine.current.shake > 0) {
      const mag = engine.current.shake;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      engine.current.shake *= 0.9;
    }

    drawBackground(ctx);
    drawPlatforms(ctx);
    
    if (entities.current.door) drawDoor(ctx, entities.current.door);

    entities.current.cages.forEach(c => drawCage(ctx, c));
    entities.current.ducks.forEach(d => drawDuck(ctx, d));
    entities.current.meats.forEach(m => drawMeat(ctx, m));
    
    if (entities.current.dog) drawDog(ctx, entities.current.dog);
    if (entities.current.player) drawPlayer(ctx, entities.current.player);
    
    drawEnemies(ctx);
    drawArrows(ctx);
    drawNets(ctx);
    drawParticles(ctx);
    
    if (entities.current.player?.isAiming) {
        drawTrajectory(ctx, entities.current.player);
    }

    // Ground
    ctx.fillStyle = state.current.level === 3 ? '#166534' : '#020617'; 
    ctx.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 32);
    // Grass detail
    ctx.fillStyle = state.current.level === 3 ? '#22c55e' : '#14532d'; 
    ctx.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 6);
    
    if (state.current.level === 3) {
        // Render Lake Water overlay
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillRect(250, LAKE_LEVEL_Y + 6, 600, 26);
    }

    ctx.restore(); // End Shake

    drawMobileControls(ctx);
    drawUI(ctx);
  };

  const drawDuck = (ctx: CanvasRenderingContext2D, d: DuckEntity) => {
      ctx.save();
      ctx.translate(d.x + d.width/2, d.y + d.height/2);
      if (!d.facingRight) ctx.scale(-1, 1);
      
      if (d.state === 'FALL') ctx.rotate(engine.current.frameCount * 0.2);

      // Body - Larger and rounder
      ctx.fillStyle = '#78716c'; // Grey body
      ctx.fillRect(-12, -6, 24, 14);
      
      // Wing - Flapping slowly if flying
      ctx.fillStyle = '#57534e';
      const flap = (d.state === 'FLY' && d.flightTimer > 0) ? Math.sin(engine.current.frameCount * 0.2) * 6 : 0;
      ctx.fillRect(-8, -4 - flap, 16, 8);

      // Head
      ctx.fillStyle = d.color; // Green
      ctx.fillRect(6, -12, 12, 10);
      
      // Beak
      ctx.fillStyle = '#facc15';
      ctx.fillRect(16, -8, 6, 4);

      if (d.state === 'DEAD') {
          // X Eyes
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(12, -6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(12, -10); ctx.lineTo(8, -6); ctx.stroke();
      }

      ctx.restore();
  };

  const drawMeat = (ctx: CanvasRenderingContext2D, m: MeatEntity) => {
      ctx.save();
      ctx.translate(m.x + m.width/2, m.y + m.height/2);
      // Bone
      ctx.fillStyle = '#fff';
      ctx.fillRect(-8, -2, 16, 4);
      ctx.beginPath(); ctx.arc(-8, 0, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI*2); ctx.fill();
      // Meat
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
  };

  const drawDog = (ctx: CanvasRenderingContext2D, d: DogEntity) => {
      ctx.save();
      ctx.translate(d.x + d.width/2, d.y + d.height/2);
      
      if (d.state === 'BRAWL') {
          ctx.rotate((Math.random() - 0.5) * 0.2);
      }

      if (!d.facingRight) ctx.scale(-1, 1);

      const runCycle = (Math.abs(d.vx) > 0.1) ? Math.sin(engine.current.frameCount * 0.5) * 5 : 0;

      if (d.aggroTimer > 0) {
           ctx.shadowBlur = 10;
           ctx.shadowColor = '#ef4444';
      }

      // Body
      ctx.fillStyle = '#d97706';
      
      // Legs
      ctx.fillRect(-12 + runCycle, 8, 4, 8);
      ctx.fillRect(-4 - runCycle, 8, 4, 8);
      ctx.fillRect(4 + runCycle, 8, 4, 8);
      ctx.fillRect(10 - runCycle, 8, 4, 8);

      // Main Body
      ctx.fillRect(-14, -4, 28, 12);
      
      // Tail
      const wag = Math.sin(engine.current.frameCount * (d.state === 'RETRIEVE' ? 0.8 : 0.4)) * 5;
      ctx.fillRect(-16, -6, 4, 8 + wag);

      // Head
      ctx.fillStyle = d.state === 'BRAWL' ? '#b45309' : '#d97706';
      ctx.fillRect(8, -12, 14, 12);
      
      // Ears
      ctx.fillStyle = '#92400e';
      ctx.fillRect(10, -10, 4, 8);

      // Collar
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, -2, 6, 4);

      // Face
      ctx.fillStyle = '#000'; 
      ctx.fillRect(20, -6, 4, 4);
      
      // Holding Item?
      if (d.state === 'RETRIEVE') {
         // Maybe draw something in mouth if carrying?
         // The duck entity handles its own drawing in CARRIED state, but visual "carry" logic is abstract
      }

      ctx.shadowBlur = 0;
      ctx.restore();
  };

  const drawCage = (ctx: CanvasRenderingContext2D, c: CageEntity) => {
      ctx.fillStyle = '#374151'; 
      ctx.fillRect(c.x, c.y, c.width, c.height);
      ctx.fillStyle = '#9ca3af'; 
      for(let i=5; i < c.width; i+=10) {
          ctx.fillRect(c.x + i, c.y, 2, c.height);
      }
      ctx.fillRect(c.x, c.y, c.width, 4);
      ctx.fillRect(c.x, c.y + c.height - 4, c.width, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(c.x + c.width/2 - 4, c.y + c.height/2 - 6, 8, 12);
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
        ctx.fillStyle = state.current.level === 3 ? '#57534e' : '#1e293b'; 
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = state.current.level === 3 ? '#84cc16' : '#15803d'; 
        ctx.fillRect(p.x, p.y, p.width, 5);
    });
  };

  const drawDoor = (ctx: CanvasRenderingContext2D, d: DoorEntity) => {
      ctx.fillStyle = d.isOpen ? '#22d3ee' : '#374151'; 
      ctx.fillRect(d.x, d.y, d.width, d.height);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 4;
      ctx.strokeRect(d.x, d.y, d.width, d.height);
      if (d.isOpen) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(d.x + 5, d.y + 5, d.width - 10, d.height - 10);
      } else {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(d.x + 15, d.y + 25, 10, 14);
      }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const time = engine.current.frameCount;
    
    if (state.current.level === 3) {
        // SUN
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#fde047';
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(800, 80, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // CLOUDS
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        engine.current.clouds.forEach(c => {
            const x = (c.x + time * c.speed) % (CANVAS_WIDTH + 100) - 50;
            ctx.beginPath();
            ctx.arc(x, c.y, 30 * c.scale, 0, Math.PI*2);
            ctx.arc(x + 25 * c.scale, c.y - 10 * c.scale, 35 * c.scale, 0, Math.PI*2);
            ctx.arc(x + 50 * c.scale, c.y, 30 * c.scale, 0, Math.PI*2);
            ctx.fill();
        });
    } else {
        // MOON
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fef3c7';
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(800, 80, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // FIREFLIES
        ctx.fillStyle = 'rgba(253, 224, 71, 0.6)'; 
        engine.current.fireflies.forEach(f => {
            const y = f.y + Math.sin((time * f.speed) + f.offset) * 20;
            const x = (f.x + time * 0.2) % CANVAS_WIDTH;
            ctx.globalAlpha = 0.5 + Math.sin(time * 0.1 + f.offset) * 0.5;
            ctx.beginPath();
            ctx.arc(x, y, f.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    // Distant Mountains
    ctx.fillStyle = state.current.level === 3 ? '#166534' : '#1e293b'; // Greenish in day
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT - 32);
    for (let i = 0; i <= CANVAS_WIDTH; i += 100) {
      ctx.lineTo(i, CANVAS_HEIGHT - 120 - Math.sin(i * 0.01 + state.current.level) * 60);
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 32);
    ctx.fill();
    
    // Trees
    ctx.fillStyle = state.current.level === 3 ? '#14532d' : '#020617';
    for (let i = 40; i < CANVAS_WIDTH; i += 180) {
      const sway = Math.sin(time * 0.02 + i) * 5;
      ctx.fillRect(i, CANVAS_HEIGHT - 180, 24, 150);
      ctx.beginPath();
      ctx.arc(i + 12 + sway, CANVAS_HEIGHT - 180, 40 + (state.current.level * 5), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: PlayerEntity) => {
    ctx.save();
    ctx.translate(p.x + p.width/2, p.y + p.height/2);
    if (Math.abs(p.aimAngle) > Math.PI / 2) ctx.scale(-1, 1);

    const walkCycle = Math.sin(engine.current.frameCount * 0.3) * 6;
    ctx.fillStyle = '#57534e';
    if (Math.abs(p.vx) > 0.1 && p.grounded) {
      ctx.fillRect(-6 + walkCycle, 10, 6, 14);
      ctx.fillRect(0 - walkCycle, 10, 6, 14);
    } else {
      ctx.fillRect(-6, 10, 6, 14);
      ctx.fillRect(0, 10, 6, 14);
    }

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-8, -10, 16, 20);
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(-6, -22, 12, 12);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-7, -24, 14, 4);

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
      const facingRight = e.vx > 0;
      if (!facingRight) ctx.scale(-1, 1);

      ctx.fillStyle = e.color; 
      const cycle = Math.sin(engine.current.frameCount * 0.2) * 5;
      
      ctx.fillRect(-e.width/2, -e.height/2 + 5, e.width, e.height - 10);
      ctx.fillRect(e.width/2 - 10, -e.height/2 - 5, 20, 20);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.width/2 + 8, -e.height/2, 6, 8);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.width/2, -e.height/2 - 5);
      ctx.lineTo(e.width/2 + 5, -e.height/2 - 15);
      ctx.lineTo(e.width/2 + 10, -e.height/2 - 5);
      ctx.fill();

      const legH = 12;
      ctx.fillStyle = e.color;
      if (Math.abs(e.vx) > 0.1) {
          ctx.fillRect(-e.width/2, e.height/2 - 5, 6, legH + cycle); 
          ctx.fillRect(-e.width/2 + 10, e.height/2 - 5, 6, legH - cycle); 
          ctx.fillRect(e.width/2 - 10, e.height/2 - 5, 6, legH + cycle); 
          ctx.fillRect(e.width/2 - 20, e.height/2 - 5, 6, legH - cycle); 
      } else {
          ctx.fillRect(-e.width/2, e.height/2 - 5, 6, legH);
          ctx.fillRect(-e.width/2 + 10, e.height/2 - 5, 6, legH);
          ctx.fillRect(e.width/2 - 10, e.height/2 - 5, 6, legH);
          ctx.fillRect(e.width/2 - 20, e.height/2 - 5, 6, legH);
      }

      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(-e.width/2, -e.height/2 + 10);
      ctx.lineTo(-e.width/2 - 10, -e.height/2 + 5 + cycle/2);
      ctx.lineTo(-e.width/2, -e.height/2 + 15);
      ctx.fill();

      if (e.stunTimer > 0) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          for(let i = -e.width/2; i < e.width/2; i+=5) {
              ctx.beginPath(); ctx.moveTo(i, -e.height/2); ctx.lineTo(i+5, e.height/2); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-e.width/2, i/2); ctx.lineTo(e.width/2, i/2+5); ctx.stroke();
          }
      }

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
      const alpha = Math.max(0, p.lifeTime / 40);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1.0;
    });
  };

  const drawMobileControls = (ctx: CanvasRenderingContext2D) => {
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

    const player = entities.current.player;
    if (player) {
        ctx.save();
        ctx.translate(TRAP_BTN_X, TRAP_BTN_Y);
        const cooldown = player.trapCooldown;
        const ready = cooldown <= 0;
        ctx.beginPath();
        ctx.arc(0, 0, TRAP_BTN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ready ? 'rgba(34, 211, 238, 0.5)' : 'rgba(100, 100, 100, 0.5)'; 
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(15, 0); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.lineTo(-15, 0); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-5, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(5, 10); ctx.stroke();
        if (!ready) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, TRAP_BTN_RADIUS, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * (cooldown / TRAP_COOLDOWN_FRAMES))); ctx.fill();
        } else {
             ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('TRAP', 0, 25);
        }
        ctx.restore();

        if (entities.current.dog) {
            ctx.save();
            ctx.translate(WHISTLE_BTN_X, WHISTLE_BTN_Y);
            const isAggro = entities.current.dog.aggroTimer > 0;
            ctx.beginPath(); ctx.arc(0, 0, WHISTLE_BTN_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = isAggro ? 'rgba(251, 191, 36, 0.8)' : 'rgba(251, 191, 36, 0.5)'; 
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.fillRect(-5, -5, 15, 8); ctx.fillRect(-12, -2, 8, 4); ctx.beginPath(); ctx.arc(5, -10, 6, 0, Math.PI*2); ctx.fill(); 
            if (isAggro) {
                const total = 300; 
                const current = entities.current.dog.aggroTimer;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, WHISTLE_BTN_RADIUS, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * ((total - current) / total))); ctx.fill();
            } else {
                ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('CALL', 0, 20); ctx.fillText('[R]', 0, 30);
            }
            ctx.restore();
        }
    }
  };

  const drawUI = (ctx: CanvasRenderingContext2D) => {
    if (state.current.status === GameStatus.MENU) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; 
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.textAlign = 'center';
      ctx.font = '72px "Press Start 2P"'; ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText('WOOLF', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 80);
      ctx.fillStyle = '#9ca3af'; ctx.fillText('WOOLF', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 80);
      ctx.strokeText('HUNTERS', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      ctx.fillStyle = '#ef4444'; ctx.fillText('HUNTERS', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      ctx.font = '14px "Press Start 2P"'; ctx.fillStyle = '#cbd5e1'; ctx.fillText('criado por corvobranco360🐺', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 60);
      if (Math.floor(engine.current.frameCount / 30) % 2 === 0) {
          ctx.font = '24px "Press Start 2P"'; ctx.fillStyle = '#fbbf24'; ctx.fillText('PRESS SPACE OR TAP', CANVAS_WIDTH/2, CANVAS_HEIGHT - 80);
      }
      return;
    }

    // DRAW HINT/OBJECTIVE AT TOP
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#fbbf24'; 
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    let hint = "";
    switch(state.current.level) {
        case 1: hint = "OBJETIVO: ELIMINE OS LOBOS PARA ABRIR A PORTA"; break;
        case 2: hint = "DICA: DESTRUA A JAULA PARA LIBERTAR O CÃO"; break;
        case 3: hint = "ZONA SEGURA: DESCANSE OU TREINE SUA MIRA"; break;
        case 4: hint = "CUIDADO: INIMIGOS DE ELITE NAS ÁRVORES!"; break;
        case 5: hint = "DESAFIO FINAL: SOBREVIVA À HORDA!"; break;
        default: hint = "SOBREVIVA!";
    }
    ctx.fillText(hint, CANVAS_WIDTH / 2, 20);
    ctx.restore();

    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '16px "Press Start 2P"';
    ctx.fillText(`HP: ${Math.floor(entities.current.player?.health || 0)}`, 20, 40);
    
    const needed = state.current.enemiesRequired - state.current.enemiesKilled;
    ctx.textAlign = 'center';
    
    if (state.current.level === 3) {
         ctx.fillStyle = '#fde047';
         ctx.fillText(`RELAX AT THE LAKE`, CANVAS_WIDTH/2, 40);
    } else {
        if (needed > 0) {
            ctx.fillStyle = '#fca5a5';
            ctx.fillText(`HUNT ${needed} WOLVES`, CANVAS_WIDTH/2, 40);
        } else {
            ctx.fillStyle = '#22d3ee';
            ctx.fillText(`FIND THE DOOR!`, CANVAS_WIDTH/2, 40);
        }
    }

    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    ctx.fillText(`LEVEL ${state.current.level}/5`, CANVAS_WIDTH - 20, 40);
    const cd = entities.current.player?.trapCooldown || 0;
    if (cd > 0) {
      ctx.fillStyle = '#ef4444'; ctx.fillText(`NET: ${(cd/60).toFixed(1)}s`, CANVAS_WIDTH - 20, 70);
    } else {
      ctx.fillStyle = '#22c55e'; ctx.fillText('NET READY [T]', CANVAS_WIDTH - 20, 70);
    }

    if (state.current.status === GameStatus.GAME_OVER || state.current.status === GameStatus.VICTORY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = state.current.status === GameStatus.VICTORY ? '#fbbf24' : '#ef4444';
      ctx.font = '48px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText(state.current.status === GameStatus.VICTORY ? 'ESCAPED!' : 'DEVOURED', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);
      ctx.fillStyle = '#fff'; ctx.font = '16px "Press Start 2P"';
      ctx.fillText('TAP OR SPACE TO RESTART', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 90);
    }
  };

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

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      if (state.current.status !== GameStatus.PLAYING) { initGame(); return; }
      Array.from(e.changedTouches).forEach(t => {
        const x = (t.clientX - r.left) * (CANVAS_WIDTH / r.width);
        const y = (t.clientY - r.top) * (CANVAS_HEIGHT / r.height);
        const distTrap = Math.sqrt(Math.pow(x - TRAP_BTN_X, 2) + Math.pow(y - TRAP_BTN_Y, 2));
        if (distTrap < TRAP_BTN_RADIUS) { input.current.touch.trapBtnPressed = true; return; }
        const distWhistle = Math.sqrt(Math.pow(x - WHISTLE_BTN_X, 2) + Math.pow(y - WHISTLE_BTN_Y, 2));
        if (distWhistle < WHISTLE_BTN_RADIUS) { input.current.touch.whistleBtnPressed = true; return; }
        if (x < CANVAS_WIDTH / 2) { input.current.touch.leftStick = { active: true, x: 0, y: 0, originX: x, originY: y }; } 
        else { input.current.touch.rightStick = { active: true, x: 0, y: 0, originX: x, originY: y }; }
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