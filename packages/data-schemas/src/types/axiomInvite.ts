import type { Document, Types } from 'mongoose';

export type AxiomInviteStatus = 'issued' | 'claimed' | 'redeemed';

export interface IAxiomInvite extends Document {
  _id: Types.ObjectId;
  sourceHashDigest: string;
  codeDigest: string;
  status: AxiomInviteStatus;
  claimDigest?: string;
  claimedUntil?: Date;
  registrationStartedAt?: Date;
  expiresAt: Date;
  redeemedUserId?: Types.ObjectId;
  redeemedAt?: Date;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
