/**
 * Eteria: Shadow War - Command Types and Factories
 * 
 * All player and AI actions are represented as typed commands.
 * Commands are processed by the simulation in a deterministic order.
 */

import type {
  GameCommand,
  CommandBase,
  SelectCommand,
  MoveCommand,
  AttackCommand,
  AttackMoveCommand,
  StopCommand,
  BuildCommand,
  TrainCommand,
  SetRallyPointCommand,
  GatherCommand,
  CancelCommand,
  PauseCommand,
  EntityId,
  FactionId,
  Vec2,
  Vec3,
  BuildingType,
  UnitType,
} from './types';

// ============================================================================
// COMMAND FACTORY
// ============================================================================

let commandTick = 0;

/**
 * Set the current tick for command creation
 */
export function setCommandTick(tick: number): void {
  commandTick = tick;
}

/**
 * Get current command tick
 */
export function getCommandTick(): number {
  return commandTick;
}

/**
 * Base command creator with common fields
 */
function createCommandBase(factionId: FactionId): CommandBase {
  return {
    type: '',  // Override in specific factory
    factionId,
    tick: commandTick,
  };
}

// ============================================================================
// SPECIFIC COMMAND FACTORIES
// ============================================================================

/** Create SELECT command */
export function selectCommand(
  factionId: FactionId,
  entityIds: EntityId[],
  addToSelection: boolean = false
): SelectCommand {
  return {
    ...createCommandBase(factionId),
    type: 'SELECT',
    entityIds: [...entityIds],
    addToSelection,
  };
}

/** Create MOVE command */
export function moveCommand(
  factionId: FactionId,
  entityIds: EntityId[],
  targetPosition: Vec3
): MoveCommand {
  return {
    ...createCommandBase(factionId),
    type: 'MOVE',
    entityIds: [...entityIds],
    targetPosition: { ...targetPosition },
  };
}

/** Create ATTACK command */
export function attackCommand(
  factionId: FactionId,
  entityIds: EntityId[],
  targetEntityId: EntityId
): AttackCommand {
  return {
    ...createCommandBase(factionId),
    type: 'ATTACK',
    entityIds: [...entityIds],
    targetEntityId,
  };
}

/** Create ATTACK_MOVE command */
export function attackMoveCommand(
  factionId: FactionId,
  entityIds: EntityId[],
  targetPosition: Vec3
): AttackMoveCommand {
  return {
    ...createCommandBase(factionId),
    type: 'ATTACK_MOVE',
    entityIds: [...entityIds],
    targetPosition: { ...targetPosition },
  };
}

/** Create STOP command */
export function stopCommand(
  factionId: FactionId,
  entityIds: EntityId[]
): StopCommand {
  return {
    ...createCommandBase(factionId),
    type: 'STOP',
    entityIds: [...entityIds],
  };
}

/** Create BUILD command */
export function buildCommand(
  factionId: FactionId,
  workerId: EntityId,
  buildingType: BuildingType,
  position: Vec2
): BuildCommand {
  return {
    ...createCommandBase(factionId),
    type: 'BUILD',
    workerId,
    buildingType,
    position: { ...position },
  };
}

/** Create TRAIN command */
export function trainCommand(
  factionId: FactionId,
  buildingId: EntityId,
  unitType: UnitType
): TrainCommand {
  return {
    ...createCommandBase(factionId),
    type: 'TRAIN',
    buildingId,
    unitType,
  };
}

/** Create SET_RALLY_POINT command */
export function setRallyPointCommand(
  factionId: FactionId,
  buildingId: EntityId,
  position: Vec2
): SetRallyPointCommand {
  return {
    ...createCommandBase(factionId),
    type: 'SET_RALLY_POINT',
    buildingId,
    position: { ...position },
  };
}

/** Create GATHER command */
export function gatherCommand(
  factionId: FactionId,
  workerIds: EntityId[],
  resourceNodeId: EntityId
): GatherCommand {
  return {
    ...createCommandBase(factionId),
    type: 'GATHER',
    workerIds: [...workerIds],
    resourceNodeId,
  };
}

/** Create CANCEL command */
export function cancelCommand(
  factionId: FactionId,
  buildingId: EntityId,
  queueIndex: number
): CancelCommand {
  return {
    ...createCommandBase(factionId),
    type: 'CANCEL',
    buildingId,
    queueIndex,
  };
}

/** Create PAUSE command */
export function pauseCommand(
  factionId: FactionId,
  pause: boolean
): PauseCommand {
  return {
    ...createCommandBase(factionId),
    type: 'PAUSE',
    pause,
  };
}

// ============================================================================
// COMMAND VALIDATION
// ============================================================================

/**
 * Type guard to check if a command is valid
 */
export function isValidCommand(cmd: unknown): cmd is GameCommand {
  if (typeof cmd !== 'object' || cmd === null) return false;
  
  const c = cmd as Partial<GameCommand>;
  
  return (
    typeof c.type === 'string' &&
    typeof c.factionId === 'string' &&
    typeof c.tick === 'number'
  );
}

/**
 * Get command type for logging/debugging
 */
export function getCommandType(cmd: GameCommand): string {
  return cmd.type;
}

/**
 * Get affected entity IDs from a command
 */
export function getAffectedEntityIds(cmd: GameCommand): EntityId[] {
  switch (cmd.type) {
    case 'SELECT':
      return cmd.entityIds;
    case 'MOVE':
      return cmd.entityIds;
    case 'ATTACK':
      return cmd.entityIds;
    case 'ATTACK_MOVE':
      return cmd.entityIds;
    case 'STOP':
      return cmd.entityIds;
    case 'BUILD':
      return [cmd.workerId];
    case 'TRAIN':
      return [cmd.buildingId];
    case 'SET_RALLY_POINT':
      return [cmd.buildingId];
    case 'GATHER':
      return cmd.workerIds;
    case 'CANCEL':
      return [cmd.buildingId];
    case 'PAUSE':
      return [];
    default:
      return [];
  }
}
