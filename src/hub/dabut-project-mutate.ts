import axios from 'axios';
import { bearer } from './http';
import { toProjectDetail, type DabutProjectDetail } from './dabut-projects';

/**
 * 프로젝트 수정. 다붓의 PUT 은 보낸 필드만 바꾼다.
 * 스텝을 고치려는데 지침까지 실어 보내면 그쪽이 통째로 덮인다. 보낼 것만 담아라.
 */
export const updateDabutProject = async ({
  baseUrl,
  projectId,
  token,
  changes,
}: {
  baseUrl: string;
  projectId: string;
  token?: string;
  changes: Record<string, unknown>;
}): Promise<DabutProjectDetail> => {
  const { data } = await axios.put(
    `${baseUrl}/projects/${encodeURIComponent(projectId)}`,
    changes,
    { timeout: 20_000, headers: bearer(token) },
  );

  return toProjectDetail(data as Record<string, unknown>);
};

export const duplicateDabutProject = async (
  baseUrl: string,
  projectId: string,
  token?: string,
): Promise<DabutProjectDetail> => {
  const { data } = await axios.post(
    `${baseUrl}/projects/${encodeURIComponent(projectId)}/duplicate`,
    {},
    { timeout: 20_000, headers: bearer(token) },
  );

  return toProjectDetail(data as Record<string, unknown>);
};

/** 고를 수 있는 스텝 종류. 스텝을 고치기 전에 이걸로 이름과 설정 키를 확인한다. */
export const listDabutProjectSteps = async (baseUrl: string, token?: string): Promise<unknown[]> => {
  const { data } = await axios.get(`${baseUrl}/projects/steps`, {
    timeout: 15_000,
    headers: bearer(token),
  });

  return Array.isArray(data) ? data : [];
};
