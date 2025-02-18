import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['**/*.mjs', '**/*.js', 'src/ui/'],
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'func-style': ['error', 'expression', { allowArrowFunctions: true }],
            "sort-imports": ["error", {
                "ignoreCase": true,
                "ignoreDeclarationSort": true,
                "ignoreMemberSort": true,
                "memberSyntaxSortOrder": ["none", "all", "multiple", "single"],
                "allowSeparatedGroups": false
            }]
        },
    },
);
