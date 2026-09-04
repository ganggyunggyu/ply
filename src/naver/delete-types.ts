export type DeleteStatus = 'deleted' | 'notFound' | 'titleMismatch' | 'unknown';

export type DeleteOutcome = {
  logNo: string;
  status: DeleteStatus;
  actualTitle?: string;
  message?: string;
};

export type DeleteSinglePostOptions = {
  blogId: string;
  logNo: string;
  expectedTitle: string;
  onProgress?: (message: string) => void;
};
