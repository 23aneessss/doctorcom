import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type InterfaceLanguage = "fr" | "ar" | "en";

const STORAGE_KEY = "doctor-com-interface-language";

const COPY_TRANSLATIONS: Record<string, { en: string; ar: string }> = {
  "Accueil": { en: "Home", ar: "الرئيسية" },
  "Patients": { en: "Patients", ar: "المرضى" },
  "Agenda": { en: "Calendar", ar: "المواعيد" },
  "Ordonnances": { en: "Prescriptions", ar: "الوصفات" },
  "Médicaments": { en: "Medications", ar: "الأدوية" },
  "Paramètres": { en: "Settings", ar: "الإعدادات" },
  "Aide et Assistance": { en: "Help and Support", ar: "المساعدة والدعم" },
  "Aide & Assistance": { en: "Help and Support", ar: "المساعدة والدعم" },
  "Tableau de bord": { en: "Dashboard", ar: "لوحة التحكم" },
  "Actions Rapides & Prochains RDV": { en: "Quick Actions & Upcoming Appointments", ar: "إجراءات سريعة ومواعيد قادمة" },
  "Actions rapides": { en: "Quick actions", ar: "إجراءات سريعة" },
  "Actions du jour": { en: "Today's actions", ar: "إجراءات اليوم" },
  "Activité Récente": { en: "Recent Activity", ar: "النشاط الأخير" },
  "Aucune activité récente": { en: "No recent activity", ar: "لا يوجد نشاط حديث" },
  "Évolution des patients": { en: "Patient trends", ar: "تطور المرضى" },
  "Aucune nouvelle admission": { en: "No new admissions", ar: "لا توجد حالات قبول جديدة" },
  "Dernière visite": { en: "Last visit", ar: "آخر زيارة" },
  "Date de naissance": { en: "Date of birth", ar: "تاريخ الميلاد" },
  "Date de naissance :": { en: "Date of birth:", ar: "تاريخ الميلاد:" },
  "Age / Sexe": { en: "Age / Sex", ar: "العمر / الجنس" },
  "Féminin": { en: "Female", ar: "أنثى" },
  "Masculin": { en: "Male", ar: "ذكر" },
  "Adresse complète": { en: "Full address", ar: "العنوان الكامل" },
  "Adresse complete": { en: "Full address", ar: "العنوان الكامل" },
  "Adresse email": { en: "Email address", ar: "البريد الإلكتروني" },
  "Adresse Email": { en: "Email address", ar: "البريد الإلكتروني" },
  "Numéro de téléphone": { en: "Phone number", ar: "رقم الهاتف" },
  "Nom complet": { en: "Full name", ar: "الاسم الكامل" },
  "Prénom": { en: "First name", ar: "الاسم الشخصي" },
  "Nom": { en: "Last name", ar: "اللقب" },
  "Profil": { en: "Profile", ar: "الملف الشخصي" },
  "Préférences": { en: "Preferences", ar: "التفضيلات" },
  "Sécurité": { en: "Security", ar: "الأمان" },
  "Langue de l'interface": { en: "Interface language", ar: "لغة الواجهة" },
  "Français": { en: "French", ar: "الفرنسية" },
  "Arabe": { en: "Arabic", ar: "العربية" },
  "Anglais": { en: "English", ar: "الإنجليزية" },
  "Annuler": { en: "Cancel", ar: "إلغاء" },
  "Fermer": { en: "Close", ar: "إغلاق" },
  "Retour": { en: "Back", ar: "رجوع" },
  "Suivant": { en: "Next", ar: "التالي" },
  "Continuer": { en: "Continue", ar: "متابعة" },
  "Confirmer": { en: "Confirm", ar: "تأكيد" },
  "Valider": { en: "Validate", ar: "تأكيد" },
  "Enregistrer": { en: "Save", ar: "حفظ" },
  "Enregistrer les modifications": { en: "Save changes", ar: "حفظ التعديلات" },
  "Enregistrement...": { en: "Saving...", ar: "جارٍ الحفظ..." },
  "Terminer": { en: "Done", ar: "إنهاء" },
  "Supprimer": { en: "Delete", ar: "حذف" },
  "Modifier": { en: "Edit", ar: "تعديل" },
  "Voir": { en: "View", ar: "عرض" },
  "Détails": { en: "Details", ar: "التفاصيل" },
  "Déconnexion": { en: "Sign out", ar: "تسجيل الخروج" },
  "Se déconnecter": { en: "Sign out", ar: "تسجيل الخروج" },
  "Chargement...": { en: "Loading...", ar: "جارٍ التحميل..." },
  "Échec": { en: "Failed", ar: "فشل" },
  "Aucun résultat": { en: "No results", ar: "لا توجد نتائج" },
  "Aucun résultat trouvé": { en: "No results found", ar: "لم يتم العثور على نتائج" },
  "Aucune modification détectée": { en: "No changes detected", ar: "لم يتم اكتشاف أي تغييرات" },
  "Aucune modification detectee": { en: "No changes detected", ar: "لم يتم اكتشاف أي تغييرات" },
  "Aucune modification à enregistrer.": { en: "No changes to save.", ar: "لا توجد تعديلات للحفظ." },
  "Impossible de charger votre profil.": { en: "Unable to load your profile.", ar: "تعذر تحميل ملفك الشخصي." },
  "Paramètres enregistrés.": { en: "Settings saved.", ar: "تم حفظ الإعدادات." },
  "Impossible d'enregistrer les paramètres.": { en: "Unable to save settings.", ar: "تعذر حفظ الإعدادات." },
  "Mot de passe modifié": { en: "Password changed", ar: "تم تغيير كلمة المرور" },
  "Changer le mot de passe": { en: "Change password", ar: "تغيير كلمة المرور" },
  "Changer maintenant": { en: "Change now", ar: "تغيير الآن" },
  "Créer un compte": { en: "Create an account", ar: "إنشاء حساب" },
  "Connexion réussie": { en: "Signed in successfully", ar: "تم تسجيل الدخول بنجاح" },
  "Au moins 6 caractères": { en: "At least 6 characters", ar: "6 أحرف على الأقل" },
  "Email": { en: "Email", ar: "البريد الإلكتروني" },
  "Mot de passe": { en: "Password", ar: "كلمة المرور" },
  "Nouveau mot de passe": { en: "New password", ar: "كلمة المرور الجديدة" },
  "Mot de passe actuel": { en: "Current password", ar: "كلمة المرور الحالية" },
  "Ajouter un patient": { en: "Add patient", ar: "إضافة مريض" },
  "Ajouter patient": { en: "Add patient", ar: "إضافة مريض" },
  "Nouveau patient": { en: "New patient", ar: "مريض جديد" },
  "Ajouter maintenant": { en: "Add now", ar: "إضافة الآن" },
  "Étapes de création": { en: "Creation steps", ar: "خطوات الإنشاء" },
  "Données du patient mises à jour": { en: "Patient data updated", ar: "تم تحديث بيانات المريض" },
  "Aucune donnée patient disponible": { en: "No patient data available", ar: "لا توجد بيانات مريض متاحة" },
  "Chargement des données du patient...": { en: "Loading patient data...", ar: "جارٍ تحميل بيانات المريض..." },
  "Dossiers, fiches et assistant IA médical": { en: "Records, files, and medical AI assistant", ar: "الملفات والسجلات ومساعد الذكاء الاصطناعي الطبي" },
  "Consulter les patients": { en: "View patients", ar: "عرض المرضى" },
  "Documents patient": { en: "Patient documents", ar: "وثائق المريض" },
  "Ajouter documents": { en: "Add documents", ar: "إضافة وثائق" },
  "Ajoutez au moins un document.": { en: "Add at least one document.", ar: "أضف وثيقة واحدة على الأقل." },
  "Cliquez pour sélectionner des fichiers": { en: "Click to select files", ar: "انقر لاختيار الملفات" },
  "Ajouter un autre fichier": { en: "Add another file", ar: "إضافة ملف آخر" },
  "Aucun document selectionne.": { en: "No document selected.", ar: "لم يتم اختيار أي وثيقة." },
  "Aucun document a verifier.": { en: "No document to verify.", ar: "لا توجد وثيقة للتحقق." },
  "Analyse des documents en cours": { en: "Document analysis in progress", ar: "تحليل الوثائق جارٍ" },
  "Analyse des documents terminee": { en: "Document analysis complete", ar: "اكتمل تحليل الوثائق" },
  "Analyse apres import": { en: "Analysis after import", ar: "التحليل بعد الاستيراد" },
  "Aucune anomalie evidente n'a ete detectee dans le document selectionne.": { en: "No obvious anomaly was detected in the selected document.", ar: "لم يتم اكتشاف أي خلل واضح في الوثيقة المحددة." },
  "Ajouter un rendez-vous": { en: "Add appointment", ar: "إضافة موعد" },
  "Ajouter rendez-vous": { en: "Add appointment", ar: "إضافة موعد" },
  "Ajouter un RDV": { en: "Add appointment", ar: "إضافة موعد" },
  "Ajouter un Rendez-vous": { en: "Add appointment", ar: "إضافة موعد" },
  "Créer un rendez-vous pour cette session": { en: "Create an appointment for this session", ar: "إنشاء موعد لهذه الجلسة" },
  "Creer un RDV": { en: "Create appointment", ar: "إنشاء موعد" },
  "Rendez-vous": { en: "Appointment", ar: "موعد" },
  "Details rendez-vous": { en: "Appointment details", ar: "تفاصيل الموعد" },
  "Démarrer la consultation": { en: "Start consultation", ar: "بدء الاستشارة" },
  "Démarrer": { en: "Start", ar: "بدء" },
  "Consultation terminée": { en: "Consultation completed", ar: "اكتملت الاستشارة" },
  "Consultation enregistrée": { en: "Consultation saved", ar: "تم حفظ الاستشارة" },
  "Consultation ajoutee avec succes": { en: "Consultation added successfully", ar: "تمت إضافة الاستشارة بنجاح" },
  "Consultation modifiee avec succes": { en: "Consultation updated successfully", ar: "تم تعديل الاستشارة بنجاح" },
  "Consultation introuvable pour modification": { en: "Consultation not found for editing", ar: "لم يتم العثور على الاستشارة للتعديل" },
  "Ajouter consultation": { en: "Add consultation", ar: "إضافة استشارة" },
  "Description de la consultation": { en: "Consultation description", ar: "وصف الاستشارة" },
  "description de la consultation": { en: "consultation description", ar: "وصف الاستشارة" },
  "Diagnostic / Conclusion": { en: "Diagnosis / Conclusion", ar: "التشخيص / الخلاصة" },
  "Diagnostic ou motif clinique": { en: "Diagnosis or clinical reason", ar: "التشخيص أو السبب السريري" },
  "Diagnostic retenu, plan de traitement, observations…": { en: "Final diagnosis, treatment plan, notes...", ar: "التشخيص النهائي، خطة العلاج، الملاحظات..." },
  "Constantes vitales": { en: "Vital signs", ar: "المؤشرات الحيوية" },
  "Fréquence cardiaque": { en: "Heart rate", ar: "معدل ضربات القلب" },
  "Frequence cardiaque": { en: "Heart rate", ar: "معدل ضربات القلب" },
  "Examen clinique": { en: "Clinical exam", ar: "الفحص السريري" },
  "Aspect général": { en: "General appearance", ar: "المظهر العام" },
  "Aspect general": { en: "General appearance", ar: "المظهر العام" },
  "Examen cardiovasculaire": { en: "Cardiovascular exam", ar: "فحص القلب والأوعية" },
  "Examen respiratoire": { en: "Respiratory exam", ar: "فحص الجهاز التنفسي" },
  "Examen digestif": { en: "Digestive exam", ar: "فحص الجهاز الهضمي" },
  "Examen ORL": { en: "ENT exam", ar: "فحص الأنف والأذن والحنجرة" },
  "Examen cutane / muqueux": { en: "Skin / mucosal exam", ar: "فحص الجلد / الأغشية المخاطية" },
  "Examen endocrinien": { en: "Endocrine exam", ar: "فحص الغدد الصماء" },
  "Examen urinaire": { en: "Urinary exam", ar: "فحص الجهاز البولي" },
  "Examen genital": { en: "Genital exam", ar: "فحص الأعضاء التناسلية" },
  "Examen ganglionnaire": { en: "Lymph node exam", ar: "فحص العقد اللمفاوية" },
  "Ajouter suivi": { en: "Add follow-up", ar: "إضافة متابعة" },
  "Aucun suivi disponible": { en: "No follow-up available", ar: "لا توجد متابعة متاحة" },
  "Aucun suivi actif disponible. Creez d'abord un suivi.": { en: "No active follow-up available. Create a follow-up first.", ar: "لا توجد متابعة نشطة. أنشئ متابعة أولاً." },
  "Aucune consultation pour ce suivi.": { en: "No consultation for this follow-up.", ar: "لا توجد استشارة لهذه المتابعة." },
  "Aucun rendez-vous actif disponible.": { en: "No active appointment available.", ar: "لا يوجد موعد نشط متاح." },
  "Aucun rendez-vous à venir": { en: "No upcoming appointments", ar: "لا توجد مواعيد قادمة" },
  "Aucun rendez-vous à venir.": { en: "No upcoming appointments.", ar: "لا توجد مواعيد قادمة." },
  "Aucun rendez-vous ce jour.": { en: "No appointments today.", ar: "لا توجد مواعيد اليوم." },
  "Aucun rendez-vous pour ce patient.": { en: "No appointments for this patient.", ar: "لا توجد مواعيد لهذا المريض." },
  "Aucun rendez-vous pour cette période.": { en: "No appointments for this period.", ar: "لا توجد مواعيد لهذه الفترة." },
  "Aucun rendez-vous terminé n'est disponible pour enregistrer cette ordonnance.": { en: "No completed appointment is available to save this prescription.", ar: "لا يوجد موعد مكتمل متاح لحفظ هذه الوصفة." },
  "Aucun rendez-vous terminé trouvé pour ce suivi. Impossible d'attribuer le modèle.": { en: "No completed appointment found for this follow-up. Unable to assign the template.", ar: "لم يتم العثور على موعد مكتمل لهذه المتابعة. لا يمكن إسناد النموذج." },
  "Aucun rendez-vous terminé trouvé pour ce suivi. L'attribution est bloquée.": { en: "No completed appointment found for this follow-up. Assignment is blocked.", ar: "لم يتم العثور على موعد مكتمل لهذه المتابعة. تم حظر الإسناد." },
  "Aucun rendez-vous terminé trouvé pour ce suivi. La création d'ordonnance est bloquée.": { en: "No completed appointment found for this follow-up. Prescription creation is blocked.", ar: "لم يتم العثور على موعد مكتمل لهذه المتابعة. تم حظر إنشاء الوصفة." },
  "Aucun rendez-vous terminé trouvé pour ce suivi. La modification d'ordonnance est bloquée.": { en: "No completed appointment found for this follow-up. Prescription editing is blocked.", ar: "لم يتم العثور على موعد مكتمل لهذه المتابعة. تم حظر تعديل الوصفة." },
  "Aucun rendez-vous terminé trouvé pour ce suivi. La modification est bloquée.": { en: "No completed appointment found for this follow-up. Editing is blocked.", ar: "لم يتم العثور على موعد مكتمل لهذه المتابعة. تم حظر التعديل." },
  "Aucun rendez-vous terminé trouvé pour ce suivi. Une ordonnance nécessite un rendez-vous terminé.": { en: "No completed appointment found for this follow-up. A prescription requires a completed appointment.", ar: "لم يتم العثور على موعد مكتمل لهذه المتابعة. تتطلب الوصفة موعداً مكتملاً." },
  "Filtrer les rendez-vous par statut": { en: "Filter appointments by status", ar: "تصفية المواعيد حسب الحالة" },
  "Filtrer les rendez-vous par type": { en: "Filter appointments by type", ar: "تصفية المواعيد حسب النوع" },
  "Filtrer par statut": { en: "Filter by status", ar: "تصفية حسب الحالة" },
  "Filtrer par type": { en: "Filter by type", ar: "تصفية حسب النوع" },
  "Filtrer par": { en: "Filter by", ar: "تصفية حسب" },
  "Confirmé": { en: "Confirmed", ar: "مؤكد" },
  "Annulé": { en: "Canceled", ar: "ملغى" },
  "Bloqué": { en: "Blocked", ar: "محظور" },
  "Émis": { en: "Issued", ar: "صادر" },
  "Début": { en: "Start", ar: "البداية" },
  "Durée": { en: "Duration", ar: "المدة" },
  "Durée invalide": { en: "Invalid duration", ar: "مدة غير صالحة" },
  "Date et heure de début obligatoires. L'heure de fin doit rester après le début.": { en: "Start date and time are required. End time must remain after start time.", ar: "تاريخ ووقت البداية مطلوبان. يجب أن يكون وقت النهاية بعد البداية." },
  "Ajouter un médicament": { en: "Add medication", ar: "إضافة دواء" },
  "Ajouter un medicament": { en: "Add medication", ar: "إضافة دواء" },
  "Ajouter un nouveau médicament": { en: "Add new medication", ar: "إضافة دواء جديد" },
  "Aucun médicament": { en: "No medication", ar: "لا يوجد دواء" },
  "Aucun médicament trouvé": { en: "No medication found", ar: "لم يتم العثور على دواء" },
  "Aucun médicament trouvé.": { en: "No medication found.", ar: "لم يتم العثور على دواء." },
  "Aucun médicament ne correspond à vos critères de recherche.": { en: "No medication matches your search criteria.", ar: "لا يوجد دواء يطابق معايير البحث." },
  "Catalogue, recherche et enrichissement des fiches": { en: "Catalog, search, and record enrichment", ar: "الفهرس والبحث وإثراء السجلات" },
  "Catégorie": { en: "Category", ar: "الفئة" },
  "Choisir une catégorie": { en: "Choose a category", ar: "اختر فئة" },
  "Classe thérapeutique": { en: "Therapeutic class", ar: "الفئة العلاجية" },
  "Famille pharmacologique": { en: "Pharmacological family", ar: "العائلة الدوائية" },
  "DCI / Nom du médicament": { en: "INN / Medication name", ar: "الاسم الدولي / اسم الدواء" },
  "Dose maximale": { en: "Maximum dose", ar: "الجرعة القصوى" },
  "Fréquence d'administration": { en: "Administration frequency", ar: "تكرار الإعطاء" },
  "Effets indésirables": { en: "Side effects", ar: "الآثار الجانبية" },
  "Effets indesirables": { en: "Side effects", ar: "الآثار الجانبية" },
  "Ajouter un autre médicament": { en: "Add another medication", ar: "إضافة دواء آخر" },
  "Ajoutez au moins un médicament valide.": { en: "Add at least one valid medication.", ar: "أضف دواءً صالحاً واحداً على الأقل." },
  "Chaque médicament doit être sélectionné dans la recherche et avoir une posologie.": { en: "Each medication must be selected from search and have a dosage.", ar: "يجب اختيار كل دواء من البحث وإدخال الجرعة." },
  "Chaque médicament renseigné doit être sélectionné et avoir une posologie.": { en: "Each entered medication must be selected and have a dosage.", ar: "يجب اختيار كل دواء مُدخل وإدخال الجرعة." },
  "Analyse securite ordonnance": { en: "Prescription safety analysis", ar: "تحليل أمان الوصفة" },
  "Analyse sécurité ordonnance": { en: "Prescription safety analysis", ar: "تحليل أمان الوصفة" },
  "Analyse indisponible": { en: "Analysis unavailable", ar: "التحليل غير متاح" },
  "Analyse en cours sur les medicaments confirmes...": { en: "Analyzing confirmed medications...", ar: "جارٍ تحليل الأدوية المؤكدة..." },
  "Analyse de securite indisponible. Vous pouvez tout de meme enregistrer l'ordonnance.": { en: "Safety analysis unavailable. You can still save the prescription.", ar: "تحليل الأمان غير متاح. لا يزال بإمكانك حفظ الوصفة." },
  "Aucune alerte critique n'a ete relevee dans ce controle rapide.": { en: "No critical alert was found in this quick check.", ar: "لم يتم العثور على أي تنبيه حرج في هذا الفحص السريع." },
  "Aucun signal de securite detecte sur les medicaments confirmes. L'enregistrement reste disponible.": { en: "No safety signal detected on confirmed medications. Saving remains available.", ar: "لم يتم اكتشاف أي إشارة أمان في الأدوية المؤكدة. لا يزال الحفظ متاحاً." },
  "Aucun signal de securite detecte pour ce médicament dans l'ensemble confirmé actuel.": { en: "No safety signal detected for this medication in the current confirmed set.", ar: "لم يتم اكتشاف أي إشارة أمان لهذا الدواء ضمن المجموعة المؤكدة الحالية." },
  "Alertes globales": { en: "Global alerts", ar: "تنبيهات عامة" },
  "Alertes par medicament": { en: "Alerts by medication", ar: "تنبيهات حسب الدواء" },
  "Arguments en faveur": { en: "Supporting arguments", ar: "الحجج الداعمة" },
  "Aide au brouillon d'ordonnance uniquement. La decision finale et la prescription appartiennent toujours au medecin.": { en: "Prescription draft assistance only. The final decision and prescription always belong to the doctor.", ar: "مساعدة لصياغة الوصفة فقط. القرار النهائي والوصفة دائماً من مسؤولية الطبيب." },
  "doivent être validées par le médecin": { en: "must be validated by the doctor", ar: "يجب أن يعتمدها الطبيب" },
  "doivent etre validees par le medecin": { en: "must be validated by the doctor", ar: "يجب أن يعتمدها الطبيب" },
  "Finalisez la rédaction puis cliquez sur confirmer pour inclure ce médicament dans l'analyse.": { en: "Finish drafting, then click confirm to include this medication in the analysis.", ar: "أنهِ الصياغة ثم انقر على تأكيد لإدراج هذا الدواء في التحليل." },
  "Confirmez un medicament redige pour l'inclure dans l'analyse. Les interactions sont verifiees sur l'ensemble actuellement confirme.": { en: "Confirm a drafted medication to include it in the analysis. Interactions are checked against the currently confirmed set.", ar: "أكد دواءً محرراً لإدراجه في التحليل. يتم التحقق من التداخلات ضمن المجموعة المؤكدة حالياً." },
  "Ce médicament a été modifié après analyse. Reconfirmez-le pour relancer la vérification avec l'ensemble confirmé actuel.": { en: "This medication was edited after analysis. Reconfirm it to rerun verification with the current confirmed set.", ar: "تم تعديل هذا الدواء بعد التحليل. أعد تأكيده لتشغيل التحقق مع المجموعة المؤكدة الحالية." },
  "Ordonnance": { en: "Prescription", ar: "وصفة" },
  "Créer une ordonnance": { en: "Create prescription", ar: "إنشاء وصفة" },
  "Aperçu de l'ordonnance": { en: "Prescription preview", ar: "معاينة الوصفة" },
  "Aperçu indisponible": { en: "Preview unavailable", ar: "المعاينة غير متاحة" },
  "Enregistrez d'abord l'ordonnance pour la prévisualiser.": { en: "Save the prescription first to preview it.", ar: "احفظ الوصفة أولاً لمعاينتها." },
  "Consultez vos ordonnances récentes et créez de nouveaux modèles": { en: "Review recent prescriptions and create new templates", ar: "راجع الوصفات الحديثة وأنشئ نماذج جديدة" },
  "Aucune ordonnance récente disponible pour tester.": { en: "No recent prescription available to test.", ar: "لا توجد وصفة حديثة متاحة للاختبار." },
  "Aucune ordonnance récente ne correspond à cette recherche.": { en: "No recent prescription matches this search.", ar: "لا توجد وصفة حديثة تطابق هذا البحث." },
  "Aucune prescription récente": { en: "No recent prescription", ar: "لا توجد وصفة حديثة" },
  "Certaines données de la page Ordonnances n&apos;ont pas pu être chargées.": { en: "Some prescription page data could not be loaded.", ar: "تعذر تحميل بعض بيانات صفحة الوصفات." },
  "Choisir un template d'impression": { en: "Choose a print template", ar: "اختر نموذج الطباعة" },
  "Configurer le template Ordonnance": { en: "Configure prescription template", ar: "إعداد نموذج الوصفة" },
  "Configurer le mapping": { en: "Configure mapping", ar: "إعداد الربط" },
  "Configuration du template Ordonnance enregistrée.": { en: "Prescription template configuration saved.", ar: "تم حفظ إعداد نموذج الوصفة." },
  "Templates Ordonnance personnels": { en: "Personal prescription templates", ar: "نماذج الوصفات الشخصية" },
  "Aucun PDF personnel importé pour le moment.": { en: "No personal PDF imported yet.", ar: "لم يتم استيراد أي PDF شخصي بعد." },
  "Ce template importé n'est pas un PDF valide. Supprimez-le puis importez un vrai fichier PDF.": { en: "This imported template is not a valid PDF. Delete it, then import a real PDF file.", ar: "هذا النموذج المستورد ليس ملف PDF صالحاً. احذفه ثم استورد ملف PDF حقيقياً." },
  "Généré automatiquement avec le layout standard.": { en: "Generated automatically with the standard layout.", ar: "تم إنشاؤه تلقائياً بالتخطيط القياسي." },
  "Déplacez les rectangles et tirez le point bleu pour ajuster la taille. L’aperçu utilise le même système de coordonnées que l’export PDF final.": { en: "Move the rectangles and drag the blue point to adjust size. The preview uses the same coordinate system as the final PDF export.", ar: "حرّك المستطيلات واسحب النقطة الزرقاء لضبط الحجم. تستخدم المعاينة نفس نظام الإحداثيات الخاص بتصدير PDF النهائي." },
  "Activez uniquement ce qui existe sur ce PDF.": { en: "Enable only what exists on this PDF.", ar: "فعّل فقط ما يوجد في ملف PDF هذا." },
  "Champs à imprimer": { en: "Fields to print", ar: "الحقول المراد طباعتها" },
  "Asset importé.": { en: "Asset imported.", ar: "تم استيراد الأصل." },
  "Asset supprimé.": { en: "Asset deleted.", ar: "تم حذف الأصل." },
  "Échec de l'import": { en: "Import failed", ar: "فشل الاستيراد" },
  "Fermer l'aperçu": { en: "Close preview", ar: "إغلاق المعاينة" },
  "Fermer l'utilisation du modèle": { en: "Close template use", ar: "إغلاق استخدام النموذج" },
  "Fermer la configuration": { en: "Close configuration", ar: "إغلاق الإعداد" },
  "Fermer la modification": { en: "Close editing", ar: "إغلاق التعديل" },
  "Assistant IA": { en: "AI assistant", ar: "مساعد الذكاء الاصطناعي" },
  "Générer IA": { en: "Generate with AI", ar: "إنشاء بالذكاء الاصطناعي" },
  "Accepter l&apos;ordonnance": { en: "Accept prescription", ar: "قبول الوصفة" },
  "Action manuelle": { en: "Manual action", ar: "إجراء يدوي" },
  "Actions suggerees": { en: "Suggested actions", ar: "إجراءات مقترحة" },
  "Aucune recommandation fiable n'a pu être produite pour ce contexte.": { en: "No reliable recommendation could be produced for this context.", ar: "تعذر إنتاج توصية موثوقة لهذا السياق." },
  "Cette suggestion n'a pas d'action automatique.": { en: "This suggestion has no automatic action.", ar: "لا يوجد إجراء تلقائي لهذه الاقتراح." },
  "Cette suggestion ne peut pas etre appliquee automatiquement.": { en: "This suggestion cannot be applied automatically.", ar: "لا يمكن تطبيق هذا الاقتراح تلقائياً." },
  "Générez une proposition ou rédigez directement le courrier.": { en: "Generate a proposal or write the letter directly.", ar: "أنشئ اقتراحاً أو اكتب الرسالة مباشرة." },
  "Contenu complet de la lettre...": { en: "Full letter content...", ar: "المحتوى الكامل للرسالة..." },
  "Certificats médicaux": { en: "Medical certificates", ar: "الشهادات الطبية" },
  "Certificat médical enregistré.": { en: "Medical certificate saved.", ar: "تم حفظ الشهادة الطبية." },
  "Certificat médical supprimé": { en: "Medical certificate deleted", ar: "تم حذف الشهادة الطبية" },
  "Aucun certificat médical": { en: "No medical certificate", ar: "لا توجد شهادة طبية" },
  "Contenu du certificat, restrictions, durée, observations...": { en: "Certificate content, restrictions, duration, notes...", ar: "محتوى الشهادة والقيود والمدة والملاحظات..." },
  "Arrêt de travail": { en: "Sick leave", ar: "توقف عن العمل" },
  "Avis spécialisé": { en: "Specialist opinion", ar: "رأي متخصص" },
  "Évaluation spécialisée": { en: "Specialized evaluation", ar: "تقييم متخصص" },
  "Nouvelle lettre d'orientation": { en: "New referral letter", ar: "رسالة توجيه جديدة" },
  "Aucune lettre d'orientation": { en: "No referral letter", ar: "لا توجد رسالة توجيه" },
  "Vaccinations": { en: "Vaccinations", ar: "اللقاحات" },
  "Ajouter une vaccination": { en: "Add vaccination", ar: "إضافة لقاح" },
  "Aucune vaccination enregistrée": { en: "No vaccination recorded", ar: "لا توجد لقاحات مسجلة" },
  "Aucune vaccination enregistrée pour ce patient.": { en: "No vaccination recorded for this patient.", ar: "لا توجد لقاحات مسجلة لهذا المريض." },
  "Date de vaccination invalide": { en: "Invalid vaccination date", ar: "تاريخ لقاح غير صالح" },
  "Dernier vaccin": { en: "Last vaccine", ar: "آخر لقاح" },
  "DATE DE VACCINATION": { en: "VACCINATION DATE", ar: "تاريخ اللقاح" },
  "Confirmer la suppression de cette vaccination ?": { en: "Confirm deletion of this vaccination?", ar: "تأكيد حذف هذا اللقاح؟" },
  "Voyages": { en: "Travel", ar: "السفر" },
  "Ajouter un voyage": { en: "Add trip", ar: "إضافة سفر" },
  "Aucun voyage enregistré": { en: "No trip recorded", ar: "لا يوجد سفر مسجل" },
  "Aucun voyage enregistré pour ce patient.": { en: "No trip recorded for this patient.", ar: "لا يوجد سفر مسجل لهذا المريض." },
  "Confirmer la suppression de ce voyage ?": { en: "Confirm deletion of this trip?", ar: "تأكيد حذف هذا السفر؟" },
  "ÉPIDÉMIES À DESTINATION": { en: "OUTBREAKS AT DESTINATION", ar: "الأوبئة في الوجهة" },
  "Aucune épidémie renseignée": { en: "No outbreak entered", ar: "لم يتم إدخال أي وباء" },
  "Antécédents": { en: "Medical history", ar: "السوابق الطبية" },
  "Antécédents médicaux": { en: "Medical history", ar: "السوابق الطبية" },
  "Antécédents personnels": { en: "Personal history", ar: "السوابق الشخصية" },
  "Antécédents familiaux": { en: "Family history", ar: "السوابق العائلية" },
  "ANTÉCÉDENTS PERSONNELS": { en: "PERSONAL HISTORY", ar: "السوابق الشخصية" },
  "ANTÉCÉDENTS FAMILIAUX": { en: "FAMILY HISTORY", ar: "السوابق العائلية" },
  "ANTECEDENTS PERSONNELS": { en: "PERSONAL HISTORY", ar: "السوابق الشخصية" },
  "ANTECEDENTS FAMILIAUX": { en: "FAMILY HISTORY", ar: "السوابق العائلية" },
  "Ajouter un antécédent": { en: "Add history item", ar: "إضافة سابق طبي" },
  "Ajouter un antecedent": { en: "Add history item", ar: "إضافة سابق طبي" },
  "Antécédent *": { en: "History item *", ar: "السابق الطبي *" },
  "Antécédent personnel ajouté": { en: "Personal history added", ar: "تمت إضافة السابق الشخصي" },
  "Antécédent personnel modifié": { en: "Personal history updated", ar: "تم تعديل السابق الشخصي" },
  "Antécédent personnel marqué inactif": { en: "Personal history marked inactive", ar: "تم وضع السابق الشخصي كغير نشط" },
  "Antécédent personnel réactivé": { en: "Personal history reactivated", ar: "تمت إعادة تفعيل السابق الشخصي" },
  "Antécédent familial ajouté": { en: "Family history added", ar: "تمت إضافة السابق العائلي" },
  "Antécédent familial modifié": { en: "Family history updated", ar: "تم تعديل السابق العائلي" },
  "Antécédent supprimé": { en: "History item deleted", ar: "تم حذف السابق الطبي" },
  "Aucun antécédent personnel associé": { en: "No personal history associated", ar: "لا توجد سوابق شخصية مرتبطة" },
  "Aucun antécédent personnel enregistré": { en: "No personal history recorded", ar: "لا توجد سوابق شخصية مسجلة" },
  "Aucun antécédent familial enregistré": { en: "No family history recorded", ar: "لا توجد سوابق عائلية مسجلة" },
  "Antecedent introuvable": { en: "History item not found", ar: "لم يتم العثور على السابق الطبي" },
  "Traitements": { en: "Treatments", ar: "العلاجات" },
  "Ajouter un traitement": { en: "Add treatment", ar: "إضافة علاج" },
  "Aucun traitement dans l'historique": { en: "No treatment in history", ar: "لا يوجد علاج في السجل" },
  "Pathologie": { en: "Condition", ar: "الحالة المرضية" },
  "Ex : Migraine, Hernie discale, Diabete type 2...": { en: "Ex: Migraine, herniated disc, type 2 diabetes...", ar: "مثال: الشقيقة، انزلاق غضروفي، سكري النوع 2..." },
  "Ex: Diabète type 2, Hypertension...": { en: "Ex: Type 2 diabetes, hypertension...", ar: "مثال: سكري النوع 2، ارتفاع ضغط الدم..." },
  "Ex: Diagnostiqué en 2020, sous traitement...": { en: "Ex: Diagnosed in 2020, under treatment...", ar: "مثال: شُخّص في 2020، تحت العلاج..." },
  "Info sociale": { en: "Social information", ar: "المعلومات الاجتماعية" },
  "Assuré": { en: "Insured", ar: "مؤمّن" },
  "Assuré :": { en: "Insured:", ar: "مؤمّن:" },
  "Célibataire": { en: "Single", ar: "أعزب/عزباء" },
  "Marié(e)": { en: "Married", ar: "متزوج/ة" },
  "Divorcé(e)": { en: "Divorced", ar: "مطلق/ة" },
  "Veuf(ve)": { en: "Widowed", ar: "أرمل/ة" },
  "Profession": { en: "Profession", ar: "المهنة" },
  "Nationalité": { en: "Nationality", ar: "الجنسية" },
  "Groupe sanguin": { en: "Blood group", ar: "فصيلة الدم" },
  "Age de circoncision": { en: "Circumcision age", ar: "سن الختان" },
  "Revenu mensuel": { en: "Monthly income", ar: "الدخل الشهري" },
  "Taille du ménage": { en: "Household size", ar: "حجم الأسرة" },
  "Nombre de pièces": { en: "Number of rooms", ar: "عدد الغرف" },
  "Nombre d'enfants": { en: "Number of children", ar: "عدد الأطفال" },
  "Activité physique régulière, alimentation équilibrée…": { en: "Regular physical activity, balanced diet...", ar: "نشاط بدني منتظم، غذاء متوازن..." },
  "Habitudes saines": { en: "Healthy habits", ar: "العادات الصحية" },
  "Habitudes toxiques": { en: "Risk habits", ar: "العادات الضارة" },
  "Environnement animal": { en: "Animal environment", ar: "البيئة الحيوانية" },
  "Relations environnementales": { en: "Environmental relationships", ar: "العلاقات البيئية" },
  "Effacer la recherche": { en: "Clear search", ar: "مسح البحث" },
  "Effacer habitudes saines": { en: "Clear healthy habits", ar: "مسح العادات الصحية" },
  "Effacer habitudes toxiques": { en: "Clear risk habits", ar: "مسح العادات الضارة" },
  "Effacer environnement animal": { en: "Clear animal environment", ar: "مسح البيئة الحيوانية" },
  "Effacer relations environnementales": { en: "Clear environmental relationships", ar: "مسح العلاقات البيئية" },
  "Augmenter la taille du ménage": { en: "Increase household size", ar: "زيادة حجم الأسرة" },
  "Diminuer la taille du ménage": { en: "Decrease household size", ar: "تقليل حجم الأسرة" },
  "Augmenter le nombre de pièces": { en: "Increase number of rooms", ar: "زيادة عدد الغرف" },
  "Diminuer le nombre de pièces": { en: "Decrease number of rooms", ar: "تقليل عدد الغرف" },
  "Augmenter le nombre d'enfants": { en: "Increase number of children", ar: "زيادة عدد الأطفال" },
  "Diminuer le nombre d'enfants": { en: "Decrease number of children", ar: "تقليل عدد الأطفال" },
  "Santé féminine": { en: "Women's health", ar: "صحة المرأة" },
  "Âge des premières règles": { en: "Age at first period", ar: "سن أول دورة شهرية" },
  "Age des premieres regles": { en: "Age at first period", ar: "سن أول دورة شهرية" },
  "Âge de la ménopause": { en: "Age at menopause", ar: "سن انقطاع الطمث" },
  "Age de la menopause": { en: "Age at menopause", ar: "سن انقطاع الطمث" },
  "Âge de ménopause": { en: "Menopause age", ar: "سن انقطاع الطمث" },
  "Absents (Aménorrhée)": { en: "Absent (Amenorrhea)", ar: "منقطعة (انقطاع الطمث)" },
  "Absents (Amenorrhee)": { en: "Absent (Amenorrhea)", ar: "منقطعة (انقطاع الطمث)" },
  "Ex : Pilule, DIU, Aucune…": { en: "Ex: Pill, IUD, none...", ar: "مثال: حبوب منع الحمل، لولب، لا شيء..." },
  "Ex : Bouffées de chaleur…": { en: "Ex: Hot flashes...", ar: "مثال: هبات ساخنة..." },
  "Foire aux questions": { en: "Frequently asked questions", ar: "الأسئلة الشائعة" },
  "Foire Aux Questions": { en: "Frequently Asked Questions", ar: "الأسئلة الشائعة" },
  "Dans cet article": { en: "In this article", ar: "في هذا المقال" },
  "Contacter le support": { en: "Contact support", ar: "الاتصال بالدعم" },
  "Connexion, mot de passe, récupération de compte": { en: "Sign-in, password, account recovery", ar: "تسجيل الدخول وكلمة المرور واستعادة الحساب" },
  "Agenda & Rendez-vous": { en: "Calendar & Appointments", ar: "الأجندة والمواعيد" },
  "Conçu pour simplifier la pratique médicale": { en: "Designed to simplify medical practice", ar: "مصمم لتبسيط الممارسة الطبية" },
  "Absolument pas. L'IA de Doctor.com est un outil d'assistance à la prescription. Elle est là pour vous suggérer des pistes, mais la décision finale reste toujours médicale.": { en: "Not at all. Doctor.com AI is a prescription assistance tool. It suggests options, but the final decision always remains medical.", ar: "إطلاقاً. ذكاء Doctor.com الاصطناعي أداة مساعدة للوصفات. يقترح مسارات، لكن القرار النهائي يبقى دائماً طبياً." },
  "Actuellement, la fusion automatique de dossiers n'est pas disponible. Contactez l'équipe support pour gérer les cas doublons.": { en: "Automatic record merging is not currently available. Contact support to handle duplicate cases.", ar: "دمج الملفات تلقائياً غير متاح حالياً. اتصل بفريق الدعم لمعالجة الحالات المكررة." },
};

