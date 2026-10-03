---
name: DailyStats
version: 1.0.0
description: Donne vos stats journalières/hebdo (appels, RDV, taux de conversion & intérêt) via WhatsApp.
trigger: "stats aujourd'hui|donne moi mes stats|daily stats|stats de la semaine"
tools: [http]
author: captainprospect
config:
  apiBaseUrl: "" # Ex: https://your-domain.com
  apiToken: "" # Token envoyé en header Authorization: Bearer <token>
  timezone: "Europe/Paris"
---

# DailyStats

## When to Use
Quand l'utilisateur demande ses `stats aujourd'hui`, ses `daily stats`, ou des `stats de la semaine`, répondre avec un résumé KPIs en français via WhatsApp.

## Steps
1. Déterminer la période demandée:
   - Si le message contient `aujourd'hui` (ou l'une des phrases "stats aujourd'hui" / "donne moi mes stats"), utiliser `period = today`.
   - Si le message contient `semaine` (ou "stats de la semaine"), utiliser `period = week`.
   - Sinon, fallback sur `period = today`.
2. Construire l'URL d'appel:
   - Base: `${apiBaseUrl}/api/stats`
   - Ajouter `?period=${period}`.
   - Si le message contient explicitement deux dates au format `YYYY-MM-DD`, remplacer par `?from=<date1>&to=<date2>`.
3. Authentifier l'appel:
   - Envoyer `Authorization: Bearer ${apiToken}`.
4. Appeler l'API:
   - Faire un `GET` sur l'URL.
   - La réponse attendue est au format `{ success: true, data: { ... } }`.
5. Extraire et formater:
   - `totalCalls` (ou fallback `totalActions`)
   - `meetingsBooked`
   - `conversionRate` (en %)
   - `interestRate` (en %)
   - `uniqueContacts`
   - `talkTimeSeconds` (convertir en texte lisible: `HHh MMm SSs` ou `Mm SSs` si < 1h)
6. Générer le texte WhatsApp (format fixe):
   - `Stats (${periodeLabel})`
   - `Total appels: <totalCalls>`
   - `RDV: <meetingsBooked>`
   - `Taux de conversion: <conversionRate>%`
   - `Taux d'intérêt: <interestRate>%`
   - `Contacts uniques: <uniqueContacts>`
   - `Temps de conversation: <talkTimeHuman>`
7. Renvoyer via WhatsApp:
   - Utiliser `say(<texte_formatté>)`.
   - Si `say()` n'est pas disponible dans votre environnement OpenClaw, retourner simplement le texte final (l'envoi WhatsApp se fera via le canal courant).

## Examples
- "stats aujourd'hui" → period=today, afficher les KPIs du jour.
- "stats de la semaine" → period=week, afficher les KPIs sur la semaine.
- "daily stats" → period=today.

## (Optionnel) Programmation automatique à 9h
Configurer une exécution quotidienne via `openclaw cron add` en déclenchant une demande du type `stats aujourd'hui` (ainsi le skill réutilise la même logique).

