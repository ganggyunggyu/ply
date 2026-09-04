import type { ToolSpec } from '../openrouter';
import type { ToolContext } from './tool-context';
import { createToolRuntime } from './runtime';
import { createAskUserTools } from './tools/ask-user';
import { createAskUserFormTools } from './tools/ask-user-form';
import { createAccountQueryTools } from './tools/account-query';
import { createNaverLoginTools } from './tools/naver-login';
import { createDabutBasicTools } from './tools/dabut-basic';
import { createUpdateDabutProjectTools } from './tools/update-dabut-project';
import { createGenerateManuscriptDabutTools } from './tools/generate-manuscript-dabut';
import { createGenerateManuscriptTools } from './tools/generate-manuscript';
import { createBlogBasicTools } from './tools/blog-basic';
import { createCafeJoinTools } from './tools/cafe-join';
import { createCafeCommentTools } from './tools/cafe-comment';
import { createDeleteBlogPostsTools } from './tools/delete-blog-posts';
import { createListSchedulerAccountsTools } from './tools/list-scheduler-accounts';
import { createAutoSchedulePostsTools } from './tools/auto-schedule-posts';
import { createListSchedulesTools } from './tools/list-schedules';
import { createGetScheduleTools } from './tools/get-schedule';
import { createCancelScheduleTools } from './tools/cancel-schedule';
import { createListExposureJobsTools } from './tools/list-exposure-jobs';
import { createRunExposureCheckTools } from './tools/run-exposure-check';
import { createManageAccountTools } from './tools/manage-account';
import { createExposureLoginTools } from './tools/exposure-login';
import { createUpdateExposurePresetTools } from './tools/update-exposure-preset';
import { createReadApiDocTools } from './tools/read-api-doc';
import { createApiGetTools } from './tools/api-get';
import { createServiceNavTools } from './tools/service-nav';

export const createNaverTools = (context: ToolContext): ToolSpec[] => {
  const runtime = createToolRuntime(context);

  const [askUserTool] = createAskUserTools(runtime);
  const [askUserFormTool] = createAskUserFormTools(runtime);
  const [listAccounts, checkLogin] = createAccountQueryTools(runtime);
  const [naverLogin] = createNaverLoginTools(runtime);
  const [checkServicesTool, dabutLogin, listProjects] = createDabutBasicTools(runtime);
  const [updateDabutProjectTool] = createUpdateDabutProjectTools(runtime);
  const [generateViaDabut] = createGenerateManuscriptDabutTools(runtime);
  const [generateManuscript] = createGenerateManuscriptTools(runtime);
  const [publishBlogPost, listMyPosts] = createBlogBasicTools(runtime);
  const [joinNaverCafe] = createCafeJoinTools(runtime);
  const [writeCafeCommentTool] = createCafeCommentTools(runtime);
  const [deleteBlogPosts] = createDeleteBlogPostsTools(runtime);
  const [listSchedulerAccountsTool] = createListSchedulerAccountsTools(runtime);
  const [autoSchedule] = createAutoSchedulePostsTools(runtime);
  const [listSchedulesTool] = createListSchedulesTools(runtime);
  const [getScheduleTool] = createGetScheduleTools(runtime);
  const [cancelScheduleTool] = createCancelScheduleTools(runtime);
  const [listExposureJobsTool] = createListExposureJobsTools(runtime);
  const [runExposureCheck] = createRunExposureCheckTools(runtime);
  const [manageNaverAccount] = createManageAccountTools(runtime);
  const [exposureLogin] = createExposureLoginTools(runtime);
  const [updateExposurePreset] = createUpdateExposurePresetTools(runtime);
  const [readApiDocTool] = createReadApiDocTools(runtime);
  const [apiGetTool] = createApiGetTools(runtime);
  const [listServices, openService, openTab] = createServiceNavTools(runtime);

  return [
    askUserTool,
    askUserFormTool,
    listAccounts,
    checkLogin,
    naverLogin,
    checkServicesTool,
    dabutLogin,
    listProjects,
    updateDabutProjectTool,
    generateViaDabut,
    generateManuscript,
    publishBlogPost,
    joinNaverCafe,
    writeCafeCommentTool,
    listMyPosts,
    deleteBlogPosts,
    listSchedulerAccountsTool,
    autoSchedule,
    listSchedulesTool,
    getScheduleTool,
    cancelScheduleTool,
    listExposureJobsTool,
    runExposureCheck,
    manageNaverAccount,
    exposureLogin,
    updateExposurePreset,
    readApiDocTool,
    apiGetTool,
    listServices,
    openService,
    openTab,
  ];
};
