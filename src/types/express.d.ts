// src/types/express.d.ts
import {AuthObject} from "@clerk/express";
import {RequestUser as CoreRequestUser} from "./auth";

export {};

declare global {
    namespace Express {
        interface RequestUser extends CoreRequestUser {}

        interface RequestMetrics {
            startTime: number;
            requestId: string;
        }

        interface Request {
            metrics?: RequestMetrics;
            user?: any; // Supports both CoreRequestUser (from Clerk) and IUser (from DB)
            auth?: AuthObject | undefined;
            dialistUserId?: string;
        }
    }
}



