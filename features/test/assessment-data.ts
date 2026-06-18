export type Question =
  | {
      id: string;
      prompt: string;
      type: "text";
    }
  | {
      id: string;
      prompt: string;
      type: "mcq";
      options: string[];
    };

export type AssessmentSection = {
  slug: string;
  title: string;
  time: string;
  questions: Question[];
};

export const assessmentSections: AssessmentSection[] = [
  {
    slug: "english",
    title: "English",
    time: "15 min",
    questions: [
      {
        id: "english-1",
        type: "text",
        prompt:
          "Write a short paragraph explaining why clear office communication matters.",
      },
      {
        id: "english-2",
        type: "mcq",
        prompt: "Choose the grammatically correct sentence.",
        options: [
          "The files were sent yesterday.",
          "The files was sent yesterday.",
          "The files is sent yesterday.",
          "The files has sent yesterday.",
        ],
      },
      {
        id: "english-3",
        type: "text",
        prompt: "Rewrite this line professionally: Send me those papers fast.",
      },
    ],
  },
  {
    slug: "general",
    title: "General Questions",
    time: "10 min",
    questions: [
      {
        id: "general-1",
        type: "text",
        prompt: "What is the purpose of keeping accurate office records?",
      },
      {
        id: "general-2",
        type: "text",
        prompt: "Name two qualities expected from an Assistant Admin Officer.",
      },
      {
        id: "general-3",
        type: "text",
        prompt:
          "How would you prioritize three urgent tasks received at the same time?",
      },
    ],
  },
  {
    slug: "admin-mcqs",
    title: "Admin MCQs",
    time: "20 min",
    questions: [
      {
        id: "admin-1",
        type: "mcq",
        prompt: "Which document is commonly used to request office supplies?",
        options: ["Purchase requisition", "Leave form", "Visitor pass", "Memo"],
      },
      {
        id: "admin-2",
        type: "mcq",
        prompt:
          "What is the best first step when a visitor arrives for a scheduled meeting?",
        options: [
          "Verify their appointment and inform the host",
          "Send them directly to the office",
          "Ask them to wait without checking",
          "Give them internal files",
        ],
      },
      {
        id: "admin-3",
        type: "mcq",
        prompt:
          "Which tool is most suitable for maintaining staff attendance records?",
        options: [
          "Attendance register or HR system",
          "Personal notebook",
          "Visitor log",
          "Invoice file",
        ],
      },
    ],
  },
];

export function getSectionBySlug(slug: string) {
  return assessmentSections.find((section) => section.slug === slug);
}

export function getNextSectionSlug(slug: string) {
  const index = assessmentSections.findIndex((section) => section.slug === slug);

  return assessmentSections[index + 1]?.slug;
}

export function getPreviousSectionSlug(slug: string) {
  const index = assessmentSections.findIndex((section) => section.slug === slug);

  return assessmentSections[index - 1]?.slug;
}
