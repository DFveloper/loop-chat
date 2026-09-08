import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getTenantId } from '@librechat/data-schemas';
import type { IAxiomInvite } from '@librechat/data-schemas';
import type { Types } from 'mongoose';
import { shouldUseSecureCookie } from '../oauth/csrf';

const CODE_PATTERN: RegExp = /^[0-9a-f]{4}-[0-9a-f]{4}$/;
const SOURCE_HASH_PATTERN: RegExp = /^[\x21-\x7e]{1,256}$/;
const CLAIM_COOKIE: string = 'axiom_claim';
const DEFAULT_CODE_TTL_SECONDS: number = 86400;
const DEFAULT_CLAIM_TTL_SECONDS: number = 1200;
const REDEEM_URL: string = 'https://chat.Aeonthic.com/axiom';

export interface AxiomResult {
  status: number;
  body: { message: string } | { key: string; redeemUrl: string } | { valid: boolean };
  claimToken?: string;
}

export interface AxiomMethods {
  createAxiomInvite(input: {
    sourceHashDigest: string;
    codeDigest: string;
    expiresAt: Date;
  }): Promise<IAxiomInvite>;
  findAxiomInviteBySourceDigest(sourceHashDigest: string): Promise<IAxiomInvite | null>;
  claimAxiomInvite(input: {
    codeDigest: string;
    claimDigest: string;
    claimedUntil: Date;
    now: Date;
    tenantId?: string;
  }): Promise<IAxiomInvite | null>;
  findValidAxiomClaim(claimDigest: string, now: Date): Promise<IAxiomInvite | null>;
  lockAxiomRegistration(claimDigest: string, now: Date): Promise<IAxiomInvite | null>;
  releaseAxiomRegistration(inviteId: Types.ObjectId, claimDigest: string): Promise<void>;
  redeemAxiomInvite(
    inviteId: Types.ObjectId,
    claimDigest: string,
    userId: Types.ObjectId,
    now: Date,
  ): Promise<IAxiomInvite | null>;
  addMemberToLocalGroup(name: string, memberId: string, tenantId?: string): Promise<object>;
  removeMemberFromLocalGroup(name: string, memberId: string, tenantId?: string): Promise<void>;
}

export interface AxiomRegistration {
  invite: IAxiomInvite;
  claimDigest: string;
  onCreated(user: { _id: Types.ObjectId }): Promise<void>;
  onRollback(user: { _id: Types.ObjectId }): Promise<void>;
  release(): Promise<void>;
}

function seconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function digest(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

function secretsEqual(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function isDuplicateKey(error: object): boolean {
  return error !== null && 'code' in error && error.code === 11000;
}

export function getAxiomCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: seconds(process.env.AXIOM_CLAIM_TTL_SECONDS, DEFAULT_CLAIM_TTL_SECONDS) * 1000,
  };
}

