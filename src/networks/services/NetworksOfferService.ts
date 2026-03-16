import { offerService, SendOfferParams, CounterOfferParams } from '../../services/offer/OfferService';
import mongoose from 'mongoose';

/**
 * Networks Offer Service (Façade)
 * 
 * Locked to 'networks' platform.
 */
export class NetworksOfferService {
  /**
   * Send a networks offer
   */
  async sendOffer(params: Omit<SendOfferParams, 'platform'>, session?: mongoose.ClientSession) {
    return offerService.sendOffer({
      ...params,
      platform: 'networks'
    }, session);
  }

  /**
   * Counter a networks offer
   */
  async counterOffer(params: CounterOfferParams) {
    return offerService.counterOffer(params); // platform is on Offer doc
  }

  /**
   * Accept a networks offer
   */
  async acceptOffer(offerId: string, acceptorId: string) {
    return offerService.acceptOffer(offerId, acceptorId, 'networks');
  }

  /**
   * Decline a networks offer
   */
  async declineOffer(offerId: string, declinedById: string) {
    return offerService.declineOffer(offerId, declinedById);
  }

  /**
   * Get expired networks offers
   */
  async getExpiredOffers() {
    return offerService.getExpiredOffers('networks');
  }

  /**
   * Expire a networks offer
   */
  async expireOffer(offerId: string) {
    return offerService.expireOffer(offerId);
  }
}

export const networksOfferService = new NetworksOfferService();
