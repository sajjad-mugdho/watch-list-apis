/**
 * Base Repository
 * 
 * Generic CRUD operations for MongoDB with Mongoose.
 * All domain repositories extend this base class.
 * 
 * Benefits:
 * - Consistent query patterns
 * - Lean queries for performance
 * - Type-safe operations
 */

import { Model, Document, FilterQuery, UpdateQuery } from 'mongoose';
import logger from '../../utils/logger';

export interface QueryOptions {
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
  populate?: string | string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export abstract class BaseRepository<T extends Document> {
  protected readonly modelName: string;

  constructor(protected model: Model<T>) {
    this.modelName = model.modelName;
  }

  /**
   * Find a document by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      return await (this.model as any).findById(id).lean() as any as T | null;
    } catch (error) {
      logger.error(`${this.modelName}.findById failed`, { id, error });
      throw error;
    }
  }

  /**
   * Find a single document matching filter
   */
  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    try {
      return await (this.model as any).findOne(filter).lean() as any as T | null;
    } catch (error) {
      logger.error(`${this.modelName}.findOne failed`, { filter, error });
      throw error;
    }
  }

  /**
   * Find multiple documents with options
   */
  async find(filter: FilterQuery<T>, options?: QueryOptions): Promise<T[]> {
    try {
      let query = (this.model as any).find(filter);

      if (options?.sort) {
        query = query.sort(options.sort);
      }
      if (options?.skip) {
        query = query.skip(options.skip);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.populate) {
        const populateFields = Array.isArray(options.populate) 
          ? options.populate 
          : [options.populate];
        for (const field of populateFields) {
          query = query.populate(field);
        }
      }

      return await query.lean() as any as T[];
    } catch (error) {
      logger.error(`${this.modelName}.find failed`, { filter, options, error });
      throw error;
    }
  }

  /**
   * Find with pagination
   */
  async findPaginated(
    filter: FilterQuery<T>,
    options: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> } = {}
  ): Promise<PaginatedResult<T>> {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    try {
      const [data, total] = await Promise.all([
        this.find(filter, { 
          limit, 
          skip: offset, 
          sort: options.sort || { createdAt: -1 } 
        }),
        this.count(filter),
      ]);

      return {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      };
    } catch (error) {
      logger.error(`${this.modelName}.findPaginated failed`, { filter, options, error });
      throw error;
    }
  }

  /**
   * Create a new document
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const doc = await (this.model as any).create(data);
      logger.debug(`${this.modelName} created`, { id: doc._id });
      return (doc.toObject ? doc.toObject() : doc) as T;
    } catch (error) {
      logger.error(`${this.modelName}.create failed`, { error });
      throw error;
    }
  }

  /**
   * Create multiple documents
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    try {
      const docs = await (this.model as any).insertMany(data);
      logger.debug(`${this.modelName} created ${docs.length} documents`);
      return docs.map((doc: any) => (doc.toObject ? doc.toObject() : doc) as T);
    } catch (error) {
      logger.error(`${this.modelName}.createMany failed`, { error });
      throw error;
    }
  }

  /**
   * Update a document by ID
   */
  async updateById(id: string, update: UpdateQuery<T>): Promise<T | null> {
    try {
      const doc = await (this.model as any).findByIdAndUpdate(
        id,
        update,
        { new: true, runValidators: true }
      ).lean() as any as T | null;
      
      if (doc) {
        logger.debug(`${this.modelName} updated`, { id });
      }
      return doc;
    } catch (error) {
      logger.error(`${this.modelName}.updateById failed`, { id, error });
      throw error;
    }
  }

  /**
   * Update a single document matching filter
   */
  async updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T | null> {
    try {
      const doc = await (this.model as any).findOneAndUpdate(
        filter,
        update,
        { new: true, runValidators: true }
      ).lean() as any as T | null;
      
      return doc;
    } catch (error) {
      logger.error(`${this.modelName}.updateOne failed`, { filter, error });
      throw error;
    }
  }

  /**
   * Update multiple documents
   */
  async updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<number> {
    try {
      const result = await (this.model as any).updateMany(filter, update);
      logger.debug(`${this.modelName} updated ${result.modifiedCount} documents`);
      return result.modifiedCount;
    } catch (error) {
      logger.error(`${this.modelName}.updateMany failed`, { filter, error });
      throw error;
    }
  }

  /**
   * Delete a document by ID
   */
  async deleteById(id: string): Promise<boolean> {
    try {
      const result = await (this.model as any).deleteOne({ _id: id } as FilterQuery<T>);
      const deleted = result.deletedCount > 0;
      if (deleted) {
        logger.debug(`${this.modelName} deleted`, { id });
      }
      return deleted;
    } catch (error) {
      logger.error(`${this.modelName}.deleteById failed`, { id, error });
      throw error;
    }
  }

  /**
   * Delete multiple documents
   */
  async deleteMany(filter: FilterQuery<T>): Promise<number> {
    try {
      const result = await (this.model as any).deleteMany(filter);
      logger.debug(`${this.modelName} deleted ${result.deletedCount} documents`);
      return result.deletedCount;
    } catch (error) {
      logger.error(`${this.modelName}.deleteMany failed`, { filter, error });
      throw error;
    }
  }

  /**
   * Count documents matching filter
   */
  async count(filter: FilterQuery<T> = {}): Promise<number> {
    try {
      return await (this.model as any).countDocuments(filter);
    } catch (error) {
      logger.error(`${this.modelName}.count failed`, { filter, error });
      throw error;
    }
  }

  /**
   * Check if a document exists
   */
  async exists(filter: FilterQuery<T>): Promise<boolean> {
    try {
      const doc = await (this.model as any).exists(filter);
      return doc !== null;
    } catch (error) {
      logger.error(`${this.modelName}.exists failed`, { filter, error });
      throw error;
    }
  }

  /**
   * Find or create - atomic upsert
   */
  async findOrCreate(
    filter: FilterQuery<T>,
    createData: Partial<T>
  ): Promise<{ doc: T; created: boolean }> {
    try {
      // Try to find existing
      let doc = await this.findOne(filter);
      if (doc) {
        return { doc, created: false };
      }

      // Create new
      doc = await this.create({ ...filter, ...createData } as Partial<T>);
      return { doc, created: true };
    } catch (error) {
      // Handle race condition - document may have been created
      if ((error as any).code === 11000) {
        const doc = await this.findOne(filter);
        if (doc) {
          return { doc, created: false };
        }
      }
      throw error;
    }
  }
}
