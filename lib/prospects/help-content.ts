// ============================================
// PROSPECTS HELP CONTENT
// Documentation and help content for POE
// ============================================

import { HelpSection } from "@/components/ui/HelpPanel";

// ============================================
// GETTING STARTED
// ============================================

export const GETTING_STARTED_SECTIONS: HelpSection[] = [
  {
    id: "overview",
    title: "Vue d'ensemble",
    content: `Le moteur d'orchestration des prospects (POE) gère automatiquement les leads entrants avant qu'ils n'atteignent votre CRM.

Le pipeline traite chaque prospect à travers plusieurs étapes :
1. Intake - Réception du lead
2. Normalize - Standardisation des données
3. Validate - Validation selon les règles
4. Score - Calcul de la qualité
5. Deduplicate - Vérification des doublons
6. Route - Attribution à une mission/SDR
7. Activate - Création du Contact dans le CRM

Seuls les prospects qualifiés et approuvés deviennent des Contacts visibles par les SDRs.`,
  },
  {
    id: "first-steps",
    title: "Premiers pas",
    content: `Pour commencer :

1. Créez une source d'intégration (formulaire web, API, etc.)
2. Configurez les règles de validation et de scoring
3. Définissez les seuils d'activation
4. Testez avec un lead d'essai

Les prospects entrants seront automatiquement traités et apparaîtront dans la liste des prospects.`,
  },
  {
    id: "key-concepts",
    title: "Concepts clés",
    content: `Qualité (Quality Score) : 0-100, indique la valeur du prospect basée sur la complétude des données.

Confiance (Confidence Score) : 0-100, indique la fiabilité des données.

Exception Inbox : Prospects nécessitant une révision manuelle (score faible, données conflictuelles, etc.).

Règles : Conditions configurables qui valident, notent ou routent les prospects automatiquement.`,
  },
];

// ============================================
// INTEGRATIONS
// ============================================

export const INTEGRATIONS_SECTIONS: HelpSection[] = [
  {
    id: "adding-integrations",
    title: "Ajouter une intégration",
    content: `Pour connecter une nouvelle source de leads :

1. Allez dans "Sources" → "Ajouter une intégration"
2. Sélectionnez le type (Formulaire web, API, CSV, etc.)
3. Configurez les paramètres de connexion
4. Testez la connexion
5. Activez la source

Une fois activée, les nouveaux leads de cette source seront automatiquement traités.`,
  },
  {
    id: "web-form",
    title: "Formulaire web",
    content: `Pour un formulaire web :

1. Créez une source de type "Web Form"
2. Copiez l'URL webhook fournie
3. Configurez votre formulaire pour envoyer les données à cette URL
4. Testez avec un envoi d'essai

Format attendu : JSON avec les champs du prospect (firstName, lastName, email, etc.)`,
    subsections: [
      {
        id: "webhook-url",
        title: "URL Webhook",
        content: "L'URL webhook est unique par source. Utilisez-la dans votre formulaire pour envoyer les données.",
      },
      {
        id: "field-mapping",
        title: "Mapping des champs",
        content: "Les champs sont automatiquement mappés. Vous pouvez personnaliser le mapping dans les paramètres de la source.",
      },
    ],
  },
  {
    id: "api-integration",
    title: "Intégration API",
    content: `Pour une intégration API :

1. Créez une source de type "API"
2. Générez une clé API
3. Utilisez cette clé pour authentifier vos requêtes
4. Envoyez les leads à l'endpoint /api/prospects/intake

Exemple de requête :
POST /api/prospects/intake
Headers: { "Content-Type": "application/json" }
Body: {
  "sourceId": "votre-source-id",
  "apiKey": "votre-cle-api",
  "payload": { "firstName": "...", "email": "..." }
}`,
  },
];

// ============================================
// RULES
// ============================================

export const RULES_SECTIONS: HelpSection[] = [
  {
    id: "creating-rules",
    title: "Créer une règle",
    content: `Les règles permettent d'automatiser la validation, le scoring et le routage.

Étapes pour créer une règle :
1. Sélectionnez l'étape du pipeline (VALIDATE, SCORE, ROUTE)
2. Définissez la condition (ex: email se termine par "@gmail.com")
3. Configurez l'action (ex: réduire le score de 30)
4. Testez la règle avec des données d'essai
5. Activez la règle

Les règles sont évaluées par ordre de priorité (plus haute priorité = évaluée en premier).`,
  },
  {
    id: "rule-examples",
    title: "Exemples de règles",
    content: `Exemples courants :

Validation :
- Si email est un fournisseur gratuit → Réduire score de 30
- Si téléphone manquant → Requérir révision
- Si nom de société manquant → Rejeter

Scoring :
- Si titre contient "CEO" → Augmenter score de 20
- Si LinkedIn présent → Augmenter score de 10
- Si multiple canaux de contact → Augmenter score de 15

Routage :
- Si industrie = "SaaS" ET score >= 70 → Assigner à mission spécifique
- Si pays = "France" → Assigner à SDR français`,
  },
  {
    id: "rule-priority",
    title: "Priorité des règles",
    content: `La priorité détermine l'ordre d'évaluation :
- Priorité élevée (ex: 100) : Évaluée en premier
- Priorité moyenne (ex: 50) : Évaluée ensuite
- Priorité faible (ex: 0) : Évaluée en dernier

Plusieurs règles peuvent s'appliquer au même prospect. Les actions sont cumulatives.`,
  },
];