const TRANSLATIONS = {
  fr: {
    sidebar: {
      accueil: "Accueil",
      patients: "Patients",
      agenda: "Agenda",
      ordonnances: "Ordonnances",
      medicaments: "Médicaments",
      parametres: "Paramètres",
      aide: "Aide et Assistance",
      logout: "Se déconnecter",
      primaryNavigation: "Navigation principale",
      secondaryNavigation: "Navigation secondaire",
      currentUser: "Profil utilisateur actuel",
    },
    settings: {
      title: "Paramètres",
      subtitle:
        "Modifiez vos informations, gérez la sécurité de votre compte et ajustez vos préférences en toute simplicité.",
      userProfile: "Profil utilisateur",
      profile: "Profil",
      fullName: "Nom complet",
      firstName: "Prénom",
      lastName: "Nom",
      email: "Adresse e-mail",
      phone: "Numéro de téléphone",
      cabinetAddress: "Adresse du cabinet",
      preferences: "Préférences",
      interfaceLanguage: "Langue de l'interface",
      french: "Français",
      arabic: "Arabe",
      english: "Anglais",
      security: "Sécurité",
      changeNow: "Changer maintenant",
      passwordHelp:
        "Remplacez-le avec votre mot de passe actuel. Cette option met à jour votre accès immédiatement.",
      changePassword: "Changer le mot de passe",
      cancel: "Annuler",
      save: "Enregistrer les modifications",
      saving: "Enregistrement...",
      profileLoadError: "Impossible de charger votre profil.",
      noChanges: "Aucune modification à enregistrer.",
      nameRequired: "Le nom et le prénom sont requis.",
      contactRequired: "Le téléphone et l'adresse du cabinet sont requis.",
      saved: "Paramètres enregistrés.",
      saveError: "Impossible d'enregistrer les paramètres.",
      passwordChangedTitle: "Mot de passe modifié",
      passwordChangedDescription:
        "Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant l'utiliser pour vos prochaines connexions.",
      aiAssistant: "Assistant IA",
      aiProvider: "Fournisseur IA",
      cloudGeminiActive: "Gemini cloud est utilisé pour les réponses IA.",
      localGemmaActive: "Gemma local est utilisé pour les réponses IA.",
      cloudGemini: "Gemini cloud",
      localGemma: "Gemma local",
      aiFallbackHint:
        "Sans clé Gemini valide, l'application bascule automatiquement vers le modèle local.",
      geminiApiKey: "Clé API Gemini",
      apiKeyConfigured: "Clé configurée",
      apiKeyPlaceholder: "Collez la clé API Gemini",
      apiKeyMissing: "Aucune clé Gemini",
      saveAISettings: "Enregistrer l'IA",
      clearApiKey: "Effacer la clé",
      localModelReady: "Modèle local installé",
      localModelMissing: "Modèle local absent",
      ollamaService: "Service Ollama",
      localModelInstalled: "Modèle installé",
      localModelLoaded: "Modèle chargé",
      downloadingModel: "Téléchargement...",
      downloadLocalModel: "Télécharger",
      deletingModel: "Suppression...",
      deleteLocalModel: "Supprimer",
      aiSettingsSaved: "Paramètres IA enregistrés.",
      localModelDownloaded: "Modèle local téléchargé.",
      localModelDeleted: "Modèle local supprimé.",
      localModelError: "Impossible de gérer le modèle local.",
      finish: "Terminer",
    },
  },
  ar: {
    sidebar: {
      accueil: "الرئيسية",
      patients: "المرضى",
      agenda: "المواعيد",
      ordonnances: "الوصفات",
      medicaments: "الأدوية",
      parametres: "الإعدادات",
      aide: "المساعدة والدعم",
      logout: "تسجيل الخروج",
      primaryNavigation: "التنقل الرئيسي",
      secondaryNavigation: "التنقل الثانوي",
      currentUser: "ملف المستخدم الحالي",
    },
    settings: {
      title: "الإعدادات",
      subtitle:
        "عدّل معلوماتك، وأدر أمان حسابك، واضبط تفضيلاتك بسهولة.",
      userProfile: "ملف المستخدم",
      profile: "الملف الشخصي",
      fullName: "الاسم الكامل",
      firstName: "الاسم الشخصي",
      lastName: "اللقب",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      cabinetAddress: "عنوان العيادة",
      preferences: "التفضيلات",
      interfaceLanguage: "لغة الواجهة",
      french: "Français",
      arabic: "العربية",
      english: "English",
      security: "الأمان",
      changeNow: "تغيير الآن",
      passwordHelp:
        "استبدله باستخدام كلمة المرور الحالية. يحدّث هذا الخيار وصولك مباشرة.",
      changePassword: "تغيير كلمة المرور",
      cancel: "إلغاء",
      save: "حفظ التعديلات",
      saving: "جارٍ الحفظ...",
      profileLoadError: "تعذر تحميل ملفك الشخصي.",
      noChanges: "لا توجد تعديلات للحفظ.",
      nameRequired: "الاسم واللقب مطلوبان.",
      contactRequired: "رقم الهاتف وعنوان العيادة مطلوبان.",
      saved: "تم حفظ الإعدادات.",
      saveError: "تعذر حفظ الإعدادات.",
      passwordChangedTitle: "تم تغيير كلمة المرور",
      passwordChangedDescription:
        "تم تحديث كلمة المرور بنجاح. يمكنك استخدامها في عمليات تسجيل الدخول القادمة.",
      aiAssistant: "مساعد الذكاء الاصطناعي",
      aiProvider: "مزود الذكاء الاصطناعي",
      cloudGeminiActive: "يُستخدم Gemini السحابي للردود الذكية.",
      localGemmaActive: "يُستخدم Gemma المحلي للردود الذكية.",
      cloudGemini: "Gemini السحابي",
      localGemma: "Gemma المحلي",
      aiFallbackHint:
        "بدون مفتاح Gemini صالح، ينتقل التطبيق تلقائياً إلى النموذج المحلي.",
      geminiApiKey: "مفتاح Gemini API",
      apiKeyConfigured: "المفتاح مضبوط",
      apiKeyPlaceholder: "ألصق مفتاح Gemini API",
      apiKeyMissing: "لا يوجد مفتاح Gemini",
      saveAISettings: "حفظ إعدادات الذكاء",
      clearApiKey: "حذف المفتاح",
      localModelReady: "النموذج المحلي مثبت",
      localModelMissing: "النموذج المحلي غير موجود",
      ollamaService: "خدمة Ollama",
      localModelInstalled: "النموذج مثبت",
      localModelLoaded: "النموذج محمل",
      downloadingModel: "جارٍ التنزيل...",
      downloadLocalModel: "تنزيل",
      deletingModel: "جارٍ الحذف...",
      deleteLocalModel: "حذف",
      aiSettingsSaved: "تم حفظ إعدادات الذكاء الاصطناعي.",
      localModelDownloaded: "تم تنزيل النموذج المحلي.",
      localModelDeleted: "تم حذف النموذج المحلي.",
      localModelError: "تعذر إدارة النموذج المحلي.",
      finish: "إنهاء",
    },
  },
  en: {
    sidebar: {
      accueil: "Home",
      patients: "Patients",
      agenda: "Calendar",
      ordonnances: "Prescriptions",
      medicaments: "Medications",
      parametres: "Settings",
      aide: "Help and Support",
      logout: "Sign out",
      primaryNavigation: "Primary navigation",
      secondaryNavigation: "Secondary navigation",
      currentUser: "Current user profile",
    },
    settings: {
      title: "Settings",
      subtitle:
        "Edit your information, manage account security, and adjust preferences with ease.",
      userProfile: "User profile",
      profile: "Profile",
      fullName: "Full name",
      firstName: "First name",
      lastName: "Last name",
      email: "Email address",
      phone: "Phone number",
      cabinetAddress: "Clinic address",
      preferences: "Preferences",
      interfaceLanguage: "Interface language",
      french: "Français",
      arabic: "Arabic",
      english: "English",
      security: "Security",
      changeNow: "Change now",
      passwordHelp:
        "Replace it using your current password. This option updates your access immediately.",
      changePassword: "Change password",
      cancel: "Cancel",
      save: "Save changes",
      saving: "Saving...",
      profileLoadError: "Unable to load your profile.",
      noChanges: "No changes to save.",
      nameRequired: "First and last name are required.",
      contactRequired: "Phone and clinic address are required.",
      saved: "Settings saved.",
      saveError: "Unable to save settings.",
      passwordChangedTitle: "Password changed",
      passwordChangedDescription:
        "Your password was updated successfully. You can now use it for future logins.",
      aiAssistant: "AI Assistant",
      aiProvider: "AI provider",
      cloudGeminiActive: "Cloud Gemini is used for AI responses.",
      localGemmaActive: "Local Gemma is used for AI responses.",
      cloudGemini: "Cloud Gemini",
      localGemma: "Local Gemma",
      aiFallbackHint:
        "Without a valid Gemini key, the app automatically falls back to the local model.",
      geminiApiKey: "Gemini API key",
      apiKeyConfigured: "Key configured",
      apiKeyPlaceholder: "Paste the Gemini API key",
      apiKeyMissing: "No Gemini key",
      saveAISettings: "Save AI",
      clearApiKey: "Clear key",
      localModelReady: "Local model installed",
      localModelMissing: "Local model missing",
      ollamaService: "Ollama service",
      localModelInstalled: "Model installed",
      localModelLoaded: "Model loaded",
      downloadingModel: "Downloading...",
      downloadLocalModel: "Download",
      deletingModel: "Deleting...",
      deleteLocalModel: "Delete",
      aiSettingsSaved: "AI settings saved.",
      localModelDownloaded: "Local model downloaded.",
      localModelDeleted: "Local model deleted.",
      localModelError: "Unable to manage the local model.",
      finish: "Done",
    },
  },
} as const;

