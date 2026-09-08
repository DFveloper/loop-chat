import type { Model, Types } from 'mongoose';
import type { IAxiomInvite } from '~/types';

export interface CreateAxiomInviteInput {
  sourceHashDigest: string;
  codeDigest: string;
  expiresAt: Date;
}

export interface ClaimAxiomInviteInput {
  codeDigest: string;
  claimDigest: string;
  claimedUntil: Date;
  now: Date;
  tenantId?: string;
}

export function createAxiomInviteMethods(mongoose: typeof import('mongoose')): {
  createAxiomInvite: (input: CreateAxiomInviteInput) => Promise<IAxiomInvite>;
  findAxiomInviteBySourceDigest: (sourceHashDigest: string) => Promise<IAxiomInvite | null>;
  claimAxiomInvite: (input: ClaimAxiomInviteInput) => Promise<IAxiomInvite | null>;
  findValidAxiomClaim: (claimDigest: string, now: Date) => Promise<IAxiomInvite | null>;
  lockAxiomRegistration: (claimDigest: string, now: Date) => Promise<IAxiomInvite | null>;
  releaseAxiomRegistration: (inviteId: Types.ObjectId, claimDigest: string) => Promise<void>;
  redeemAxiomInvite: (
    inviteId: Types.ObjectId,
    claimDigest: string,
    userId: Types.ObjectId,
    now: Date,
  ) => Promise<IAxiomInvite | null>;
} {
  const AxiomInvite = mongoose.models.AxiomInvite as Model<IAxiomInvite>;

  async function createAxiomInvite(input: CreateAxiomInviteInput): Promise<IAxiomInvite> {
    return await AxiomInvite.create({ ...input, status: 'issued' });
  }

  async function findAxiomInviteBySourceDigest(
    sourceHashDigest: string,
  ): Promise<IAxiomInvite | null> {
    return await AxiomInvite.findOne({ sourceHashDigest }).lean<IAxiomInvite>();
  }

  async function claimAxiomInvite(input: ClaimAxiomInviteInput): Promise<IAxiomInvite | null> {
    const { codeDigest, claimDigest, claimedUntil, now, tenantId } = input;
    return await AxiomInvite.findOneAndUpdate(
      {
        codeDigest,
        expiresAt: { $gt: now },
        $or: [{ status: 'issued' }, { status: 'claimed', claimedUntil: { $lte: now } }],
      },
      {
        $set: {
          status: 'claimed',
          claimDigest,
          claimedUntil,
          ...(tenantId ? { tenantId } : {}),
        },
        $unset: { registrationStartedAt: 1 },
      },
      { new: true },
    ).lean<IAxiomInvite>();
  }

  async function findValidAxiomClaim(claimDigest: string, now: Date): Promise<IAxiomInvite | null> {
    return await AxiomInvite.findOne({
      claimDigest,
      status: 'claimed',
      claimedUntil: { $gt: now },
    }).lean<IAxiomInvite>();
  }

  async function lockAxiomRegistration(
    claimDigest: string,
    now: Date,
  ): Promise<IAxiomInvite | null> {
    return await AxiomInvite.findOneAndUpdate(
      {
        claimDigest,
        status: 'claimed',
        claimedUntil: { $gt: now },
        registrationStartedAt: { $exists: false },
      },
      { $set: { registrationStartedAt: now } },
      { new: true },
    ).lean<IAxiomInvite>();
  }

  async function releaseAxiomRegistration(
    inviteId: Types.ObjectId,
    claimDigest: string,
  ): Promise<void> {
    await AxiomInvite.updateOne(
      { _id: inviteId, claimDigest, status: 'claimed' },
      { $unset: { registrationStartedAt: 1 } },
    );
  }

  async function redeemAxiomInvite(
    inviteId: Types.ObjectId,
    claimDigest: string,
    userId: Types.ObjectId,
    now: Date,
  ): Promise<IAxiomInvite | null> {
    return await AxiomInvite.findOneAndUpdate(
      {
        _id: inviteId,
        claimDigest,
        status: 'claimed',
        registrationStartedAt: { $exists: true },
      },
      {
        $set: { status: 'redeemed', redeemedUserId: userId, redeemedAt: now },
        $unset: {
          claimDigest: 1,
          claimedUntil: 1,
          registrationStartedAt: 1,
        },
      },
      { new: true },
    ).lean<IAxiomInvite>();
  }

  return {
    createAxiomInvite,
    findAxiomInviteBySourceDigest,
    claimAxiomInvite,
    findValidAxiomClaim,
    lockAxiomRegistration,
    releaseAxiomRegistration,
    redeemAxiomInvite,
  };
}

export type AxiomInviteMethods = ReturnType<typeof createAxiomInviteMethods>;
