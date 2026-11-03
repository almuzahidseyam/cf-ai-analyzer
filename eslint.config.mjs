import js from '@eslint/js';
import ts from 'typescript-eslint';
import next from '@next/eslint-plugin-next';
import hooks from 'eslint-plugin-react-hooks';
export default [
  {ignores:['.next/**','node_modules/**','next-env.d.ts','out/**']},
  js.configs.recommended,
  ...ts.configs.recommended,
  {files:['src/**/*.tsx'],plugins:{'@next/next':next,'react-hooks':hooks},rules:{...next.configs.recommended.rules,...next.configs['core-web-vitals'].rules,...hooks.configs.recommended.rules}},
];