export type SidebarTranslationKey = keyof typeof TRANSLATIONS.fr.sidebar;
type SettingsTranslationKey = keyof typeof TRANSLATIONS.fr.settings;

type LanguageContextValue = {
  hasStoredLanguagePreference: boolean;
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
  tx: (text: string) => string;
  t: {
    sidebar: Record<SidebarTranslationKey, string>;
    settings: Record<SettingsTranslationKey, string>;
  };
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function toInterfaceLanguage(
  value: string | null | undefined,
): InterfaceLanguage {
  return value === "ar" || value === "en" ? value : "fr";
}

function normalizeCopy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function translateCopy(value: string, language: InterfaceLanguage) {
  if (language === "fr") {
    return value;
  }

  const normalized = normalizeCopy(value);
  const translated = COPY_TRANSLATIONS[normalized]?.[language];
  if (!translated) {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

const originalTextNodes = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRIBUTES = [
  "aria-label",
  "alt",
  "placeholder",
  "title",
] as const;

function shouldTranslateTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent) {
    return false;
  }

  const tagName = parent.tagName.toLowerCase();
  return !["script", "style", "textarea", "code", "pre"].includes(tagName);
}

function translateElementCopy(root: ParentNode, language: InterfaceLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    if (!shouldTranslateTextNode(textNode)) {
      continue;
    }

    const storedOriginal = originalTextNodes.get(textNode);
    const currentValue = textNode.nodeValue ?? "";
    const previousTranslation = storedOriginal
      ? translateCopy(storedOriginal, language)
      : null;
    const original =
      storedOriginal && (currentValue === storedOriginal || currentValue === previousTranslation)
        ? storedOriginal
        : currentValue;
    const translated = translateCopy(original, language);
    if (translated !== original || originalTextNodes.has(textNode)) {
      originalTextNodes.set(textNode, original);
      if (textNode.nodeValue !== translated) {
        textNode.nodeValue = translated;
      }
    }
  }

  const elements =
    root instanceof Element
      ? [root, ...Array.from(root.querySelectorAll("*"))]
      : Array.from(root.querySelectorAll("*"));

  for (const element of elements) {
    for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attributeName)) {
        continue;
      }

      const attributeMap =
        originalAttributes.get(element) ?? new Map<string, string>();
      const storedOriginal = attributeMap.get(attributeName);
      const currentValue = element.getAttribute(attributeName) ?? "";
      const previousTranslation = storedOriginal
        ? translateCopy(storedOriginal, language)
        : null;
      const original =
        storedOriginal && (currentValue === storedOriginal || currentValue === previousTranslation)
          ? storedOriginal
          : currentValue;
      const translated = translateCopy(original, language);
      if (translated !== original || attributeMap.has(attributeName)) {
        attributeMap.set(attributeName, original);
        originalAttributes.set(element, attributeMap);
        if (element.getAttribute(attributeName) !== translated) {
          element.setAttribute(attributeName, translated);
        }
      }
    }
  }
}

