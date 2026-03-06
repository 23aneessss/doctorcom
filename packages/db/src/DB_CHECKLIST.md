# DB Checklist

Source of truth: `apps/server/DB.md`

## Enums

- [ ] `utilisateurs.role`: `medecin`, `secretaire`, `admin`
- [ ] `antecedents.type`: `personnel`, `familial`
- [ ] `rendez_vous.statut`: `planifie`, `confirme`, `termine`, `annule`, `non_present`
- [ ] `lettres_orientation.urgence`: `normale`, `urgente`, `tres_urgente`
- [ ] `certificats_medicaux.type_certificat`: `arret_travail`, `aptitude`, `scolaire`, `grossesse`, `deces`
- [ ] `certificats_medicaux.statut`: `brouillon`, `emis`, `annule`

## Tables / Columns / FKs

- [ ] `utilisateurs`
  `id`, `nom`, `prenom`, `email`, `adresse`, `telephone`, `mot_de_passe_hash`, `date_creation`, `role`
- [ ] `sessions`
  `id`, `utilisateur_id` -> `utilisateurs.id`, `jeton`, `date_connexion`, `date_expiration`, `est_actif`, `nom_appareil`
- [ ] `logs`
  `id`, `utilisateur_id` -> `utilisateurs.id`, `action`, `horodatage`
- [ ] `patients`
  `id`, `nom`, `prenom`, `telephone`, `email`, `matricule`, `date_naissance`, `nss`, `lieu_naissance`, `sexe`, `nationalite`, `groupe_sanguin`, `adresse`, `profession`, `habitudes_saines`, `habitudes_toxiques`, `nb_enfants`, `situation_familiale`, `age_circoncision`, `date_admission`, `environnement_animal`, `revenu_mensuel`, `taille_menage`, `nb_pieces`, `niveau_intellectuel`, `activite_sexuelle`, `relations_environnement`, `cree_par_utilisateur` -> `utilisateurs.id`
- [ ] `patients_femmes`
  `id`, `patient_id` -> `patients.id`, `menarche`, `regularite_cycles`, `contraception`, `nb_grossesses`, `nb_cesariennes`, `menopause`, `age_menopause`, `symptomes_menopause`
- [ ] `voyages_recents`
  `id`, `patient_id` -> `patients.id`, `destination`, `date`, `duree_jours`, `epidemies_destination`
- [ ] `antecedents`
  `id`, `patient_id` -> `patients.id`, `type`, `description`
- [ ] `antecedents_personnels`
  `id`, `antecedent_id` -> `antecedents.id`, `type`, `details`, `est_actif`
- [ ] `antecedents_familiaux`
  `id`, `antecedent_id` -> `antecedents.id`, `details`, `lien_parente`
- [ ] `suivi`
  `id`, `patient_id` -> `patients.id`, `utilisateur_id` -> `utilisateurs.id`, `hypothese_diagnostic`, `motif`, `historique`, `date_ouverture`, `date_fermeture`, `est_actif`
- [ ] `rendez_vous`
  `id`, `patient_id` -> `patients.id`, `suivi_id` -> `suivi.id`, `utilisateur_id` -> `utilisateurs.id`, `date`, `heure`, `statut`, `important`
- [ ] `examen_consultation`
  `id`, `rendez_vous_id` -> `rendez_vous.id`, `suivi_id` -> `suivi.id`, `date`, `aspect_general`, `examen_respiratoire`, `examen_cardiovasculaire`, `examen_cutane_muqueux`, `examen_orl`, `examen_digestif`, `examen_neurologique`, `examen_locomoteur`, `examen_genital`, `examen_urinaire`, `examen_ganglionnaire`, `examen_endocrinien`, `conclusion`
- [ ] `medicaments`
  `id`, `dci`, `indication`, `contre_indication`, `posologie_standard`, `effets_indesirables`, `dosage`
- [ ] `historique_traitements`
  `id`, `patient_id` -> `patients.id`, `medicament_id` -> `medicaments.id`, `posologie`, `est_actif`, `date_prescription`, `prescrit_par_utilisateur` -> `utilisateurs.id`
- [ ] `ordonnance`
  `id`, `rendez_vous_id` -> `rendez_vous.id`, `patient_id` -> `patients.id`, `utilisateur_id` -> `utilisateurs.id`, `remarques`, `date_prescription`
- [ ] `ordonnance_medicaments`
  `id`, `ordonnance_id` -> `ordonnance.id`, `medicament_id` -> `medicaments.id`, `posologie`, `duree_traitement`, `instructions`
- [ ] `vaccinations_patient`
  `id`, `patient_id` -> `patients.id`, `vaccin`, `date_vaccination`, `notes`
- [ ] `categories_documents`
  `id`, `nom`, `description`
- [ ] `documents_patient`
  `id`, `patient_id` -> `patients.id`, `categorie_id` -> `categories_documents.id`, `type_document`, `nom_document`, `chemin_fichier`, `type_fichier`, `taille_fichier`, `description`, `date_upload`, `uploade_par_utilisateur` -> `utilisateurs.id`, `est_archive`
- [ ] `lettres_orientation`
  `id`, `documents_patient_id` -> `documents_patient.id`, `utilisateur_id` -> `utilisateurs.id`, `suivi_id` -> `suivi.id`, `type_exploration`, `examen_demande`, `raison`, `destinataire`, `urgence`, `contenu_lettre`, `date_creation`, `date_modification`
- [ ] `certificats_medicaux`
  `id`, `documents_patient_id` -> `documents_patient.id`, `utilisateur_id` -> `utilisateurs.id`, `suivi_id` -> `suivi.id`, `type_certificat`, `date_emission`, `date_debut`, `date_fin`, `diagnostic`, `destinataire`, `notes`, `statut`, `date_creation`, `date_modification`
