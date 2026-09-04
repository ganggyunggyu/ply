import axios from 'axios';
import { bearer } from './http';
import type { ImageSource, ManuscriptType } from '../scheduler-enums';

export type ProjectManuscript = {
  content: string;
  projectLabel: string;
  articleHtml?: string;
  imageCount: number;
};

/** 프로젝트의 모델·지침·전후 단계를 그대로 태워 원고를 뽑는다. */
export const generateManuscriptViaProject = async ({
  baseUrl,
  token,
  projectId,
  keyword,
  ref,
  businessName,
  withImages,
  signal,
}: {
  baseUrl: string;
  token: string;
  projectId: string;
  keyword: string;
  ref?: string;
  businessName?: string;
  withImages?: boolean;
  signal?: AbortSignal;
}): Promise<ProjectManuscript> => {
  const { data } = await axios.post(
    `${baseUrl}/generate/project`,
    {
      project_id: projectId,
      keyword,
      ref: ref ?? '',
      business_name: businessName ?? '',
      with_images: withImages ?? false,
    },
    { timeout: 600_000, headers: bearer(token), signal },
  );

  return {
    content: String(data?.content ?? ''),
    projectLabel: String(data?.project?.label ?? ''),
    articleHtml: data?.article_html ? String(data.article_html) : undefined,
    imageCount: Number(data?.total ?? 0),
  };
};
