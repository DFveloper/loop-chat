import { Model } from 'mongoose';
import type * as t from '~/types';
import axiomInviteSchema from '~/schema/axiomInvite';

export function createAxiomInviteModel(mongoose: typeof import('mongoose')): Model<t.IAxiomInvite> {
  return (
    mongoose.models.AxiomInvite || mongoose.model<t.IAxiomInvite>('AxiomInvite', axiomInviteSchema)
  );
}
