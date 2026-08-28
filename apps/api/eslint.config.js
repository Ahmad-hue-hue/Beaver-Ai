import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow stripping known fields via object-rest destructuring, e.g.
      // `const { refreshToken: _r, ...body } = result;` to omit a field from a payload.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  globalIgnores(['dist/**', 'node_modules/**']),
);
