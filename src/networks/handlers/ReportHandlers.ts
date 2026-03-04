// src/networks/handlers/ReportHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import { MissingUserContextError } from "../../utils/errors";
import { Report } from "../../models/Report";
import { createReportSchema } from "../../validation/schemas";

/**
 * Report a user, listing, group, or message
 * POST /api/v1/networks/reports
 */
export const networks_report_create = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const reporterId = (req as any).user.dialist_id;
    const { target_id, target_type, reason, description } = req.body;

    const report = await Report.create({
      reporter_id: reporterId,
      target_id,
      target_type,
      reason,
      description,
    });

    res.status(201).json({
      data: report,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};
