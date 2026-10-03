-- Check current status definitions in the database
-- Run this in Supabase SQL Editor

-- 1. Check global status definitions
SELECT 
    "scopeType",
    "scopeId",
    "code",
    "label",
    "sortOrder",
    "priorityLabel",
    "resultCategoryCode",
    "isActive"
FROM "ActionStatusDefinition"
WHERE "scopeType" = 'GLOBAL' AND "scopeId" = ''
ORDER BY "sortOrder" ASC;

-- 2. Check mission-specific status definitions (if any)
SELECT 
    "scopeType",
    "scopeId",
    "code",
    "label",
    "sortOrder",
    "priorityLabel",
    "resultCategoryCode",
    "isActive"
FROM "ActionStatusDefinition"
WHERE "scopeType" = 'MISSION'
ORDER BY "scopeId", "sortOrder" ASC;

-- 3. Count statuses by scope
SELECT 
    "scopeType",
    "scopeId",
    COUNT(*) as status_count,
    STRING_AGG("code", ', ' ORDER BY "sortOrder") as status_codes
FROM "ActionStatusDefinition"
WHERE "isActive" = true
GROUP BY "scopeType", "scopeId"
ORDER BY "scopeType", "scopeId";

-- 4. Check if our new statuses exist
SELECT 
    "code",
    "label",
    "scopeType",
    "scopeId",
    "sortOrder"
FROM "ActionStatusDefinition"
WHERE "code" IN (
    'REFUS', 'REFUS_ARGU', 'REFUS_CATEGORIQUE', 'RELANCE', 'RAPPEL', 
    'GERE_PAR_SIEGE', 'FAUX_NUMERO', 'PROJET_A_SUIVRE', 'MAUVAIS_INTERLOCUTEUR',
    'MAIL_UNIQUEMENT', 'BARRAGE_SECRETAIRE', 'MAIL_DOC', 'HORS_CIBLE'
)
ORDER BY "code";

-- 5. Check missions table
SELECT 
    m.id,
    m.name,
    m.channel,
    m."isActive" as mission_active
FROM "Mission" m
ORDER BY m.name;
