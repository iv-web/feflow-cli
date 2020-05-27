import ApiController from './api';
import { getUserNameFromGit, getSystemInfoByOS, getProjectByPackage } from './common/utils';
import objectFactory from './common/objectFactory';
import { HOOK_TYPE_BEFORE, HOOK_TYPE_AFTER } from './constants';

interface ReportContext {
  log: any;
  logger: any;
  pkgConfig: {
    name: string;
  };
  commander: {
    store: {};
  };
  hook: {
    on(eventName: string, listener: any): void;
  };
}

interface ReportBody {
  [key: string]: any;
}

class Report {
  ctx: ReportContext;
  costTime: number;
  startTime: number;
  userName: string;
  systemInfo: string;
  project: string;
  reCallId: string;
  cmd: string;
  args: object;
  isRecallActivating: boolean;
  cmdSource: string;

  constructor(feflowContext: ReportContext, cmd?: string, args?: any) {
    this.ctx = feflowContext;
    this.cmd = cmd;
    this.args = args;
    this.userName = this.getUserName();
    this.systemInfo = this.getSystemInfo();
    this.project = this.getProject();
    this.loadContextLogger();

    // hook is not supported in feflow 0.16.x
    if (this.ctx.hook) {
      this.registerHook();
    }
  }
  // register before/after hook event
  private registerHook() {
    const { cmd, args } = this;
    this.ctx.hook.on(HOOK_TYPE_BEFORE, () => {      
      this.cmdSource = this.ctx.commander?.store[cmd].pluginName || "";
      this.ctx.log.debug('HOOK_TYPE_BEFORE');
      this.startTime = Date.now();
      this.report(cmd, args);
    });

    // report some performance data after command executed
    this.ctx.hook.on(HOOK_TYPE_AFTER, () => {
      this.ctx.log.debug('HOOK_TYPE_AFTER');
      this.costTime = Date.now() - this.startTime;
      this.recallReport();
    });
  }
  private loadContextLogger() {
    this.ctx.log = this.ctx.log || this.ctx.logger;
    this.ctx.log = this.ctx.log ? this.ctx.log : { info: console.log, debug: console.log };
  }
  private getProject() {
    const { pkgConfig } = this.ctx;
    let project = '';

    if (pkgConfig) {
      // feflow context
      project = pkgConfig.name;
    } else {
      // if not, read project name from project's package.json
      project = getProjectByPackage();
    }

    return project;
  }
  getUserName() {
    return getUserNameFromGit();
  }

  getSystemInfo(): string {
    const systemDetailInfo = getSystemInfoByOS();
    return JSON.stringify(systemDetailInfo);
  }

  private getReportBody(cmd, args): ReportBody {
    return objectFactory
      .create()
      .load('command', cmd)
      .load('cmd_source', this.cmdSource)
      .load('user_name', this.userName)
      .load('params', args)
      .load('system_info', this.systemInfo)
      .load('project', this.project)
      .done();
  }

  private getRecallBody(): ReportBody {
    return objectFactory
      .create()
      .load('command')
      .load('recall_id', this.reCallId)
      .load('cost_time', this.costTime)
      .load('is_fail', false)
      .done();
  }

  private checkBeforeReport(cmd, args) {
    return !!cmd;
  }

  report(cmd, args?) {
    // args check
    if (!this.checkBeforeReport(cmd, args)) return;
    try {
      const reportBody: ReportBody = this.getReportBody(cmd, args);
      this.ctx.log.debug('reportBody', reportBody);
      const report = new ApiController(reportBody, this.ctx.log);
      report.doReport(({ result }) => {
        const { id } = result || {};
        this.reCallId = id;
        // hack async
        if (this.isRecallActivating) {
          this.recallReport();
        }
      });
    } catch (error) {
      this.ctx.log.debug('feflow report got error，please contact administractor to resolve ', error);
    }
  }

  recallReport() {
    this.isRecallActivating = true;
    if (!this.reCallId) return;
    try {
      const reCallBody: ReportBody = this.getRecallBody();
      this.ctx.log.debug('reCallBody', reCallBody);
      const report = new ApiController(reCallBody, this.ctx.log);
      report.doReport();
    } catch (error) {
      this.ctx.log.debug('feflow recallReport got error，please contact administractor to resolve ', error);
    }
  }
}

module.exports = Report;
