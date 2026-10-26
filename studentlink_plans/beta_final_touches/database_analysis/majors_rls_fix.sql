-- Allow authenticated users to insert new majors
CREATE POLICY "Authenticated users can add majors" 
    ON "public"."majors" 
    FOR INSERT 
    TO "authenticated" 
    WITH CHECK (true);

-- Ensure authenticated users have INSERT permission on the table
GRANT INSERT ON TABLE "public"."majors" TO "authenticated";
