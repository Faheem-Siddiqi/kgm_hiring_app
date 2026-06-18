export type UserRecord = {
  id: string;
  phoneOrEmail: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TestAttemptRecord = {
  id: string;
  userId: string;
  status: "pending" | "in_progress" | "submitted";
  createdAt: Date;
  updatedAt: Date;
};
