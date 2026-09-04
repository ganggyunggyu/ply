import axios from 'axios';
import { bearer } from './http';

export type DabutProject = {
  id: string;
  label: string;
  description: string;
  model: string;
  isActive: boolean;
};

/** 로그인한 계정이 만들어 둔 원고 프로젝트 목록. 프로젝트 = 원고 뽑는 방식. */
export const listDabutProjects = async (baseUrl: string, token?: string): Promise<DabutProject[]> => {
  const { data } = await axios.get(`${baseUrl}/projects`, { timeout: 15_000, headers: bearer(token) });
  const rows = Array.isArray(data) ? data : (data?.projects ?? data?.items ?? []);

  return (Array.isArray(rows) ? rows : [])
    .map((row: Record<string, unknown>) => ({
      id: String(row.id ?? row._id ?? ''),
      label: String(row.label ?? row.key ?? ''),
      description: String(row.description ?? ''),
      model: String(row.model ?? ''),
      isActive: row.is_active !== false,
    }))
    .filter((p) => p.id && p.isActive);
};

/** 프로젝트 상세. 목록보다 넓다 — 지침과 전후 스텝까지 들어온다. */
export type DabutProjectDetail = DabutProject & {
  key: string;
  systemPrompt: string;
  userPromptTemplate: string;
  preSteps: unknown[];
  postSteps: unknown[];
  dbCategory: string;
};

export const toProjectDetail = (row: Record<string, unknown>): DabutProjectDetail => ({
  id: String(row.id ?? row._id ?? ''),
  key: String(row.key ?? ''),
  label: String(row.label ?? row.key ?? ''),
  description: String(row.description ?? ''),
  model: String(row.model ?? ''),
  isActive: row.is_active !== false,
  systemPrompt: String(row.system_prompt ?? ''),
  userPromptTemplate: String(row.user_prompt_template ?? ''),
  preSteps: Array.isArray(row.pre_steps) ? row.pre_steps : [],
  postSteps: Array.isArray(row.post_steps) ? row.post_steps : [],
  dbCategory: String(row.db_category ?? ''),
});

export const getDabutProject = async (
  baseUrl: string,
  projectId: string,
  token?: string,
): Promise<DabutProjectDetail> => {
  const { data } = await axios.get(`${baseUrl}/projects/${encodeURIComponent(projectId)}`, {
    timeout: 15_000,
    headers: bearer(token),
  });

  return toProjectDetail(data as Record<string, unknown>);
};
