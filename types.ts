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
  DUCK, // New
  MEAT  // New
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

export interface DuckEntity extends Entity {
  type: EntityType.DUCK;
  state: 'SWIM' | 'FLY' | 'FALL' | 'DEAD' | 'CARRIED';
  facingRight: boolean;
  flightTimer: number; // How long to stay in air
  flapTimer: number;   // Animation
  color: string;
}

export interface PlayerEntity extends Entity {
  type: EntityType.PLAYER;
  facingRight: boolean;
  health: number;
  maxHealth: number;
  aimAngle: number; // In radians
  isAiming: boolean; // True when holding touch
  trapCooldown: number;
  animTimer: number;
}

export interface DogEntity extends Entity {
  type: EntityType.DOG;
  facingRight: boolean;
  state: 'IDLE' | 'FOLLOW' | 'CHASE' | 'ATTACK' | 'BRAWL' | 'RETRIEVE'; // Added RETRIEVE
  target: Entity | null;
  barkTimer: number;
  tongueOut: boolean;
  animTimer: number;
  aggroTimer: number; 
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
  waveProgress: number;
  maxWaves: number;
  enemiesKilled: number;
  enemiesRequired: number;
}