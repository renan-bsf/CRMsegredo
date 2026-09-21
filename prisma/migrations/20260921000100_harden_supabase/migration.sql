-- Impede que a função de automação de RLS seja exposta pela Data API.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
