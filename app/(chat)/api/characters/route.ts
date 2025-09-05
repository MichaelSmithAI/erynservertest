import { auth } from '@/app/(auth)/auth';
import {
  listAllCharacters,
  seedDefaultCharacterIfEmpty,
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
