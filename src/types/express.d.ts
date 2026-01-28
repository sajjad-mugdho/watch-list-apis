// src/types/express.d.ts
import {AuthObject} from "@clerk/express";
import {UserClaims, ValidatedUserClaims} from "../validation/schemas";

export {};

declare global {
    namespace Express {
        /** User object we attach to req (from Clerk claims) */
        interface RequestUser extends ValidatedUserClaims{
            userId: string;
        }

        interface RequestMetrics {
            startTime: number;
            requestId: string;
        }

        interface Request {
            metrics?: RequestMetrics;
            user?: RequestUser; // now available on req.user everywhere
            auth?: AuthObject | undefined;
        }
    }
}