// ============================================
// EXCEPTIONS
// ============================================

export const EXCEPTIONS_SECTIONS: HelpSection[] = [
  {
    id: "exception-inbox",
    title: "Exception Inbox",
    content: `L'Exception Inbox contient les prospects nécessitant une révision manuelle :

- Score de qualité trop faible
- Données conflictuelles ou ambiguës
- Routage impossible (pas de mission assignée)
- Doublons potentiels

En tant que manager, vous pouvez :
- Approuver → Le prospect continue dans le pipeline
- Rejeter → Le prospect est marqué comme rejeté
- Ajuster → Modifier les données et réapprouver`,
  },
  {
    id: "review-reasons",
    title: "Raisons de révision",
    content: `Les prospects peuvent nécessiter une révision pour :

1. Score faible : Qualité ou confiance en dessous des seuils
2. Données incomplètes : Informations manquantes critiques
3. Conflit de données : Informations contradictoires
4. Routage ambigu : Impossible d'assigner automatiquement
5. Doublon potentiel : Possible doublon avec un prospect existant

Chaque raison est expliquée dans le profil du prospect.`,
  },
];

// ============================================
// SCORING
// ============================================

export const SCORING_SECTIONS: HelpSection[] = [
  {
    id: "quality-score",
    title: "Score de qualité",
    content: `Le score de qualité (0-100) évalue la valeur du prospect :

Facteurs positifs :
- Nom complet présent (+10)
- Email professionnel (non gratuit) (+15)
- Téléphone présent (+10)
- LinkedIn présent (+5)
- Titre de décideur (CEO, Director, etc.) (+15)
- Informations entreprise complètes (+30)
- Multiple canaux de contact (+15)

Le score est ajusté par les règles de scoring configurées.`,
  },
  {
    id: "confidence-score",
    title: "Score de confiance",
    content: `Le score de confiance (0-100) évalue la fiabilité des données :

Facteurs :
- Format email valide (+20)
- Nom et prénom présents (+20)
- Nom de société présent (+10)
- Multiple canaux de contact (+10)
- Données entreprise présentes (+20)

Un score de confiance élevé indique des données fiables et complètes.`,
  },
  {
    id: "thresholds",
    title: "Seuils d'activation",
    content: `Les seuils déterminent quand un prospect peut être activé automatiquement :

- Score de qualité minimum : Par défaut 50
- Score de confiance minimum : Par défaut 70
- Seuil de révision : Par défaut 40 (en dessous = révision requise)

Ces seuils sont configurables dans les paramètres du pipeline.`,
  },
];

// ============================================
// PIPELINE STAGES
// ============================================

export const PIPELINE_SECTIONS: HelpSection[] = [
  {
    id: "pipeline-overview",
    title: "Vue d'ensemble du pipeline",
    content: `Le pipeline traite chaque prospect à travers 7 étapes :

1. INTAKE : Réception et stockage du lead brut
2. NORMALIZE : Standardisation des formats de données
3. VALIDATE : Application des règles de validation
4. ENRICH : Enrichissement optionnel (APIs externes)
5. DEDUPLICATE : Vérification des doublons
6. SCORE : Calcul des scores qualité/confiance
7. ROUTE : Attribution à une mission et SDR
8. ACTIVATE : Création du Contact dans le CRM

Chaque étape produit un log de décision pour traçabilité.`,
  },
  {
    id: "stage-details",
    title: "Détails des étapes",
    content: `INTAKE : Crée un événement immuable avec les données brutes.

NORMALIZE : Standardise les formats (emails, téléphones, noms, etc.).

VALIDATE : Applique les règles de validation. Peut requérir révision ou rejeter.

ENRICH : Optionnel. Enrichit avec des APIs externes (Clearbit, Apollo, etc.).

DEDUPLICATE : Vérifie les doublons par email/téléphone. Marque comme doublon si trouvé.

SCORE : Calcule qualité et confiance. Applique les règles de scoring.

ROUTE : Assigne à une mission et SDR selon la stratégie configurée.

ACTIVATE : Crée Contact et Company dans le CRM. Le prospect devient visible pour les SDRs.`,
  },
];

// ============================================
// HELP CONTENT BY TOPIC
// ============================================

export function getHelpContent(topic: string): HelpSection[] {
  switch (topic) {
    case "getting-started":
      return GETTING_STARTED_SECTIONS;
    case "integrations":
      return INTEGRATIONS_SECTIONS;
    case "rules":
      return RULES_SECTIONS;
    case "exceptions":
      return EXCEPTIONS_SECTIONS;
    case "scoring":
      return SCORING_SECTIONS;
    case "pipeline":
      return PIPELINE_SECTIONS;
    case "prospects":
      return [
        ...GETTING_STARTED_SECTIONS,
        ...INTEGRATIONS_SECTIONS,
        ...RULES_SECTIONS,
        ...EXCEPTIONS_SECTIONS,
        ...SCORING_SECTIONS,
        ...PIPELINE_SECTIONS,
      ];
    default:
      return GETTING_STARTED_SECTIONS;
  }
}
