export type PatientsFilter = "all" | "female" | "male";

export interface PatientViewModel {
  id: string;
  fullName: string;
  matricule: string;
  initials: string;
  ageText: string;
  sexeText: string;
  phoneText: string;
  emailText: string;
  conditionsText: string;
  bloodGroupText: string;
  searchableText: string;
}
