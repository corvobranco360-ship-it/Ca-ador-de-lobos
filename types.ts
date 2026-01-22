export type Vector2 = { x: number; y: number };

export enum EntityType {
  PLAYER,
  ENEMY,
  ARROW,
  TRAP,
  PARTICLE,
  PLATFORM,
  DOOR,
  FLOATING_TEXT,
  DOG,
  CAGE,
  DUCK,
  MEAT,
  POWERUP,
  CROW,
  BUSH,   // New
  RABBIT  // New
}

export enum EnemyTier {
  SMALL = 'SMALL',   
  MEDIUM = 'MEDIUM', 
  LARGE = 'LARGE'    
}

export interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  grounded: boolean;
  markedForDeletion: boolean;
}

export interface PlatformEntity extends Entity {
  type: EntityType.PLATFORM;
}

export interface DoorEntity extends Entity {
  type: EntityType.DOOR;
  isOpen: boolean;
}

export interface CageEntity extends Entity {
  type: EntityType.CAGE;
  health: number;
}

export interface MeatEntity extends Entity {
  type: EntityType.MEAT;
  value: number;
}

export interface PowerUpEntity extends Entity {
  type: EntityType.POWERUP;
  kind: 'TRIPLE_SHOT';
  timer: number;
}

export interface FloatingTextEntity extends Entity {
  type: EntityType.FLOATING_TEXT;
  text: string;
  color: string;
  lifeTime: number;
  opacity: number;
}

export interface DuckEntity extends Entity {
  type: EntityType.DUCK;
  state: 'SWIM' | 'FLY' | 'FALL' | 'DEAD' | 'CARRIED';
  facingRight: boolean;
  flightTimer: number;
  flapTimer: number;
  color: string;
}

// Crow Entity Interface
export interface CrowEntity extends Entity {
  type: EntityType.CROW;
  state: 'FLY' | 'DIVE' | 'RETURN';
  startX: number;
  startY: number;
  diveTimer: number;
  facingRight: boolean;
  health: number;
  color: string;
}

// RPG Hunting Entities
export interface BushEntity extends Entity {
  type: EntityType.BUSH;
  hasRabbit: boolean;
  shakeTimer: number;
}

export interface RabbitEntity extends Entity {
  type: EntityType.RABBIT;
  state: 'HIDDEN' | 'IDLE' | 'FLEE' | 'CAUGHT' | 'DEAD';
  isHidden: boolean;
  facingRight: boolean;
  fleeTimer: number;
  health: number;
}

export interface PlayerEntity extends Entity {
  type: EntityType.PLAYER;
  facingRight: boolean;
  health: number;
  maxHealth: number;
  aimAngle: number;
  isAiming: boolean;
  trapCooldown: number;
  animTimer: number;
  powerUpTimer: number;
  // Dash mechanics
  dashTimer: number;       // Cooldown
  isDashing: boolean;      // Currently dashing?
  invulnerableTimer: number; // I-frames
}

export interface DogEntity extends Entity {
  type: EntityType.DOG;
  facingRight: boolean;
  // Added CARRY state for retrieving rabbits
  state: 'IDLE' | 'FOLLOW' | 'CHASE' | 'ATTACK' | 'BRAWL' | 'RETRIEVE' | 'HEAL' | 'POINTING' | 'FLUSH' | 'CARRY'; 
  target: Entity | null;
  barkTimer: number;
  tongueOut: boolean;
  animTimer: number;
  aggroTimer: number;
  healTimer: number; 
}

export interface EnemyEntity extends Entity {
  type: EntityType.ENEMY;
  tier: EnemyTier;
  health: number;
  maxHealth: number;
  stunTimer: number; 
  color: string;
}

export interface ArrowEntity extends Entity {
  type: EntityType.ARROW;
  rotation: number;
  lifeTime: number;
}

export interface TrapEntity extends Entity {
  type: EntityType.TRAP; 
  rotation: number;
  state: 'FLYING' | 'STUCK'; 
}

export interface ParticleEntity extends Entity {
  type: EntityType.PARTICLE;
  color: string;
  lifeTime: number;
  size: number;
}

export enum GameStatus {
  MENU,
  PLAYING,
  LEVEL_TRANSITION,
  GAME_OVER,
  VICTORY
}

export interface GameState {
  status: GameStatus;
  level: number;
  score: number;
  lives: number; 
  waveProgress: number;
  maxWaves: number;
  enemiesKilled: number;
  enemiesRequired: number;
  isRaining: boolean; 
  lightningTimer: number;
  floodLevel: number; // New property for Level 4
}