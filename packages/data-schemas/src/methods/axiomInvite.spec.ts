import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { IAxiomInvite } from '~/types';
import axiomInviteSchema from '~/schema/axiomInvite';
import { createAxiomInviteMethods } from './axiomInvite';

let mongoServer: MongoMemoryServer;
let AxiomInvite: mongoose.Model<IAxiomInvite>;
let methods: ReturnType<typeof createAxiomInviteMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  AxiomInvite =
    mongoose.models.AxiomInvite || mongoose.model<IAxiomInvite>('AxiomInvite', axiomInviteSchema);
  methods = createAxiomInviteMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await AxiomInvite.syncIndexes();
});

describe('AXIOM invitation methods', () => {
  test('keeps source and code digests unique without storing plaintext values', async () => {
    const invite = await methods.createAxiomInvite({
      sourceHashDigest: 'source-digest',
      codeDigest: 'code-digest',
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(invite.toObject()).not.toHaveProperty('sourceHash');
    expect(invite.toObject()).not.toHaveProperty('code');
    await expect(
      methods.createAxiomInvite({
        sourceHashDigest: 'source-digest',
        codeDigest: 'another-code-digest',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  test('allows only one concurrent claimant', async () => {
    const now = new Date();
    await methods.createAxiomInvite({
      sourceHashDigest: 'source',
      codeDigest: 'code',
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const results = await Promise.all([
      methods.claimAxiomInvite({
        codeDigest: 'code',
        claimDigest: 'claim-one',
        claimedUntil: new Date(now.getTime() + 30_000),
        now,
      }),
      methods.claimAxiomInvite({
        codeDigest: 'code',
        claimDigest: 'claim-two',
        claimedUntil: new Date(now.getTime() + 30_000),
        now,
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test('rejects expired codes and permits reclaim after claim expiry', async () => {
    const now = new Date();
    await methods.createAxiomInvite({
      sourceHashDigest: 'expired-source',
      codeDigest: 'expired-code',
      expiresAt: new Date(now.getTime() - 1),
    });
    expect(
      await methods.claimAxiomInvite({
        codeDigest: 'expired-code',
        claimDigest: 'claim',
        claimedUntil: new Date(now.getTime() + 30_000),
        now,
      }),
    ).toBeNull();

    await AxiomInvite.create({
      sourceHashDigest: 'reclaim-source',
      codeDigest: 'reclaim-code',
      status: 'claimed',
      claimDigest: 'old-claim',
      claimedUntil: new Date(now.getTime() - 1),
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const reclaimed = await methods.claimAxiomInvite({
      codeDigest: 'reclaim-code',
      claimDigest: 'new-claim',
      claimedUntil: new Date(now.getTime() + 30_000),
      now,
    });
    expect(reclaimed?.claimDigest).toBe('new-claim');
  });

  test('locks registration once and permanently redeems the invitation', async () => {
    const now = new Date();
    const invite = await AxiomInvite.create({
      sourceHashDigest: 'source',
      codeDigest: 'code',
      status: 'claimed',
      claimDigest: 'claim',
      claimedUntil: new Date(now.getTime() + 30_000),
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const [first, second] = await Promise.all([
      methods.lockAxiomRegistration('claim', now),
      methods.lockAxiomRegistration('claim', now),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const userId = new mongoose.Types.ObjectId();
    const redeemed = await methods.redeemAxiomInvite(invite._id, 'claim', userId, now);
    expect(redeemed?.status).toBe('redeemed');
    expect(String(redeemed?.redeemedUserId)).toBe(String(userId));
    expect(await methods.findValidAxiomClaim('claim', now)).toBeNull();
  });
});
