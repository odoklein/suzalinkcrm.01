# Plan UI/UX — Page « Mes RDV » (Client Portal)

> Contenu et spécifications pour la page des rendez-vous côté client uniquement.

---

## 1. Vue d'ensemble

La page **Mes RDV** permet au client de consulter tous ses rendez-vous (planifiés, passés, reportés, annulés) avec l’ensemble des infos contact/entreprise, de laisser un retour et de gérer le statut (confirmé, pas la bonne cible, annulé, etc.).

---

## 2. Colonnes / informations affichées par RDV

### 2.1 Contact (toutes les colonnes)

| Champ        | Label UI          | Notes                                         |
|--------------|-------------------|-----------------------------------------------|
| Prénom       | Prénom            |                                               |
| Nom          | Nom               |                                               |
| Titre        | Fonction          |                                               |
| Email        | Email             | Lien mailto                                   |
| Téléphone    | Téléphone         | Lien tel                                      |
| LinkedIn     | LinkedIn          | Lien externe si présent                       |
| Champs perso | Infos supplémentaires | `customData` si non vide                 |

### 2.2 Entreprise (toutes les colonnes)

| Champ        | Label UI             | Notes                                         |
|--------------|----------------------|-----------------------------------------------|
| Nom          | Société              |                                               |
| Secteur      | Secteur              |                                               |
| Site web     | Site web             | Lien externe                                  |
| Pays         | Pays                 |                                               |
| Taille       | Taille               |                                               |
| Champs perso | Infos supplémentaires | `customData` si non vide                 |

### 2.3 Informations du RDV

| Champ              | Label UI                | Notes                                         |
|--------------------|-------------------------|-----------------------------------------------|
| Date / Heure       | Date et heure           | Format long FR                                |
| Mission            | Mission                 | Nom de la mission                             |
| Campagne           | Campagne                | Nom de la campagne                            |
| Note SDR           | Briefing SDR            | Note du SDR pour le RDV                       |
| Dans le calendrier | Ajouté au calendrier    | Oui / Non (si le client a exporté en .ics)    |
| Statut RDV         | Statut                  | À venir, Passé, Reporté, Annulé               |

### 2.4 Statut du RDV (affiché)

| Valeur    | Label UI       | Couleur / Style       |
|-----------|----------------|------------------------|
| À venir   | À venir        | Vert / badge positif  |
| Passé     | Passé          | Gris                  |
| Reporté   | Reporté        | Orange / ambre        |
| Annulé    | Annulé         | Rouge                 |

---

## 3. Indicateur « Dans le calendrier »
i dont want this cause SDR book directly via the link of the client booking cal 

---

## 4. Statuts : Reporté et Annulé

### 4.1 Reporté

- Le RDV a été déplacé à une autre date.
- Affichage : badge « Reporté » + ancienne date barrée + nouvelle date si disponible.
- Le client peut laisser un commentaire optionnel sur le report.

### 4.2 Annulé

- Le RDV est annulé.
- **Règle** : si le client choisit « Annulé », un champ **obligatoire** s’affiche : **« Pourquoi ce RDV est-il annulé ? »** (texte libre).
- Le formulaire de retour n’est pas validable sans cette raison.

---

## 5. Retour client (feedback)

### 5.1 Statuts / outcomes proposés

| Valeur               | Label UI              | Icône  | Usage                                      |
|----------------------|-----------------------|--------|--------------------------------------------|
| CONFIRMED            | Confirmé              | Check  | RDV bien tenu, tout ok                     |
| NOT_CONFIRMED        | Non confirmé          | X      | RDV prévu mais pas encore tenu / confirmé  |
| POSITIVE             | Positif               | ThumbsUp | RDV bien passé, bon échange              |
| NEUTRAL              | Neutre                | Minus  | RDV correct, sans plus                     |
| NEGATIVE             | Négatif               | ThumbsDown | RDV décevant                           |
| NO_SHOW              | Pas eu lieu           | XCircle | Prospect absent                          |
| WRONG_TARGET         | Pas la bonne cible    | Target | Mauvais profil / hors cible                |
| CANCELLED            | Annulé                | XCircle | Annulé par le client (avec raison obligatoire) |

### 5.2 Champs du formulaire de retour

| Champ                | Type       | Obligatoire | Notes                                      |
|----------------------|------------|-------------|--------------------------------------------|
| Statut / Outcome     | Sélection  | Oui         | Boutons ou liste des statuts ci‑dessus     |
| Recontact souhaité ? | Oui / Non / Peut‑être | Oui   | En cas de reprise de contact              |
| Commentaire          | Texte long | Non         | Commentaire libre                          |
| Raison annulation    | Texte long | Si annulé   | Obligatoire si statut = Annulé             |

---

## 6. Structure UI recommandée

