import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 1. Initialize the server
const server = new Server(
  {
    name: 'nvidia-nim-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 2. Request handler for listing tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ask_nvidia_nim',
        description: 'Ask a prompt to the NVIDIA NIM z-ai/glm-5.1 model',
        inputSchema: {
          type: 'object',
          properties: {
            user_prompt: {
              type: 'string',
              description: 'The prompt to ask the NVIDIA NIM model',
            },
          },
          required: ['user_prompt'],
        },
      },
    ],
  };
});

// 3. Request handler for calling tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'ask_nvidia_nim') {
    const user_prompt = request.params.arguments?.user_prompt;
    if (typeof user_prompt !== 'string') {
      throw new Error('user_prompt must be a string');
    }

    try {
      const responseText = await makeNvidiaNimCompletion(user_prompt);
      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error calling NVIDIA NIM API: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
  throw new Error(`Tool not found: ${request.params.name}`);
});

// Helper function to call the NVIDIA NIM completions API
async function makeNvidiaNimCompletion(prompt) {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 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',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.1',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP error! status: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// 4. Start the server using stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
