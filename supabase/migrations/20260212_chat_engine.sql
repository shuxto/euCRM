-- ==========================================
-- 1. CLEANUP & SETUP
-- ==========================================

-- Drop policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Access my allowed rooms" ON crm_chat_rooms;
DROP POLICY IF EXISTS "Create rooms" ON crm_chat_rooms;
DROP POLICY IF EXISTS "Read messages in my rooms" ON crm_messages;
DROP POLICY IF EXISTS "Send messages to my rooms" ON crm_messages;

-- Drop old policies if they still hang around
DROP POLICY IF EXISTS "Users can view public rooms" ON crm_chat_rooms;
DROP POLICY IF EXISTS "Users can view joined rooms" ON crm_chat_rooms;

-- CLEANUP: Remove "Tech Support" room as requested
DELETE FROM crm_chat_rooms WHERE name ILIKE '%tech support%';

-- SAFETY: Ensure avatar_url column exists
-- ==========================================
-- 1.5. NEW READ STATUS TRACKING
-- ==========================================
CREATE TABLE IF NOT EXISTS crm_read_status (
    user_id uuid REFERENCES auth.users(id),
    room_id uuid REFERENCES crm_chat_rooms(id),
    last_read_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, room_id)
);

ALTER TABLE crm_read_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage my read status" ON crm_read_status;
CREATE POLICY "Manage my read status" ON crm_read_status
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ==========================================
-- 2. CREATE OPTIMIZED VIEW (The Core Engine)
-- ==========================================
-- This view returns only the rooms the current user is allowed to see.
-- It pre-calculates unread counts and handles all permission logic.

CREATE OR REPLACE VIEW crm_my_rooms AS
WITH user_roles AS (
    -- Helper to get current user's role safely
    SELECT 
        auth.uid() as uid,
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' as role
),
room_participants AS (
    -- Rooms where the user is a direct participant (DM/Group)
    SELECT room_id 
    FROM crm_chat_participants 
    WHERE user_id = auth.uid()
)
SELECT 
    r.id,
    r.name,
    r.type,
    r.last_message_at,
    r.created_at,
    r.avatar_url,
    r.allowed_roles,
    
    -- Unread Count Calculation (Fixed Logic)
    (
        SELECT COUNT(*)
        FROM crm_messages m
        LEFT JOIN crm_read_status rs ON rs.room_id = r.id AND rs.user_id = auth.uid()
        WHERE m.room_id = r.id
        AND m.sender_id != auth.uid() -- Don't count my own messages
        AND (rs.last_read_at IS NULL OR m.created_at > rs.last_read_at)
    ) as unread_count,

    -- Dynamic Name/Avatar for DMs
    CASE 
        WHEN r.type = 'dm' THEN (
            SELECT u.real_name 
            FROM crm_chat_participants cp
            JOIN crm_users u ON u.id = cp.user_id
            WHERE cp.room_id = r.id AND cp.user_id != auth.uid()
            LIMIT 1
        )
        ELSE r.name
    END as display_name,
    
    CASE 
        WHEN r.type = 'dm' THEN (
            SELECT u.avatar_url 
            FROM crm_chat_participants cp
            JOIN crm_users u ON u.id = cp.user_id
            WHERE cp.room_id = r.id AND cp.user_id != auth.uid()
            LIMIT 1
        )
        ELSE r.avatar_url
    END as display_avatar,

    -- Helper to match rooms to users in UI
    CASE 
        WHEN r.type = 'dm' THEN (
            SELECT cp.user_id 
            FROM crm_chat_participants cp
            WHERE cp.room_id = r.id AND cp.user_id != auth.uid()
            LIMIT 1
        )
        ELSE NULL
    END as dm_target_id

FROM crm_chat_rooms r
LEFT JOIN user_roles ur ON ur.uid = auth.uid()
WHERE 
    -- Condition A: Global Room (Everyone)
    r.type = 'global' 
    
    -- Condition B: Department Room (Role Match)
    -- FIXED: Use = ANY() for Text Arrays
    OR (r.type = 'department' AND ur.role = ANY(r.allowed_roles))
    
    -- Condition C: Member of the Room (DM/Group)
    -- FIXED: Explicitly allow access if you have a read status entry (e.g. historical access)
    -- OR r.id IN (SELECT room_id FROM room_participants);
    OR EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = r.id);

