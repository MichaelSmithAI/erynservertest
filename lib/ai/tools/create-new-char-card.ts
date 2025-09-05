import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  cloneCharacter,
  getCharacterById,
  getCharacterByIdPublic,
  listAllCharacters,
  listCharactersByUserId,
  updateCharacterCard,
} from '@/lib/db/queries';
import type { ChatMessage } from '@/lib/types';

interface CharactersToolProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const charactersTool = ({ session, dataStream }: CharactersToolProps) =>
  tool({
    description:
      'Interact with the Characters table. Supports: list all for user, read one, clone from existing, update characterCard for a character you own.',
    inputSchema: z.discriminatedUnion('action', [
      z.object({ action: z.literal('list') }),
      z.object({ action: z.literal('listAll') }),
      z.object({
        action: z.literal('read'),
        id: z.string().describe('Character id to read'),
      }),
      z.object({
        action: z.literal('readPublic'),
        id: z.string().describe('Character id to read (any owner)'),
      }),
      z.object({
        action: z.literal('clone'),
        sourceCharacterId: z
          .string()
          .describe('Character id to clone from (can be any owner)'),
        overrides: z
          .object({
            name: z.string().optional(),
            description: z.string().optional(),
            characterCard: z.string().optional(),
          })
          .optional(),
      }),
      z.object({
        action: z.literal('updateCard'),
        id: z.string().describe('Character id to update'),
        characterCard: z.string().describe('New characterCard text'),
      }),
    ]),
    execute: async (input) => {
      if (!session.user?.id) {
        return { error: 'Unauthorized: missing user in session' };
      }

      const userId = session.user.id;

      switch (input.action) {
        case 'list': {
          const rows = await listCharactersByUserId({ userId });
          return rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }));
        }
        case 'listAll': {
          const rows = await listAllCharacters();
          return rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            userId: row.userId,
          }));
        }
        case 'read': {
          const character = await getCharacterById({ id: input.id, userId });
          if (!character) return { error: 'Character not found' };
          return character;
        }
        case 'readPublic': {
          const character = await getCharacterByIdPublic({ id: input.id });
          if (!character) return { error: 'Character not found' };
          return character;
        }
        case 'clone': {
          dataStream.write({ type: 'data-clear', data: null, transient: true });
          const created = await cloneCharacter({
            sourceCharacterId: input.sourceCharacterId,
            userId,
            overrides: input.overrides,
          });
          dataStream.write({
            type: 'data-finish',
            data: null,
            transient: true,
          });
          return created;
        }
        case 'updateCard': {
          dataStream.write({ type: 'data-clear', data: null, transient: true });
          const updated = await updateCharacterCard({
            id: input.id,
            userId,
            characterCard: input.characterCard,
          });
          dataStream.write({
            type: 'data-finish',
            data: null,
            transient: true,
          });
          if (!updated)
            return { error: 'Character not found or not owned by user' };
          return updated;
        }
      }
    },
  });
