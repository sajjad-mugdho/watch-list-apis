/**
 * Shared utility for extracting watch specification data
 * Removes code duplication between marketplace and networks listing handlers
 */
import logger from "./logger";

export interface WatchSpecData {
  watch_id: any;
  brand: string;
  model: string;
  reference: string;
  category?: string;
  diameter: string;
  color?: string;
  bezel: string;
  materials: string;
  bracelet: string;
}

/**
 * Extract watch specification data from a Watch document
 * @param data - Watch document (can be any)
 * @returns WatchSpecData or null if required fields are missing
 */
export function ExtractWatchSpecData(data: any): WatchSpecData | null {
  try {
    if (
      !data ||
      !data.brand ||
      !data._id ||
      !data.model ||
      !data.reference ||
      !data.diameter
    ) {
      return null;
    }

    return {
      watch_id: data._id,
      brand: data.brand,
      model: data.model,
      reference: data.reference,
      category: data.category,
      diameter: data.diameter,
      color: data.color,
      bezel: data.bezel,
      materials: data.materials,
      bracelet: data.bracelet,
    };
  } catch (e) {
    logger.error("Error in ExtractWatchSpecData", { error: e });
    return null;
  }
}
