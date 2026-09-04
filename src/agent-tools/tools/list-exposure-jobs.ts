import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC } from '../../prompts';
import { PROGRESS } from '../../messages';
import { isExposureUnauthorized, listRemoteJobs } from '../../exposure-api';
import { listExposureJobs } from '../../hub';
import { createExposureSessionHelpers } from './exposure-session';
import type { ToolRuntime } from '../runtime';

export const createListExposureJobsTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { onProgress, getEndpoints, clearExposureCookie, remoteJobs } = runtime;

  const { exposureSession } = createExposureSessionHelpers(runtime);

  const listExposureJobsTool: ToolSpec = {
    name: 'list_exposure_jobs',
    description: DESC.listExposureJobs,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    /*
     * 노출지기에 로그인돼 있으면 서버 목록을 먼저 쓴다. 그쪽이 이 회원의 프리셋 기준으로
     * 걸러 준 것이고, 직접 만든 카페 체크(cafe-check:*)와 차단 사유까지 들어 있다.
     * 로컬 package.json 파싱은 EXPOSURE_JOB_LABELS 의 하드코딩 라벨 6개에 묶여 있고
     * 저장소 경로가 설정된 컴퓨터에서만 된다. 그래서 폴백으로 내린다.
     */
    run: async () => {
      const session = exposureSession();

      if (session.ok) {
        onProgress(PROGRESS.exposureJobsLoading);

        try {
          const jobs = await listRemoteJobs(session);

          remoteJobs.clear();
          jobs.forEach((job) => remoteJobs.set(job.id, job));

          if (jobs.length > 0) {
            return JSON.stringify(
              jobs.map(({ id, label, description, isRunning, isBlocked, blockReason }) => ({
                job: id,
                label,
                description,
                isRunning,
                ...(isBlocked ? { blocked: blockReason } : {}),
              })),
            );
          }
        } catch (error) {
          // 서버를 못 읽었다고 여기서 끝내지 않는다. 로컬 저장소가 있으면 그쪽으로 계속 간다.
          if (isExposureUnauthorized(error)) clearExposureCookie();
        }
      }

      const { exposureBotDir } = getEndpoints();
      if (!exposureBotDir) return session.ok ? RESULT.exposureNoRemoteJobs : session.result;

      const jobs = listExposureJobs(exposureBotDir);
      if (!jobs.length) return RESULT.exposureNoJobs(exposureBotDir);

      return JSON.stringify(jobs.map(({ key, label, description }) => ({ job: key, label, description })));
    },
  };

  return [listExposureJobsTool];
};
