export type Question =
  | {
      id: string;
      prompt: string;
      type: "text";
      timeLimitSeconds?: number;
    }
  | {
      id: string;
      prompt: string;
      type: "mcq";
      options: string[];
      correctAnswers?: string[];
      timeLimitSeconds?: number;
    }
  | {
      id: string;
      prompt: string;
      type: "multi";
      options: string[];
      minSelections: number;
      maxSelections: number;
      correctAnswers?: string[];
      timeLimitSeconds?: number;
    };

export type AssessmentSection = {
  slug: string;
  title: string;
  time: string;
  questionTimeSeconds?: number;
  questions: Question[];
};
