CREATE TABLE IF NOT EXISTS "public"."event_rsvps" (
    "event_id" "uuid" NOT NULL REFERENCES "public"."events"("id") ON DELETE CASCADE,
    "student_id" "uuid" NOT NULL REFERENCES "public"."students"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("event_id", "student_id")
);

CREATE INDEX "idx_event_rsvps_student" ON "public"."event_rsvps" USING "btree" ("student_id");

ALTER TABLE "public"."event_rsvps" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view RSVPs" ON "public"."event_rsvps"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Users can create their own RSVPs" ON "public"."event_rsvps"
    FOR INSERT TO "authenticated" WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can delete their own RSVPs" ON "public"."event_rsvps"
    FOR DELETE TO "authenticated" USING (auth.uid() = student_id);
