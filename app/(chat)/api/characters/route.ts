import { auth } from '@/app/(auth)/auth';
import {
  cloneCharacter,
  createCharacter,
  deleteCharacter,
  listAllCharacters,
  seedDefaultCharacterIfEmpty,
  updateCharacter,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // seed default Eryn card if table empty (owned by current user)
    await seedDefaultCharacterIfEmpty({ userId: session.user.id });
    const rows = await listAllCharacters();
    return Response.json(rows, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      'bad_request:api',
      'Failed to fetch characters',
    ).toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { id, name, description, characterCard } = (await request.json()) as {
      id: string;
      name?: string;
      description?: string;
      characterCard?: string;
    };

    if (!id) {
      return new ChatSDKError('bad_request:api', 'Missing id').toResponse();
    }

    const updated = await updateCharacter({
      id,
      userId: session.user.id,
      name,
      description,
      characterCard,
    });

    if (!updated) {
      return new ChatSDKError(
        'not_found:api',
        'Character not found',
      ).toResponse();
    }

    return Response.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      'bad_request:api',
      'Failed to update character',
    ).toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const body = (await request.json()) as
      | {
          action: 'clone';
          sourceCharacterId: string;
          overrides?: {
            name?: string;
            description?: string;
            characterCard?: string;
          };
        }
      | {
          action: 'create';
          name: string;
          description: string;
          characterCard: string;
        };

    if (body.action === 'clone') {
      if (!body.sourceCharacterId) {
        return new ChatSDKError(
          'bad_request:api',
          'Missing sourceCharacterId',
        ).toResponse();
      }
      const created = await cloneCharacter({
        sourceCharacterId: body.sourceCharacterId,
        userId: session.user.id,
        overrides: body.overrides,
      });
      return Response.json(created, { status: 201 });
    }

    if (body.action === 'create') {
      const { name, description, characterCard } = body;
      if (!name || !description || !characterCard) {
        return new ChatSDKError(
          'bad_request:api',
          'Missing fields',
        ).toResponse();
      }
      const created = await createCharacter({
        userId: session.user.id,
        name,
        description,
        characterCard,
      });
      return Response.json(created, { status: 201 });
    }

    return new ChatSDKError('bad_request:api', 'Invalid action').toResponse();
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      'bad_request:api',
      'Failed to create/clone character',
    ).toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new ChatSDKError('bad_request:api', 'Missing id').toResponse();
    }

    const deleted = await deleteCharacter({ id, userId: session.user.id });
    if (!deleted) {
      return new ChatSDKError(
        'not_found:api',
        'Character not found',
      ).toResponse();
    }

    return Response.json(deleted, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      'bad_request:api',
      'Failed to delete character',
    ).toResponse();
  }
}
