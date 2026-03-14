-- Create a highly privileged function to let a user delete their own account safely
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid;
BEGIN
  -- Grab the ID of the user calling this function
  uid := auth.uid();

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated / Unauthorized';
  END IF;

  -- Delete from auth.users. Since this runs with SECURITY DEFINER, it has privileges to delete from the auth schema.
  -- Any tables in public schema with ON DELETE CASCADE referencing auth.users(id) will automatically be cleaned up.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;
