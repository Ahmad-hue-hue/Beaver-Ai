import { describe, expect, it } from 'bun:test';
import { filterFreeModels } from './openrouter.provider.js';

function rec(
  id: string,
  opts: { tools?: boolean; vision?: boolean } = {},
) {
  return {
    id,
    supported_parameters: (opts.tools ?? true) ? ['tools'] : [],
    architecture: {
      input_modalities: opts.vision ? ['text', 'image'] : ['text'],
    },
  };
}

describe('filterFreeModels', () => {
  it('keeps only free, tool-capable chat models', () => {
    const { general } = filterFreeModels([
      rec('google/gemma-4-26b-a4b-it:free'),
      rec('minimax/minimax-m3:free', { tools: false }),
      rec('openai/gpt-4o'), // paid slug — must be excluded
      rec('provider/embed-1b', { tools: false }),
    ]);
    expect(general).toEqual(['google/gemma-4-26b-a4b-it:free']);
  });

  it('splits out vision-capable models', () => {
    const { general, vision } = filterFreeModels([
      rec('google/gemma-4-26b-a4b-it:free', { vision: true }),
      rec('liquid/lfm-2.5-2.6b:free'),
    ]);
    expect(general).toEqual([
      'google/gemma-4-26b-a4b-it:free',
      'liquid/lfm-2.5-2.6b:free',
    ]);
    expect(vision).toEqual(['google/gemma-4-26b-a4b-it:free']);
  });

  it('drops duplicates and survives malformed records', () => {
    const { general } = filterFreeModels([
      rec('a/model:free'),
      rec('a/model:free'),
      rec('b/no-tools:free', { tools: false }),
      { id: undefined, supported_parameters: null, architecture: null },
      null as unknown as { id?: string },
      { id: 'c/only-id:free' },
    ]);
    expect(general).toEqual(['a/model:free']);
  });
});