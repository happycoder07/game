/**
 * Centralized move validation helpers used by the engine and tests.
 * Prefer calling GameEngine commands (which validate); these are for
 * pre-flight checks in UI / AI without mutating state.
 */
export { validateBid, BidValidationError } from '../rules/Bidding.js';
export { legalCards } from '../rules/TrickResolver.js';
export { canTransition, IllegalPhaseTransitionError } from '../fsm/GamePhase.js';
