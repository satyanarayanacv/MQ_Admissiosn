export type Role = "admin" | "reviewer" | "lecturer" | "office";

export type User = {
  id: string;
  username: string;
  email: string;
  role: Role;
  disabled?: boolean;
};

export type Applicant = {
  application_no: string;
  first_name: string;
  last_name: string;
  course: string;
  academic_year: string;
  email: string;
  mobile: string;
  quota: string;
  phase?: number | null;
  stage: string;
  score: number;
  documents: Record<string, boolean>;
  total_fee: number;
  paid: number;
  activity: string[];
};

export type Dashboard = {
  total: number;
  admitted: number;
  under_review: number;
  documents_pending: number;
  fees_collected: number;
  recent: Applicant[];
  alerts: { title: string; detail: string; tone: string }[];
};

export type Course = {
  code: string;
  name: string;
  department: string;
  seats: number;
  fee: number;
  academic_year: string;
};

export type Report = {
  total: number;
  by_stage: Record<string, number>;
  by_quota: Record<string, number>;
  by_course: { course: string; applicants: number; admitted: number; expected: number; collected: number }[];
  fees: { expected: number; collected: number; outstanding: number; collection_rate: number };
  share_text: string;
};
