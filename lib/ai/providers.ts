import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';
import { fireworks } from '@ai-sdk/fireworks';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': fireworks.languageModel(
          'accounts/fireworks/models/deepseek-r1-0528',
        ),
        'chat-model-reasoning': wrapLanguageModel({
          model: fireworks.languageModel(
            'accounts/fireworks/models/gpt-oss-120b',
          ),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'chat-model-common': fireworks.languageModel(
          'accounts/fireworks/models/deepseek-v3-0324',
        ),
        'chat-model-kimi': fireworks.languageModel(
          'accounts/fireworks/models/kimi-k2-instruct-0905',
        ),
        'title-model': fireworks.languageModel(
          'accounts/fireworks/models/gpt-oss-20b',
        ),
        'artifact-model': fireworks.languageModel(
          'accounts/fireworks/models/gpt-oss-120b',
        ),
      },
    });
