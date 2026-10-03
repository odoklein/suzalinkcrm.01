// ============================================
// PROSPECT ORCHESTRATION NOTIFICATIONS
// Enhanced success messages for POE actions
// ============================================

export interface ProspectNotification {
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

// ============================================
// NOTIFICATION HELPERS
// ============================================

export function getSourceCreatedNotification(sourceName: string, sourceType: string): ProspectNotification {
  return {
    title: "Source créée",
    message: `"${sourceName}" (${sourceType}) est maintenant active. Les nouveaux leads seront automatiquement traités par le pipeline.`,
    type: "success",
  };
}

export function getSourceTestedNotification(success: boolean): ProspectNotification {
  if (success) {
    return {
      title: "Test réussi",
      message: "Le lead de test a été traité avec succès. Le prospect apparaîtra dans la liste des prospects.",
      type: "success",
    };
  }
  return {
    title: "Test échoué",
    message: "Le test du lead a échoué. Vérifiez la configuration de la source.",
    type: "error",
  };
}

export function getRuleCreatedNotification(ruleName: string, step: string): ProspectNotification {
  return {
    title: "Règle créée",
    message: `"${ruleName}" est maintenant active et sera appliquée à tous les prospects dans l'étape ${step}.`,
    type: "success",
  };
}

export function getProspectActivatedNotification(prospectName: string, missionName?: string): ProspectNotification {
  return {
    title: "Prospect activé",
    message: missionName
      ? `${prospectName} a été converti en Contact et assigné à la mission "${missionName}".`
      : `${prospectName} a été converti en Contact dans le CRM.`,
    type: "success",
  };
}

export function getProspectApprovedNotification(prospectName: string): ProspectNotification {
  return {
    title: "Prospect approuvé",
    message: `${prospectName} a été approuvé et continue dans le pipeline.`,
    type: "success",
  };
}

export function getProspectRejectedNotification(prospectName: string, reason?: string): ProspectNotification {
  return {
    title: "Prospect rejeté",
    message: reason
      ? `${prospectName} a été rejeté : ${reason}`
      : `${prospectName} a été rejeté.`,
    type: "info",
  };
}

export function getPipelineCompletedNotification(prospectName: string): ProspectNotification {
  return {
    title: "Pipeline terminé",
    message: `${prospectName} a été traité avec succès à travers toutes les étapes du pipeline.`,
    type: "success",
  };
}
