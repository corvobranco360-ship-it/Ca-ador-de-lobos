export type Vector2 = { x: number; y: number };

export enum EntityType {
  PLAYER,
  ENEMY,
  ARROW,
  TRAP, // Represents the Net Projectile
  PARTICLE,
  PLATFORM,
  DOOR,
  FLOATING_TEXT
}

export enum EnemyTier {
  SMALL = 'SMALL',   // Wolf Pup / Fast
  MEDIUM = 'MEDIUM', // Regular Wolf
  LARGE = 'LARGE'    // Alpha Wolf
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

export interface EnemyEntity extends Entity {
  type: EntityType.ENEMY;
  tier: EnemyTier;
  health: number;
  maxHealth: number;
  stunTimer: number; // Used for Net capture
  color: string;
}

export interface ArrowEntity extends Entity {
  type: EntityType.ARROW;
  rotation: number;
  lifeTime: number;
}

export interface TrapEntity extends Entity {
  type: EntityType.TRAP; // The Net Projectile
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