import { offerService, SendOfferParams, CounterOfferParams } from '../../services/offer/OfferService';
import mongoose from 'mongoose';

/**
 * Marketplace Offer Service (Façade)
 * 
 * Locked to 'marketplace' platform.
 */
export class MarketplaceOfferService {
  /**
   * Send a marketplace offer
   */
  async sendOffer(params: Omit<SendOfferParams, 'platform'>, session?: mongoose.ClientSession) {
    return offerService.sendOffer({
      ...params,
      platform: 'marketplace'
    }, session);
  }

  /**
   * Counter a marketplace offer
   */
  async counterOffer(params: CounterOfferParams) {
    return offerService.counterOffer(params); // platform is on Offer doc
  }

  /**
   * Accept a marketplace offer
   */
  async acceptOffer(offerId: string, acceptorId: string) {
    return offerService.acceptOffer(offerId, acceptorId, 'marketplace');
  }

  /**
   * Decline a marketplace offer
   */
  async declineOffer(offerId: string, declinedById: string) {
    return offerService.declineOffer(offerId, declinedById);
  }

  /**
   * Get expired marketplace offers
   */
  async getExpiredOffers() {
    return offerService.getExpiredOffers('marketplace');
  }

  /**
   * Expire a marketplace offer
   */
  async expireOffer(offerId: string) {
    return offerService.expireOffer(offerId);
  }
}

export const marketplaceOfferService = new MarketplaceOfferService();
