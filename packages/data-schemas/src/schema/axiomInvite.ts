import { Schema } from 'mongoose';
import type { IAxiomInvite } from '~/types';

const axiomInviteSchema: Schema<IAxiomInvite> = new Schema<IAxiomInvite>(
  {
    sourceHashDigest: { type: String, required: true, unique: true },
    codeDigest: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['issued', 'claimed', 'redeemed'],
      default: 'issued',
      required: true,
    },
    claimDigest: { type: String },
    claimedUntil: { type: Date },
    registrationStartedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    redeemedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    redeemedAt: { type: Date },
    tenantId: { type: String },
  },
  { timestamps: true },
);

axiomInviteSchema.index({ codeDigest: 1, status: 1, expiresAt: 1 });
axiomInviteSchema.index({ claimDigest: 1, status: 1, claimedUntil: 1 });

export default axiomInviteSchema;
