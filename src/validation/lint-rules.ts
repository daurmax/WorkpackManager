export type LintRule = {
  id: string;
  description: string;
  check: (content: string, path?: string) => { ok: boolean; message?: string };
};

export const SAMPLE_RULE: LintRule = {
  id: 'no-empty-template',
  description: 'Warn when template files are present but empty',
  check: (content: string) => {
    if (content.trim().length === 0) return { ok: false, message: 'Template is empty' };
    return { ok: true };
  },
};

export const RULES: LintRule[] = [SAMPLE_RULE];
