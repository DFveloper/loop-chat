import { createAxiomService } from './service';
import type { AxiomMethods } from './service';
import type { IAxiomInvite } from '@librechat/data-schemas';
import { Types } from 'mongoose';

jest.mock('@librechat/data-schemas', () => ({ getTenantId: jest.fn(() => undefined) }));

const originalEnv = process.env;

function createMethods(): AxiomMethods {
  const invites = new Map<string, IAxiomInvite>();
  return {
    createAxiomInvite: jest.fn(async (input) => {
      if (
        [...invites.values()].some((invite) => invite.sourceHashDigest === input.sourceHashDigest)
      ) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const invite = { ...input, sourceHashDigest: input.sourceHashDigest } as IAxiomInvite;
      invites.set(input.sourceHashDigest, invite);
      return invite;
    }),
    findAxiomInviteBySourceDigest: jest.fn(
      async (sourceHashDigest) => invites.get(sourceHashDigest) ?? null,
    ),
    claimAxiomInvite: jest.fn(async () => null),
    findValidAxiomClaim: jest.fn(async () => null),
    lockAxiomRegistration: jest.fn(async () => null),
    releaseAxiomRegistration: jest.fn(async () => undefined),
    redeemAxiomInvite: jest.fn(async () => null),
    addMemberToLocalGroup: jest.fn(async () => ({})),
    removeMemberFromLocalGroup: jest.fn(async () => undefined),
  };
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    AXIOM_KEYGEN_SECRET: 'keygen-secret',
    AXIOM_KEY_PEPPER: 'pepper',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('AXIOM service issuance and redemption', () => {
  test('issues a correctly formatted key and stores only HMAC digests', async () => {
    const methods = createMethods();
    const result = await createAxiomService(methods).issue(
      'keygen-secret',
      'messenger-author-hash',
    );

    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ redeemUrl: 'https://chat.Aeonthic.com/axiom' });
    expect('key' in result.body && result.body.key).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    expect(methods.createAxiomInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceHashDigest: expect.not.stringContaining('messenger-author-hash'),
        codeDigest: expect.not.stringMatching(/^[0-9a-f]{4}-[0-9a-f]{4}$/),
      }),
    );
  });

  test('rejects duplicate issuance without revealing the previous key', async () => {
    const service = createAxiomService(createMethods());
    expect((await service.issue('keygen-secret', 'same-source')).status).toBe(201);
    const duplicate = await service.issue('keygen-secret', 'same-source');
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).not.toHaveProperty('key');
  });

  test('rejects malformed and unknown redemption keys generically', async () => {
    const service = createAxiomService(createMethods());
    expect((await service.redeem('not-a-key')).status).toBe(400);
    expect((await service.redeem('abcd-1234')).status).toBe(400);
  });

  test('returns a raw claim only out-of-band after an atomic claim', async () => {
    const methods = createMethods();
    methods.claimAxiomInvite = jest.fn(async (input) => ({ ...input }) as IAxiomInvite);
    const result = await createAxiomService(methods).redeem('ABCD-1234');

    expect(result.status).toBe(200);
    expect(result.claimToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.body).toEqual({ valid: true });
    expect(result.body).not.toHaveProperty('claimToken');
    const claimInput = jest.mocked(methods.claimAxiomInvite).mock.calls[0][0];
    expect(claimInput.codeDigest).not.toContain('abcd-1234');
    expect(claimInput.claimDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(claimInput.claimDigest).not.toBe(result.claimToken);
  });

  test('requires a valid claim before registration can start', async () => {
    const service = createAxiomService(createMethods());
    expect(await service.beginRegistration()).toBeNull();
    expect(await service.beginRegistration('unknown-claim')).toBeNull();
  });

  test('adds group membership before redeeming and compensates failures', async () => {
    const methods = createMethods();
    const invite = {
      _id: new Types.ObjectId(),
      status: 'claimed',
      claimDigest: 'stored-digest',
    } as IAxiomInvite;
    methods.lockAxiomRegistration = jest.fn(async () => invite);
    methods.redeemAxiomInvite = jest.fn(async () => invite);
    const service = createAxiomService(methods);
    const registration = await service.beginRegistration('claim-token');
    const user = { _id: new Types.ObjectId() };

    await registration?.onCreated(user);
    expect(methods.addMemberToLocalGroup).toHaveBeenCalledWith(
      'AXIOM',
      String(user._id),
      undefined,
    );
    expect(methods.redeemAxiomInvite).toHaveBeenCalledWith(
      invite._id,
      expect.any(String),
      user._id,
      expect.any(Date),
    );

    await registration?.onRollback(user);
    expect(methods.removeMemberFromLocalGroup).toHaveBeenCalledWith(
      'AXIOM',
      String(user._id),
      undefined,
    );
    expect(methods.releaseAxiomRegistration).toHaveBeenCalled();
  });
});
