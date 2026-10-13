BEGIN;

CREATE OR REPLACE FUNCTION public.record_support_first_reply(
  p_ticket_id UUID, p_message TEXT, p_handoff BOOLEAN, p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_message_id UUID;
BEGIN
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_ticket.status = 'closed' OR v_ticket.source = 'whatsapp'
    OR v_ticket.assigned_admin_id IS NOT NULL THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ticket_messages WHERE ticket_id = p_ticket_id AND sender_type IN ('admin', 'assistant')
  ) THEN RETURN NULL; END IF;
  IF length(btrim(p_message)) = 0 OR length(p_message) > 4000 THEN RAISE EXCEPTION 'invalid_support_reply'; END IF;

  INSERT INTO public.ticket_messages (ticket_id, sender_type, sender_email, external_message_id, message, metadata)
  VALUES (p_ticket_id, 'assistant', 'support@kobara.app', 'support-assistant:first:' || p_ticket_id::TEXT,
    p_message, COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object('assistant', true, 'handoff', p_handoff))
  ON CONFLICT (external_message_id) WHERE external_message_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_message_id;
  IF v_message_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.support_tickets SET status = CASE WHEN p_handoff THEN 'pending_admin' ELSE 'pending_merchant' END,
    updated_at = NOW() WHERE id = p_ticket_id;
  RETURN v_message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_support_first_reply(UUID, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_support_first_reply(UUID, TEXT, BOOLEAN, JSONB) TO service_role;
CREATE OR REPLACE FUNCTION public.pending_support_first_reply_ids()
RETURNS TABLE(id UUID) LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT t.id FROM public.support_tickets t
  WHERE t.status IN ('open', 'pending_admin') AND t.source IS DISTINCT FROM 'whatsapp'
    AND t.assigned_admin_id IS NULL
    AND EXISTS (SELECT 1 FROM public.ticket_messages m WHERE m.ticket_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM public.ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type IN ('admin', 'assistant'))
  ORDER BY t.created_at LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.pending_support_first_reply_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_support_first_reply_ids() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
