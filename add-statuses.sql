-- Add new global action status definitions
-- Run this in Supabase SQL Editor

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Insert new status definitions (only if they don't exist)
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
)
VALUES
    (gen_random_uuid()::text, 'GLOBAL', '', 'REFUS', 'Refus', 12, false, 'SKIP', 999, false, false, 'DISQUALIFIED', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'REFUS_ARGU', 'Refus argu', 13, false, 'SKIP', 999, false, false, 'DISQUALIFIED', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'REFUS_CATEGORIQUE', 'Refus catégorique', 14, false, 'SKIP', 999, false, false, 'DISQUALIFIED', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'RELANCE', 'Relance', 15, true, 'CALLBACK', 1, false, true, 'CALLBACK_REQUESTED', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'RAPPEL', 'Rappel', 16, true, 'CALLBACK', 1, false, true, 'CALLBACK_REQUESTED', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'GERE_PAR_SIEGE', 'Géré par le siège', 17, false, 'SKIP', 999, false, false, 'OTHER', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'FAUX_NUMERO', 'Faux numéro', 18, false, 'SKIP', 999, false, false, 'OTHER', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'PROJET_A_SUIVRE', 'Projet à suivre', 19, true, 'FOLLOW_UP', 2, true, false, 'INTERESTED', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'MAUVAIS_INTERLOCUTEUR', 'Mauvais interlocuteur', 20, false, 'SKIP', 999, false, false, 'OTHER', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'MAIL_UNIQUEMENT', 'Mail uniquement', 21, false, 'SKIP', 999, false, false, 'OTHER', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'BARRAGE_SECRETAIRE', 'Barrage secrétaire', 22, false, 'SKIP', 999, false, false, 'OTHER', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'MAIL_DOC', 'Mail doc', 23, true, 'SKIP', 999, false, false, 'OTHER', true, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'GLOBAL', '', 'HORS_CIBLE', 'Hors cible', 24, false, 'SKIP', 999, false, false, 'DISQUALIFIED', true, CURRENT_TIMESTAMP)
ON CONFLICT ("scopeType", "scopeId", "code") 
DO UPDATE SET
    "label" = EXCLUDED."label",
    "sortOrder" = EXCLUDED."sortOrder",
    "requiresNote" = EXCLUDED."requiresNote",
    "priorityLabel" = EXCLUDED."priorityLabel",
    "priorityOrder" = EXCLUDED."priorityOrder",
    "triggersOpportunity" = EXCLUDED."triggersOpportunity",
    "triggersCallback" = EXCLUDED."triggersCallback",
    "resultCategoryCode" = EXCLUDED."resultCategoryCode",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = CURRENT_TIMESTAMP;

-- Verify the insertion
SELECT "code", "label", "sortOrder", "priorityLabel", "resultCategoryCode"
FROM "ActionStatusDefinition"
WHERE "scopeType" = 'GLOBAL' AND "scopeId" = ''
ORDER BY "sortOrder" ASC;
