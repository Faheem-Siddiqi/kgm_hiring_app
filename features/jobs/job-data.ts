export type CandidateJob = {
  id: string;
  title: string;
  department: string;
  location: string;
  type: "Full-time" | "Contract" | "Internship";
  level: "Entry" | "Mid" | "Senior";
  createdAt: string;
  closingAt: string;
  assessment: string;
  salary: string;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  tags: string[];
};

export const candidateJobs: CandidateJob[] = [
  {
    id: "finance-officer",
    title: "Finance Officer",
    department: "Finance",
    location: "Karachi",
    type: "Full-time",
    level: "Mid",
    createdAt: "2026-06-18",
    closingAt: "2026-07-02",
    assessment: "Finance screening assessment",
    salary: "Market competitive",
    summary:
      "Support monthly reporting, reconciliations, vendor payments, and audit-ready documentation for KGM operations.",
    description:
      "This role is designed for a detail-oriented finance professional who can keep daily records accurate while supporting leadership with timely reporting. The assessment checks practical accounting judgment, Excel comfort, and attention to detail.",
    responsibilities: [
      "Prepare reconciliations and support month-end closing activities.",
      "Review invoices, payments, and supporting documents before approval.",
      "Coordinate with operations teams on expense records and reporting needs.",
      "Maintain audit-friendly files and flag gaps early.",
    ],
    requirements: [
      "Bachelor's degree in Finance, Accounting, or a related field.",
      "2+ years of relevant finance or accounts experience.",
      "Comfort with Excel, reconciliations, and documentation control.",
    ],
    tags: ["Accounts", "Excel", "Reporting"],
  },
  {
    id: "assistant-hr-officer",
    title: "Assistant HR Officer",
    department: "Human Resources",
    location: "Karachi",
    type: "Full-time",
    level: "Entry",
    createdAt: "2026-06-16",
    closingAt: "2026-06-30",
    assessment: "HR operations assessment",
    salary: "Market competitive",
    summary:
      "Assist with onboarding, employee records, attendance coordination, and recruitment documentation.",
    description:
      "The Assistant HR Officer supports day-to-day HR operations with clean records, responsive communication, and consistent follow-through. The assessment focuses on HR basics, communication, and workplace judgment.",
    responsibilities: [
      "Maintain employee files, onboarding checklists, and HR trackers.",
      "Support interview scheduling and candidate communication.",
      "Coordinate attendance and leave documentation with department leads.",
      "Prepare simple HR summaries for review.",
    ],
    requirements: [
      "Bachelor's degree in HR, Business Administration, or related discipline.",
      "Strong written communication and documentation habits.",
      "Ability to handle confidential employee information responsibly.",
    ],
    tags: ["HR", "Records", "Onboarding"],
  },
  {
    id: "admin-officer",
    title: "Admin Officer",
    department: "Administration",
    location: "Hyderabad",
    type: "Full-time",
    level: "Mid",
    createdAt: "2026-06-14",
    closingAt: "2026-07-05",
    assessment: "Administration assessment",
    salary: "Market competitive",
    summary:
      "Manage office coordination, vendor follow-ups, facility requests, and administrative reporting.",
    description:
      "This position keeps administrative work moving smoothly across teams. The assessment checks prioritization, communication, office process understanding, and practical decision-making.",
    responsibilities: [
      "Track office requests and coordinate timely resolution.",
      "Work with vendors on supplies, services, and documentation.",
      "Prepare administrative summaries and maintain records.",
      "Support internal teams with day-to-day coordination.",
    ],
    requirements: [
      "2+ years of administration or operations coordination experience.",
      "Good follow-up discipline and written communication skills.",
      "Comfort managing multiple small tasks without losing detail.",
    ],
    tags: ["Admin", "Coordination", "Vendors"],
  },
  {
    id: "assistant-manager-operations",
    title: "Assistant Manager Operations",
    department: "Operations",
    location: "Karachi",
    type: "Full-time",
    level: "Senior",
    createdAt: "2026-06-12",
    closingAt: "2026-07-10",
    assessment: "Operations leadership assessment",
    salary: "Market competitive",
    summary:
      "Lead daily operational follow-ups, team coordination, escalation tracking, and process improvement.",
    description:
      "The Assistant Manager Operations role suits someone who can translate business priorities into clean execution. The assessment reviews analytical thinking, leadership judgment, and operational discipline.",
    responsibilities: [
      "Monitor daily operations and escalate blockers with clear context.",
      "Coordinate cross-functional updates and performance follow-ups.",
      "Improve recurring workflows through simple, measurable process changes.",
      "Prepare concise operational reports for management review.",
    ],
    requirements: [
      "4+ years of operations, coordination, or team leadership experience.",
      "Strong analytical, communication, and ownership skills.",
      "Ability to manage competing priorities in a fast-moving environment.",
    ],
    tags: ["Operations", "Leadership", "Reporting"],
  },
];

export function getCandidateJob(jobId: string) {
  return candidateJobs.find((job) => job.id === jobId);
}
