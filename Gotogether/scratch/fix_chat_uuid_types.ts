import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTypes() {
  console.log('Fixing UUID types in chat tables to support both CUID and UUID...');

  const commands = [
    // 1. Drop policies depending on user_id and sender_id
    `DROP POLICY IF EXISTS "conv_participants_select" ON public.conversation_participants;`,
    `DROP POLICY IF EXISTS "conv_participants_insert" ON public.conversation_participants;`,
    `DROP POLICY IF EXISTS "messages_select_participant_or_admin" ON public.messages;`,
    `DROP POLICY IF EXISTS "messages_insert_active_participant" ON public.messages;`,

    // 2. Drop foreign key constraints on user_id and sender_id
    `ALTER TABLE public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_user_id_fkey;`,
    `ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;`,
    `ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_ride_id_fkey;`,

    // 3. Change column types to TEXT
    `ALTER TABLE public.conversation_participants ALTER COLUMN user_id TYPE TEXT;`,
    `ALTER TABLE public.messages ALTER COLUMN sender_id TYPE TEXT;`,
    `ALTER TABLE public.conversations ALTER COLUMN ride_id TYPE TEXT;`,

    // 4. Update helper function is_conversation_participant
    `CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = conv_id
          AND cp.user_id = (select auth.uid())::text
      );
    $$;`,

    // 5. Recreate policies with text-compatible auth.uid()
    `CREATE POLICY "conv_participants_select"
    ON public.conversation_participants FOR SELECT
    TO authenticated
    USING (
      conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = (select auth.uid())::text
      )
      OR public.is_admin_or_moderator()
    );`,

    `CREATE POLICY "conv_participants_insert"
    ON public.conversation_participants FOR INSERT
    TO authenticated
    WITH CHECK (
      user_id = (select auth.uid())::text
      OR public.is_conversation_participant(conversation_id)
      OR public.is_admin_or_moderator()
    );`,

    `CREATE POLICY "messages_select_participant_or_admin"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = (select auth.uid())::text
      )
      OR public.is_admin_or_moderator()
    );`,

    `CREATE POLICY "messages_insert_active_participant"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
      sender_id = (select auth.uid())::text
      AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = (select auth.uid())::text
      )
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.is_closed = false
      )
    );`,
  ];

  for (const cmd of commands) {
    await prisma.$executeRawUnsafe(cmd);
  }

  console.log('✅ Successfully updated conversation_participants and messages to support CUID and UUID!');
}

fixTypes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
