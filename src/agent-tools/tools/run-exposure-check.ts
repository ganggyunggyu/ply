import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { runRemoteJob } from '../../exposure-api';
import { findExposureJob, runPackageScript } from '../../hub';
import { requestExposureRunApproval } from '../approval';
import { createExposureSessionHelpers } from './exposure-session';
import type { ToolRuntime } from '../runtime';

export const createRunExposureCheckTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { remoteJobs, onProgress, askUser, signal, getEndpoints } = runtime;

  const { exposureSession, describeExposureFailure } = createExposureSessionHelpers(runtime);

  const runExposureCheck: ToolSpec = {
    name: 'run_exposure_check',
    description:
      DESC.runExposureCheck,
    parameters: {
      type: 'object',
      properties: { job: { type: 'string', description: PARAM.exposureJob } },
      required: ['job'],
      additionalProperties: false,
    },
    run: async ({ job }) => {
      const wanted = String(job ?? '').trim();
      if (!wanted) return RESULT.unknownExposureJob;

      const session = exposureSession();
      const remote = remoteJobs.get(wanted);

      /*
       * 원격 실행 경로. 프롬프트만으로는 "카페노출체크하고싶어" 사고를 못 막는다.
       * delete_blog_posts 와 cancel_schedule 이 같은 사고를 안 내는 이유는 도구가 스스로
       * 확인 카드를 띄우기 때문이다. 여기도 같은 문을 단다.
       * 한 번 더 묻는 비용은 클릭 한 번이고, 잘못 시작하는 비용은 30분이다.
       */
      if (session.ok && remote) {
        if (remote.isBlocked) return RESULT.exposureRunBlocked(remote.label, remote.blockReason);

        onProgress(PROGRESS.exposureRunConfirmWaiting(remote.label));

        const { approved, answer, answered } = await requestExposureRunApproval({
          askUser,
          label: remote.label,
        });

        if (!approved) {
          return answered ? RESULT.exposureRunNotApproved(answer) : RESULT.exposureRunNoAnswer;
        }

        if (signal?.aborted) return RESULT.runStopped;

        onProgress(PROGRESS.exposureRemoteStarting(remote.label));

        try {
          const { runId } = await runRemoteJob({ ...session, jobId: remote.id });

          return RESULT.exposureRunStarted(remote.label, runId);
        } catch (error) {
          return describeExposureFailure(error);
        }
      }

      const { exposureBotDir } = getEndpoints();
      if (!exposureBotDir) return session.ok ? RESULT.unknownExposureJob : session.result;

      const target = findExposureJob(exposureBotDir, wanted);
      if (!target) return RESULT.unknownExposureJob;

      onProgress(PROGRESS.exposureRunConfirmWaiting(target.label));

      const { approved, answer, answered } = await requestExposureRunApproval({
        askUser,
        label: target.label,
      });

      if (!approved) {
        return answered ? RESULT.exposureRunNotApproved(answer) : RESULT.exposureRunNoAnswer;
      }

      if (signal?.aborted) return RESULT.runStopped;

      onProgress(PROGRESS.exposureStarting(target.label));

      /*
       * 30분까지 도는 자식 프로세스다. 정지를 눌러도 여기서 막혀 있으면 버튼이 아무 일도 안 하는
       * 것처럼 보인다. 네이버에 글을 쓰는 도구가 아니라 다시 돌리면 되는 로컬 점검이고,
       * 타임아웃 경로가 이미 같은 SIGTERM 을 보내고 있어서 새로 생기는 위험이 없다.
       */
      const result = await runPackageScript({
        cwd: exposureBotDir,
        script: target.script,
        onLine: (line) => onProgress(line.slice(0, 160)),
        signal,
      }).catch((error: unknown) => {
        if (signal?.aborted) return null;
        throw error;
      });

      // 끝까지 돈 결과는 정지를 눌렀더라도 버리지 않는다. 30분짜리를 다시 돌리게 만들 이유가 없다.
      if (!result) return RESULT.runStopped;

      const { code, output } = result;

      return code === 0
        ? RESULT.exposureDone(target.label, output.slice(-1500))
        : RESULT.exposureFailed(code, output.slice(-1500));
    },
  };

  return [runExposureCheck];
};
