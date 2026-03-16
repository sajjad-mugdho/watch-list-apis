/**
 * Connection Repository
 *
 * Data access layer for connection relationships.
 */

import { Types, FilterQuery } from "mongoose";
import {
  BaseRepository,
  PaginatedResult,
} from "../shared/repositories/base/BaseRepository";
import { Connection, IConnection } from "../networks/models/Connection";

class ConnectionRepository extends BaseRepository<IConnection> {
  constructor() {
    super(Connection as any);
  }

  async findByUsers(
    requesterId: string,
    targetId: string,
  ): Promise<IConnection | null> {
    return this.findOne({
      follower_id: new Types.ObjectId(requesterId),
      following_id: new Types.ObjectId(targetId),
    });
  }

  async getIncomingAccepted(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedResult<IConnection>> {
    const filter: FilterQuery<IConnection> = {
      following_id: new Types.ObjectId(userId),
      status: "accepted",
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [data, total] = await Promise.all([
      this.find(filter, {
        sort: { accepted_at: -1 },
        skip: offset,
        limit,
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
  }

  async getOutgoingAccepted(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedResult<IConnection>> {
    const filter: FilterQuery<IConnection> = {
      follower_id: new Types.ObjectId(userId),
      status: "accepted",
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [data, total] = await Promise.all([
      this.find(filter, {
        sort: { accepted_at: -1 },
        skip: offset,
        limit,
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
  }

  async countIncomingAccepted(userId: string): Promise<number> {
    return this.count({
      following_id: new Types.ObjectId(userId),
      status: "accepted",
    });
  }

  async countOutgoingAccepted(userId: string): Promise<number> {
    return this.count({
      follower_id: new Types.ObjectId(userId),
      status: "accepted",
    });
  }

  async getIncomingPending(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedResult<IConnection>> {
    const filter: FilterQuery<IConnection> = {
      following_id: new Types.ObjectId(userId),
      status: "pending",
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [data, total] = await Promise.all([
      this.find(filter, {
        sort: { createdAt: -1 },
        skip: offset,
        limit,
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
  }

  async getOutgoingPending(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedResult<IConnection>> {
    const filter: FilterQuery<IConnection> = {
      follower_id: new Types.ObjectId(userId),
      status: "pending",
    };

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [data, total] = await Promise.all([
      this.find(filter, {
        sort: { createdAt: -1 },
        skip: offset,
        limit,
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
  }

  async countIncomingPending(userId: string): Promise<number> {
    return this.count({
      following_id: new Types.ObjectId(userId),
      status: "pending",
    });
  }

  async countOutgoingPending(userId: string): Promise<number> {
    return this.count({
      follower_id: new Types.ObjectId(userId),
      status: "pending",
    });
  }

  async findMissingConnections(options?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<any>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const aggregation = [
      {
        $lookup: {
          from: "users",
          localField: "follower_id",
          foreignField: "_id",
          as: "follower",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "following_id",
          foreignField: "_id",
          as: "following",
        },
      },
      {
        $match: {
          $or: [{ follower: { $size: 0 } }, { following: { $size: 0 } }],
        },
      },
      { $sort: { createdAt: -1 as any } },
    ] as any[];

    const countAgg = [
      ...aggregation.slice(0, -1),
      { $count: "total" },
    ] as any[];

    const [dataResult, countResult] = await Promise.all([
      this.model.aggregate(aggregation).skip(offset).limit(limit),
      this.model.aggregate(countAgg),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      data: dataResult,
      total,
      limit,
      offset,
      hasMore: offset + dataResult.length < total,
    };
  }
}

export const connectionRepository = new ConnectionRepository();
export { ConnectionRepository };
