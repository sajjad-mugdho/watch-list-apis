/**
 * Validation Middleware Re-exports
 *
 * DEPRECATED: This file exists for backward compatibility.
 * Use 'src/middleware/validation' directly in new code.
 *
 * All validation logic is now consolidated in src/middleware/validation.ts
 */

// Re-export everything from consolidated module
export { validateRequest, validateBody, validateQuery } from '../middleware/validation';
