// ============================================
// PROSPECTS TOUR DEFINITIONS
// ============================================

import { TourStep } from "@/components/ui/Tour";

// ============================================
// PROSPECTS LIST TOUR
// ============================================

export const PROSPECTS_LIST_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="prospects-header"]',
    title: "Liste des Prospects",
    content: "Tous les leads entrants apparaissent ici avant d'être activés dans le CRM. Les prospects passent par un pipeline automatisé qui les valide, les note et les route.",
    placement: "bottom",
  },
  {
    target: '[data-tour="prospects-stats"]',
    title: "Statistiques",
    content: "Surveillez le nombre total de prospects, ceux en attente, en révision, et ceux qui ont été activés. Ces métriques vous donnent une vue d'ensemble du pipeline.",
    placement: "bottom",
  },
  {
    target: '[data-tour="prospects-filters"]',
    title: "Filtres",
    content: "Utilisez les filtres pour trouver rapidement des prospects par statut, étape du pipeline, ou recherche textuelle. Le filtre 'Révision requise' vous montre l'Exception Inbox.",
    placement: "bottom",
  },
  {
    target: '[data-tour="prospects-table"]',
    title: "Tableau des Prospects",
    content: "Chaque prospect affiche son nom, entreprise, statut, scores de qualité et confiance, et la mission assignée. Cliquez sur un prospect pour voir les détails complets.",
    placement: "top",
  },
  {
    target: '[data-tour="exception-inbox-button"]',
    title: "Exception Inbox",
    content: "Cliquez ici pour voir les prospects nécessitant une révision manuelle. C'est là que vous approuvez ou rejetez les prospects qui n'ont pas pu être traités automatiquement.",
    placement: "left",
  },
];

// ============================================
// EXCEPTION INBOX TOUR
// ============================================

export const EXCEPTION_INBOX_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="exception-inbox-header"]',
    title: "Exception Inbox",
    content: "Cette page contient tous les prospects qui nécessitent votre attention. Ils peuvent avoir un score faible, des données conflictuelles, ou un routage impossible.",
    placement: "bottom",
  },
  {
    target: '[data-tour="review-modal"]',
    title: "Révision d'un Prospect",
    content: "Cliquez sur un prospect pour voir ses détails, scores, raison de révision, et historique des décisions. Vous pouvez alors approuver, rejeter, ou ajuster les données.",
    placement: "top",
  },
];

// ============================================
// RULES TOUR
// ============================================

export const RULES_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="rules-header"]',
    title: "Règles",
    content: "Les règles automatisent la validation, le scoring et le routage des prospects. Créez des règles pour gérer automatiquement les cas courants.",
    placement: "bottom",
  },
  {
    target: '[data-tour="create-rule-button"]',
    title: "Créer une Règle",
    content: "Utilisez l'assistant de création de règles pour définir des conditions et actions. Par exemple : 'Si email se termine par @gmail.com, alors réduire le score de 30'.",
    placement: "left",
  },
  {
    target: '[data-tour="rules-list"]',
    title: "Liste des Règles",
    content: "Toutes vos règles actives sont listées ici, groupées par étape du pipeline. Vous pouvez activer, désactiver, ou modifier les règles à tout moment.",
    placement: "top",
  },
];

// ============================================
// SOURCES TOUR
// ============================================

export const SOURCES_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sources-header"]',
    title: "Sources de Prospects",
    content: "Configurez ici toutes vos sources de leads : formulaires web, APIs, imports CSV, etc. Chaque source peut avoir ses propres règles et paramètres.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-integration-button"]',
    title: "Ajouter une Intégration",
    content: "Cliquez ici pour lancer l'assistant de configuration. Il vous guidera à travers la création d'une nouvelle source étape par étape.",
    placement: "left",
  },
  {
    target: '[data-tour="source-test"]',
    title: "Tester une Source",
    content: "Utilisez le bouton de test pour envoyer un lead d'essai et vérifier que votre source fonctionne correctement avant de la mettre en production.",
    placement: "top",
  },
];

// ============================================
// COMPLETE PROSPECTS TOUR
// ============================================

export const COMPLETE_PROSPECTS_TOUR_STEPS: TourStep[] = [
  ...PROSPECTS_LIST_TOUR_STEPS,
  {
    target: '[data-tour="sources-nav"]',
    title: "Sources",
    content: "Allez dans 'Sources' pour configurer vos intégrations. C'est la première étape pour commencer à recevoir des leads.",
    placement: "right",
    action: () => {
      // Could navigate to sources page
    },
  },
  {
    target: '[data-tour="rules-nav"]',
    title: "Règles",
    content: "Configurez des règles pour automatiser la validation et le scoring. Les règles vous font gagner du temps en traitant automatiquement les cas courants.",
    placement: "right",
  },
];

// ============================================
// GET TOUR BY ID
// ============================================

export function getTourSteps(tourId: string): TourStep[] {
  switch (tourId) {
    case "prospects-list":
      return PROSPECTS_LIST_TOUR_STEPS;
    case "exception-inbox":
      return EXCEPTION_INBOX_TOUR_STEPS;
    case "rules":
      return RULES_TOUR_STEPS;
    case "sources":
      return SOURCES_TOUR_STEPS;
    case "complete":
      return COMPLETE_PROSPECTS_TOUR_STEPS;
    default:
      return [];
  }
}