export function createAxiomService(methods: AxiomMethods): {
  issue: (providedSecret: string, sourceHash: string) => Promise<AxiomResult>;
  redeem: (key: string) => Promise<AxiomResult>;
  session: (claimToken?: string) => Promise<AxiomResult>;
  beginRegistration: (claimToken?: string) => Promise<AxiomRegistration | null>;
} {
  const pepper = () => process.env.AXIOM_KEY_PEPPER ?? '';

  async function issue(providedSecret: string, sourceHash: string): Promise<AxiomResult> {
    const expectedSecret = process.env.AXIOM_KEYGEN_SECRET ?? '';
    if (!expectedSecret || !pepper() || !secretsEqual(providedSecret, expectedSecret)) {
      return { status: 401, body: { message: 'Unauthorized' } };
    }
    if (!SOURCE_HASH_PATTERN.test(sourceHash)) {
      return { status: 400, body: { message: 'Invalid sourceHash' } };
    }

    const sourceHashDigest = digest(sourceHash, pepper());
    const expiresAt = new Date(
      Date.now() + seconds(process.env.AXIOM_CODE_TTL_SECONDS, DEFAULT_CODE_TTL_SECONDS) * 1000,
    );

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const hex = randomBytes(4).toString('hex');
      const key = `${hex.slice(0, 4)}-${hex.slice(4)}`;
      try {
        await methods.createAxiomInvite({
          sourceHashDigest,
          codeDigest: digest(key, pepper()),
          expiresAt,
        });
        return { status: 201, body: { key, redeemUrl: REDEEM_URL } };
      } catch (error) {
        if (!isDuplicateKey(error as object)) {
          throw error;
        }
        const duplicateSource = await methods.findAxiomInviteBySourceDigest(sourceHashDigest);
        if (duplicateSource) {
          return { status: 409, body: { message: 'A key has already been issued' } };
        }
      }
    }
    return { status: 503, body: { message: 'Unable to issue a key' } };
  }

  async function redeem(key: string): Promise<AxiomResult> {
    const normalizedKey = typeof key === 'string' ? key.toLowerCase() : '';
    if (!pepper() || !CODE_PATTERN.test(normalizedKey)) {
      return { status: 400, body: { message: 'Invalid or expired AXIOM key' } };
    }

    const claimToken = randomBytes(32).toString('hex');
    const now = new Date();
    const invite = await methods.claimAxiomInvite({
      codeDigest: digest(normalizedKey, pepper()),
      claimDigest: digest(claimToken, pepper()),
      claimedUntil: new Date(
        now.getTime() +
          seconds(process.env.AXIOM_CLAIM_TTL_SECONDS, DEFAULT_CLAIM_TTL_SECONDS) * 1000,
      ),
      now,
      tenantId: getTenantId(),
    });
    if (!invite) {
      return { status: 400, body: { message: 'Invalid or expired AXIOM key' } };
    }
    return { status: 200, body: { valid: true }, claimToken };
  }

  async function session(claimToken?: string): Promise<AxiomResult> {
    if (!claimToken || !pepper()) {
      return { status: 401, body: { valid: false } };
    }
    const invite = await methods.findValidAxiomClaim(digest(claimToken, pepper()), new Date());
    const currentTenantId = getTenantId();
    const valid = Boolean(invite && (invite.tenantId ?? '') === (currentTenantId ?? ''));
    return { status: valid ? 200 : 401, body: { valid } };
  }

  async function beginRegistration(claimToken?: string): Promise<AxiomRegistration | null> {
    if (!claimToken || !pepper()) {
      return null;
    }
    const claimDigest = digest(claimToken, pepper());
    const invite = await methods.lockAxiomRegistration(claimDigest, new Date());
    const tenantId = getTenantId();
    if (!invite || (invite.tenantId ?? '') !== (tenantId ?? '')) {
      if (invite) {
        await methods.releaseAxiomRegistration(invite._id, claimDigest);
      }
      return null;
    }

    const groupName = process.env.AXIOM_GROUP_NAME?.trim() || 'AXIOM';
    const release = () => methods.releaseAxiomRegistration(invite._id, claimDigest);
    return {
      invite,
      claimDigest,
      release,
      async onCreated(user): Promise<void> {
        const memberId = String(user._id);
        await methods.addMemberToLocalGroup(groupName, memberId, tenantId);
        const redeemed = await methods.redeemAxiomInvite(
          invite._id,
          claimDigest,
          user._id,
          new Date(),
        );
        if (!redeemed) {
          throw new Error('AXIOM invitation could not be redeemed');
        }
      },
      async onRollback(user): Promise<void> {
        await Promise.allSettled([
          methods.removeMemberFromLocalGroup(groupName, String(user._id), tenantId),
          release(),
        ]);
      },
    };
  }

  return { issue, redeem, session, beginRegistration };
}

export { CLAIM_COOKIE, CODE_PATTERN };
