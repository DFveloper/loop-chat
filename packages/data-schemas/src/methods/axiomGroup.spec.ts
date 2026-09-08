import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { IGroup } from '~/types';
import groupSchema from '~/schema/group';
import { createUserGroupMethods } from './userGroup';

jest.mock('~/config/winston', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

let mongoServer: MongoMemoryServer;
let Group: mongoose.Model<IGroup>;
let methods: ReturnType<typeof createUserGroupMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  Group = mongoose.models.Group || mongoose.model<IGroup>('Group', groupSchema);
  methods = createUserGroupMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Group.syncIndexes();
});

test('AXIOM local group membership is idempotent and stores string member IDs', async () => {
  const userId = String(new mongoose.Types.ObjectId());
  await methods.addMemberToLocalGroup('AXIOM', userId);
  await methods.addMemberToLocalGroup('AXIOM', userId);

  const groups = await Group.find({ name: 'AXIOM', source: 'local' }).lean<IGroup[]>();
  expect(groups).toHaveLength(1);
  expect(groups[0].memberIds).toEqual([userId]);
  expect(groups[0].managedBy).toBe('axiom');
});

test('concurrent AXIOM signups converge on one managed local group', async () => {
  const userIds = [String(new mongoose.Types.ObjectId()), String(new mongoose.Types.ObjectId())];
  await Promise.all(userIds.map((userId) => methods.addMemberToLocalGroup('AXIOM', userId)));

  const groups = await Group.find({ managedBy: 'axiom' }).lean<IGroup[]>();
  expect(groups).toHaveLength(1);
  expect(groups[0].memberIds).toEqual(expect.arrayContaining(userIds));
});
