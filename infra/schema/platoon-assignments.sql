-- TB instances to track different Territory Battle events
CREATE TABLE IF NOT EXISTS tb_instances (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(255) NOT NULL,
    tb_event_id VARCHAR(255) NOT NULL, -- e.g., 'geonosis_separatist_phase01'
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_active_tb UNIQUE (guild_id, tb_event_id, is_active)
);

-- Platoon assignments parsed from Echobase messages
CREATE TABLE IF NOT EXISTS platoon_assignments (
    id SERIAL PRIMARY KEY,
    tb_instance_id INTEGER NOT NULL REFERENCES tb_instances(id) ON DELETE CASCADE,

    -- Zone/Platoon/Squad/Slot identification
    zone_id VARCHAR(255) NOT NULL, -- e.g., 'geonosis_separatist_phase01_conflict01_recon01'
    platoon_number INTEGER NOT NULL, -- 1-6
    squad_number INTEGER NOT NULL, -- 1-3
    slot_number INTEGER NOT NULL, -- 1-5

    -- Assignment details
    assigned_ally_code CHAR(9) NOT NULL, -- Ally code of assigned player (unique identifier)
    assigned_unit_name VARCHAR(255) NOT NULL, -- Unit name from Echobase (may need mapping)

    -- Tracking
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_slot_assignment UNIQUE (tb_instance_id, zone_id, platoon_number, squad_number, slot_number)
);

-- Unit name mappings (Echobase name -> API identifier)
-- This helps translate between Echobase's display names and the API's unit identifiers
CREATE TABLE IF NOT EXISTS unit_name_mappings (
    id SERIAL PRIMARY KEY,
    echobase_name VARCHAR(255) NOT NULL UNIQUE, -- e.g., "JKR" or "Jedi Knight Revan"
    api_identifier VARCHAR(255) NOT NULL, -- e.g., "JEDIKNIGHTREVAN:SEVEN_STAR"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tb_instances_guild_active ON tb_instances(guild_id, is_active);
CREATE INDEX IF NOT EXISTS idx_platoon_assignments_tb_instance ON platoon_assignments(tb_instance_id);
CREATE INDEX IF NOT EXISTS idx_platoon_assignments_zone ON platoon_assignments(zone_id);
CREATE INDEX IF NOT EXISTS idx_unit_mappings_echobase ON unit_name_mappings(echobase_name);
