-- Migration script to make missions use global statuses
-- Run this in Supabase SQL Editor

-- ============================================
-- OPTION 1: DELETE ALL MISSION OVERRIDES (RECOMMENDED)
-- ============================================
-- This will make ALL missions fall back to the 13 global statuses
-- Missions will lose their custom status configurations
-- SAFE: You can always recreate mission-specific statuses later via the UI

-- UNCOMMENT TO RUN:
-- DELETE FROM "ActionStatusDefinition" 
-- WHERE "scopeType" = 'MISSION';

-- Verify deletion:
-- SELECT COUNT(*) as deleted_count FROM "ActionStatusDefinition" WHERE "scopeType" = 'MISSION';


-- ============================================
-- OPTION 2: ADD NEW GLOBAL STATUSES TO EACH MISSION (SAFER BUT MORE COMPLEX)
-- ============================================
-- This keeps existing mission statuses and ADDS the 13 new ones
-- Each mission will have their current statuses PLUS the new global ones

-- Step 1: Get all mission IDs that have overrides
DO $$
DECLARE
    mission_record RECORD;
    new_status RECORD;
    max_sort_order INT;
BEGIN
    -- Loop through each mission with status overrides
    FOR mission_record IN 
        SELECT DISTINCT "scopeId" 
        FROM "ActionStatusDefinition" 
        WHERE "scopeType" = 'MISSION'
    LOOP
        -- Get the highest sortOrder for this mission
        SELECT COALESCE(MAX("sortOrder"), 0) INTO max_sort_order
        FROM "ActionStatusDefinition"
        WHERE "scopeType" = 'MISSION' AND "scopeId" = mission_record."scopeId";
        
        -- Add each new global status to this mission
        FOR new_status IN
            SELECT * FROM "ActionStatusDefinition"
            WHERE "scopeType" = 'GLOBAL' 
            AND "scopeId" = ''
            AND "code" IN (
                'REFUS', 'REFUS_ARGU', 'REFUS_CATEGORIQUE', 'RELANCE', 'RAPPEL',
                'GERE_PAR_SIEGE', 'FAUX_NUMERO', 'PROJET_A_SUIVRE', 'MAUVAIS_INTERLOCUTEUR',
                'MAIL_UNIQUEMENT', 'BARRAGE_SECRETAIRE', 'MAIL_DOC', 'HORS_CIBLE'
            )
        LOOP
            -- Check if this status code already exists for this mission
            IF NOT EXISTS (
                SELECT 1 FROM "ActionStatusDefinition"
                WHERE "scopeType" = 'MISSION' 
                AND "scopeId" = mission_record."scopeId"
                AND "code" = new_status."code"
            ) THEN
                -- Increment sort order
                max_sort_order := max_sort_order + 1;
                
                -- Insert the new status for this mission (UPPERCASE labels)
                INSERT INTO "ActionStatusDefinition" (
                    "id",
                    "scopeType",
                    "scopeId",
                    "code",
                    "label",
                    "sortOrder",
                    "requiresNote",
                    "priorityLabel",
                    "priorityOrder",
                    "triggersOpportunity",
                    "triggersCallback",
                    "resultCategoryCode",
                    "isActive",
                    "updatedAt"
                ) VALUES (
                    gen_random_uuid()::text,
                    'MISSION',
                    mission_record."scopeId",
                    new_status."code",
                    UPPER(new_status."label"),
                    max_sort_order,
                    new_status."requiresNote",
                    new_status."priorityLabel",
                    new_status."priorityOrder",
                    new_status."triggersOpportunity",
                    new_status."triggersCallback",
                    new_status."resultCategoryCode",
                    true,
                    CURRENT_TIMESTAMP
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Updated mission: %', mission_record."scopeId";
    END LOOP;
END $$;

-- Verify the additions:
SELECT 
    "scopeType",
    "scopeId",
    COUNT(*) as total_statuses,
    COUNT(CASE WHEN "code" IN (
        'REFUS', 'REFUS_ARGU', 'REFUS_CATEGORIQUE', 'RELANCE', 'RAPPEL',
        'GERE_PAR_SIEGE', 'FAUX_NUMERO', 'PROJET_A_SUIVRE', 'MAUVAIS_INTERLOCUTEUR',
        'MAIL_UNIQUEMENT', 'BARRAGE_SECRETAIRE', 'MAIL_DOC', 'HORS_CIBLE'
    ) THEN 1 END) as new_statuses_added
FROM "ActionStatusDefinition"
WHERE "scopeType" = 'MISSION'
GROUP BY "scopeType", "scopeId"
ORDER BY "scopeId";


-- ============================================
-- RECOMMENDATION
-- ============================================
-- Use OPTION 1 if:
--   - You want all missions to use the same 13 global statuses
--   - You don't need mission-specific customization
--   - Simpler to manage (one source of truth)
--
-- Use OPTION 2 if:
--   - You want to keep existing mission customizations
--   - Each mission needs different status sets
--   - You're afraid of losing data
--
-- SAFEST APPROACH:
-- 1. Run OPTION 2 first (adds statuses to all missions)
-- 2. Test in production
-- 3. Later, if you want to simplify, run OPTION 1 to remove all mission overrides