### 6.1 Vue liste (timeline ou tableau)

```
┌─────────────────────────────────────────────────────────────────┐
│ Mes Rendez-vous                              [Filtrer] [Export]  │
├─────────────────────────────────────────────────────────────────┤
│ [À venir] [Passés] [Reportés] [Annulés] [Tous]                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Carte RDV ───────────────────────────────────────────────┐  │
│  │ Date | Heure | Statut | Mission | Campagne                 │  │
│  │ Contact: Nom, Titre | Société, Secteur, Pays               │  │
│  │ Email | Tél | LinkedIn | Site web | Infos perso            │  │
│  │ Note SDR (briefing)                                         │  │
│  │ Calendrier: ✓ Oui / ○ Non  [Ajouter au calendrier]         │  │
│  │ [Voir détail] [Donner mon avis]                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Modal « Détail du RDV »

```
┌─────────────────────────────────────────────────────────────────┐
│ Détail du rendez-vous                                      [X]  │
├─────────────────────────────────────────────────────────────────┤
│ [Date] [Heure] [Statut] [Mission] [Calendrier: Oui/Non]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONTACT                    │  ENTREPRISE                        │
│  Prénom Nom                 │  Nom société                       │
│  Titre                      │  Secteur | Pays | Taille           │
│  Email | Tél | LinkedIn     │  Site web                          │
│  Infos supplémentaires     │  Infos supplémentaires             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Note SDR (briefing)                                             │
│  "..."                                                            │
├─────────────────────────────────────────────────────────────────┤
│  Si Reporté: [Nouvelle date] [Commentaire optionnel]             │
│  Si Annulé:  [Raison obligatoire] (déjà rempli ou à remplir)     │
├─────────────────────────────────────────────────────────────────┤
│  MON RETOUR (pour RDV passés / annulés)                          │
│  Statut: [Confirmé] [Positif] [Négatif] [Pas la bonne cible]...  │
│  Recontact: [Oui] [Non] [Peut‑être]                              │
│  Commentaire: [___________________________]                      │
│  Si Annulé: Raison: [___________________________] *obligatoire   │
│  [Enregistrer mon avis]                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Règles UX

1. **Obligation de la raison si annulé** : le bouton « Enregistrer » reste désactivé tant que le champ « Raison d’annulation » est vide quand le statut est Annulé.
2. **Calendrier** : l’état « Ajouté au calendrier » est affiché clairement (badge ou icône) sur chaque carte.
3. **Filtres** : onglets ou filtres pour À venir, Passés, Reportés, Annulés, Tous.
4. **Carte compacte vs détail** : en liste, affichage condensé ; dans la modal, toutes les colonnes contact/entreprise et du RDV.
5. **Feedback** : formulaire visible pour les RDV passés ou annulés, pas pour les RDV à venir.
6. **Message de confirmation** : toast ou message après enregistrement du retour.

---

## 8. Contenu copy (FR)

| Élément           | Texte                                                    |
|-------------------|----------------------------------------------------------|
| Titre page        | Mes Rendez-vous                                          |
| Onglet à venir    | À venir                                                  |
| Onglet passés     | Passés                                                   |
| Onglet reportés   | Reportés                                                 |
| Onglet annulés    | Annulés                                                  |
| Onglet tous       | Tous                                                     |
| Badge calendrier  | Ajouté au calendrier / Non ajouté                        |
| Bouton export     | Ajouter au calendrier                                    |
| Bouton détail     | Voir le détail                                           |
| Titre formulaire  | Comment s'est passé ce rendez-vous ?                     |
| Recontact         | Souhaitez-vous que l'équipe recontacte ce prospect ?     |
| Raison annulation | Pourquoi ce RDV est-il annulé ? (obligatoire)            |
| Commentaire       | Votre commentaire (optionnel)                            |
| Bouton enregistrer| Enregistrer mon avis                                     |
| Message succès    | Merci pour votre retour.                                 |
| Vide à venir      | Aucun rendez-vous à venir. Les prochains RDV planifiés par votre équipe apparaîtront ici. |
| Vide passés       | Aucun rendez-vous passé. Votre historique apparaîtra ici. |

---

## 9. Extensions API / schéma (indications)

- Champ optionnel côté API pour « dans le calendrier » (ex. `addedToCalendarAt`) si tracking côté serveur.
- `MeetingFeedback` : étendre `MeetingOutcome` avec `CONFIRMED`, `NOT_CONFIRMED`, `WRONG_TARGET`, `CANCELLED`.
- Nouveau champ `MeetingFeedback.cancellationReason` (texte, requis si outcome = CANCELLED).
- Nouveau champ `Action.rescheduledTo` ou équivalent pour les RDV reportés (si pas déjà géré).
- Champ `MeetingFeedback.clientComment` pour le commentaire libre.
