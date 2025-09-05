export const DEFAULT_CHAT_MODEL: string = 'chat-model-common';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'DeepSeek V3.1',
    description: 'Advanced deepseek v3.1 model with text capabilities',
  },
  {
    id: 'chat-model-reasoning',
    name: 'GPT-OSS 120B',
    description: 'Advanced gpt-oss model with text capabilities',
  },
  {
    id: 'chat-model-common',
    name: 'DeepSeek V3',
    description: 'Advanced deepseek v3 model with text capabilities',
  },
  {
    id: 'chat-model-kimi',
    name: 'Kimi K2 Instruct',
    description: 'Advanced model kimi k2 instruct with text capabilities',
  },
];