export function InterfaceLanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [hasStoredLanguagePreference, setHasStoredLanguagePreference] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEY) !== null,
  );
  const [language, setLanguageState] = useState<InterfaceLanguage>(() => {
    if (typeof window === "undefined") return "fr";
    return toInterfaceLanguage(window.localStorage.getItem(STORAGE_KEY));
  });

  const setLanguage = useCallback((nextLanguage: InterfaceLanguage) => {
    setLanguageState(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    }
    setHasStoredLanguagePreference(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    translateElementCopy(document.body, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const textNode = mutation.target;
          if (textNode instanceof Text && shouldTranslateTextNode(textNode)) {
            const storedOriginal = originalTextNodes.get(textNode);
            const currentValue = textNode.nodeValue ?? "";
            const previousTranslation = storedOriginal
              ? translateCopy(storedOriginal, language)
              : null;
            const original =
              storedOriginal &&
              (currentValue === storedOriginal || currentValue === previousTranslation)
                ? storedOriginal
                : currentValue;
            const translated = translateCopy(original, language);
            if (translated !== textNode.nodeValue) {
              textNode.nodeValue = translated;
            }
          }
          continue;
        }

        if (mutation.type === "attributes") {
          const element = mutation.target;
          if (element instanceof Element) {
            translateElementCopy(element, language);
          }
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          if (addedNode instanceof Element || addedNode instanceof DocumentFragment) {
            translateElementCopy(addedNode, language);
          } else if (addedNode instanceof Text && shouldTranslateTextNode(addedNode)) {
            const original = addedNode.nodeValue ?? "";
            const translated = translateCopy(original, language);
            if (translated !== original) {
              originalTextNodes.set(addedNode, original);
              addedNode.nodeValue = translated;
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(
    () => ({
      hasStoredLanguagePreference,
      language,
      setLanguage,
      tx: (text: string) => translateCopy(text, language),
      t: TRANSLATIONS[language],
    }),
    [hasStoredLanguagePreference, language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useInterfaceLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useInterfaceLanguage must be used within provider");
  }
  return value;
}
