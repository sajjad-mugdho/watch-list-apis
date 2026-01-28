/**
 * Request Validation Middleware
 *
 * CONSOLIDATED validation module for the entire API.
 * Use this module for all validation needs.
 *
 * Features:
 * - Validates req.body, req.query, and req.params against Zod schemas
 * - Merges validated data back to request (with coercion applied)
 * - Provides detailed error responses
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodSchema } from 'zod';
import logger from '../utils/logger';

/**
 * Request validation middleware using Zod
 *
 * Validates req.body, req.query, and req.params against a Zod schema.
 * Responds with 400 Bad Request if validation fails.
 *
 * @param schema - Zod schema to validate against
 */
export const validateRequest = (schema: AnyZodObject | ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await (schema as AnyZodObject).parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Merge validated/coerced data back to request
      if (validatedData.body) req.body = validatedData.body;
      if (validatedData.query) req.query = validatedData.query;
      if (validatedData.params) req.params = validatedData.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
        });

        res.status(400).json({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              field: err.path[err.path.length - 1],
              message: err.message,
            })),
          },
        });
        return;
      }

      next(error);
    }
  };
};

/**
 * Validate only body
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Validate only query params
 */
export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
};