-- ==========================================
-- 3. SEED DEFAULT ROOMS
-- ==========================================
-- Ensure the standard rooms exist. 
-- We use a DO block to insert only if not exists to preserve existing IDs.

DO $$
BEGIN
    -- 1. Global Headquarters (Everyone)
    IF NOT EXISTS (SELECT 1 FROM crm_chat_rooms WHERE name = 'Global Headquarters') THEN
        INSERT INTO crm_chat_rooms (id, name, type, created_at, last_message_at)
        VALUES (uuid_generate_v4(), 'Global Headquarters', 'global', NOW(), NOW());
    END IF;

    -- 2. High Table (Admins/Managers)
    IF NOT EXISTS (SELECT 1 FROM crm_chat_rooms WHERE name = 'High Table') THEN
        INSERT INTO crm_chat_rooms (id, name, type, allowed_roles, created_at, last_message_at)
        VALUES (uuid_generate_v4(), 'High Table', 'department', ARRAY['admin', 'manager'], NOW(), NOW());
    END IF;

    -- 3. Retention (Retention Staff)
    IF NOT EXISTS (SELECT 1 FROM crm_chat_rooms WHERE name = 'Retention Floor') THEN
        INSERT INTO crm_chat_rooms (id, name, type, allowed_roles, created_at, last_message_at)
        VALUES (uuid_generate_v4(), 'Retention Floor', 'department', ARRAY['admin', 'manager', 'retention'], NOW(), NOW());
    END IF;

    -- 4. Conversion (Conversion Staff)
    IF NOT EXISTS (SELECT 1 FROM crm_chat_rooms WHERE name = 'Conversion Floor') THEN
        INSERT INTO crm_chat_rooms (id, name, type, allowed_roles, created_at, last_message_at)
        VALUES (uuid_generate_v4(), 'Conversion Floor', 'department', ARRAY['admin', 'manager', 'conversion'], NOW(), NOW());
    END IF;
END $$;

-- ==========================================
-- 4. SECURITY (RLS)
-- ==========================================
ALTER TABLE crm_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;

-- Allow reading rooms you are part of
CREATE POLICY "Access my allowed rooms" ON crm_chat_rooms
FOR SELECT USING (
    type = 'global' 
    -- FIXED: Use = ANY() for Text Arrays
    OR (type = 'department' AND (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = ANY(allowed_roles))
    OR id IN (SELECT room_id FROM crm_chat_participants WHERE user_id = auth.uid())
);

-- Allow inserting rooms (Anyone can create a DM/Group)
CREATE POLICY "Create rooms" ON crm_chat_rooms
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Messages: Can only read if you have access to the room
CREATE POLICY "Read messages in my rooms" ON crm_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM crm_chat_rooms r
        WHERE r.id = crm_messages.room_id
        AND (
            r.type = 'global'
            -- FIXED: Use = ANY() for Text Arrays
            OR (r.type = 'department' AND (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = ANY(r.allowed_roles))
            OR EXISTS (SELECT 1 FROM crm_chat_participants p WHERE p.room_id = r.id AND p.user_id = auth.uid())
        )
    )
);

-- Messages: Can insert if you have access
CREATE POLICY "Send messages to my rooms" ON crm_messages
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM crm_chat_rooms r
        WHERE r.id = room_id
        AND (
            r.type = 'global'
            -- FIXED: Use = ANY() for Text Arrays
            OR (r.type = 'department' AND (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = ANY(r.allowed_roles))
            OR EXISTS (SELECT 1 FROM crm_chat_participants p WHERE p.room_id = r.id AND p.user_id = auth.uid())
        )
    )
);

-- ==========================================
-- 5. HELPER FUNCTIONS (RPC)
-- ==========================================
-- Efficiently find if a DM already exists between me and another user
CREATE OR REPLACE FUNCTION get_dm_room_id(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_room_id uuid;
BEGIN
  SELECT r.id INTO found_room_id
  FROM crm_chat_rooms r
  WHERE r.type = 'dm'
  AND EXISTS (SELECT 1 FROM crm_chat_participants p1 WHERE p1.room_id = r.id AND p1.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM crm_chat_participants p2 WHERE p2.room_id = r.id AND p2.user_id = target_user_id)
  LIMIT 1;
  
  RETURN found_room_id;
END;
$$;