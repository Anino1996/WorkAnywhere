import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: '*', next: 'for' },
        { blankLine: 'always', prev: '*', next: 'switch' },
        { blankLine: 'always', prev: '*', next: 'try' },
        { blankLine: 'always', prev: '*', next: 'while' },
        { blankLine: 'always', prev: 'multiline-block-like', next: '*' },
      ],
    },
  },
];
