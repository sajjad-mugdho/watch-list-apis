import {NextFunction, Request, Response} from "express";
import {ApiResponse} from "../types";
import {DatabaseError, NotFoundError} from "../utils/errors";
import {GetUserPublicProfileInput} from "../validation/schemas";
import {User} from "../models/User";

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get public marketplace user profile
 * GET /api/v1/marketplace/users/:id
 */
export const marketplace_user_public_get = async (
    req: Request<GetUserPublicProfileInput['params'], {}, {}, {}>,
    res: Response<ApiResponse<{ _id: string; name: string | null; location: string; avatar?: string; }>>,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const profile = await User.getMarketplaceProfile(id);
        if (!profile) throw new NotFoundError("Could not find user");

        const response: ApiResponse<{ _id: string; name: string | null; location: string; avatar?: string; }> = {
            data: profile as any,
            requestId: req.headers['x-request-id'] as string,
        };

        res.json(response);
    } catch (error) {
        if (error instanceof NotFoundError) {
            next(error);
        } else {
            next(new DatabaseError('Failed to fetch user', error));
        }
    }
};

/**
 * Get public networks user profile
 * GET /api/v1/networks/users/:id
 */
export const networks_user_public_get = async (
    req: Request<GetUserPublicProfileInput['params'], {}, {}, {}>,
    res: Response<ApiResponse<{ _id: string; name: string | null; location: string; avatar?: string; }>>,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const profile = await User.getNetworksProfile(id);

        if (!profile) throw new NotFoundError("Could not find user");

        const response: ApiResponse<{ _id: string; name: string | null; location: string; avatar?: string; }> = {
            data: profile as any,
            requestId: req.headers['x-request-id'] as string,
        };

        res.json(response);
    } catch (error) {
        if (error instanceof NotFoundError) {
            next(error);
        } else {
            next(new DatabaseError('Failed to fetch user', error));
        }
    }
};

