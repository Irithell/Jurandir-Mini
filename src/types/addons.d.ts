export type AddonStatus =
  | 'pending'
  | 'downloading'
  | 'validating'
  | 'writing'
  | 'migrating'
  | 'done'
  | 'failed';

export type AddonFileType = 'command' | 'handler' | 'jsdoc' | 'function' | 'config' | 'migration';

export type HookPhase = 'gate' | 'process';

export interface AddonRow {
  name: string;
  version: string;
  status: AddonStatus;
  current_step: string | null;
  manifest: string;
  installed_at: string;
  updated_at: string;
}

export interface AddonFileRow {
  id: number;
  addon_name: string;
  src: string;
  dest: string;
  type: AddonFileType;
  hash: string;
}

export interface AddonHookRow {
  id: number;
  addon_name: string;
  event: string;
  file: string;
  phase: HookPhase;
  export_name: string;
}

export interface AddonInjectRow {
  id: number;
  addon_name: string;
  name: string;
  file: string;
  export_name: string;
}
