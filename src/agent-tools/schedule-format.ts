import type { ScheduleJobDetail } from '../hub';
import { TOOL_RESULTS as RESULT } from '../prompts';

export const scheduleStatusLabel = (status: string) =>
  RESULT.scheduleStatus[status as keyof typeof RESULT.scheduleStatus] ?? status;

export const jobStatusLabel = (status: string) =>
  RESULT.scheduleJobStatus[status as keyof typeof RESULT.scheduleJobStatus] ?? status;

/**
 * job 목록을 표 행으로 옮긴다. project 열이 이 도구의 존재 이유다.
 *
 * 라벨과 원문 id 를 둘 다 낸다. 사용자가 묻는 것은 "내가 보낸 그 id 가 저장됐나" 인데,
 * 라벨만 내면 이름이 같은 프로젝트 둘을 구분할 수 없고 모델이 대조할 원문이 사라진다.
 * 저장되지 않은 값은 열을 지우지 않고 "저장 안 됨" 으로 남긴다. 열이 없으면
 * 모델이 확인했다고 착각한다 — 그게 이 도구를 만든 이유였던 그 사각지대다.
 *
 * 키 순서가 곧 열 순서이고, 비어 있어도 되는 열만 값이 없을 때 뺀다.
 * 글 주소 열 이름은 반드시 postUrl 이다. url 이면 tool-output 의 NOISY_KEYS 가 표에서 지운다.
 */
export const formatScheduleJobRows = (
  jobs: ScheduleJobDetail[],
  projectLabels: ReadonlyMap<string, string>,
): Record<string, string>[] =>
  jobs.map(({ keyword, scheduledAt, status, projectId, manuscriptType, businessName, postUrl, error }) => {
    const row: Record<string, string> = {
      keyword,
      scheduledAt,
      status: jobStatusLabel(status),
      project: projectId ? (projectLabels.get(projectId) ?? projectId) : RESULT.scheduleProjectMissing,
      projectId: projectId || RESULT.scheduleProjectMissing,
      manuscriptType: manuscriptType || RESULT.scheduleManuscriptTypeMissing,
    };

    if (businessName) row.businessName = businessName;
    if (postUrl) row.postUrl = postUrl;
    if (error) row.error = error;

    return row;
  });
