// utils/pagination.ts
export const buildPaginationOptions = (limit?: number, offset?: number) => {
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 50);
    const skip = Math.max(offset ?? 0, 0);
    return { limit: safeLimit, skip };
};
