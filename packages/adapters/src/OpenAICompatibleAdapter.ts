import { InferenceAdapter, CompletionRequest, CompletionResponse } from '@agent-office/core';

export class OpenAICompatibleAdapter implements InferenceAdapter {
    public readonly isLocal = false;

    constructor(
        private baseUrl: string,
        private apiKey: string,
        public readonly provider: string = 'openai'
    ) { }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const start = Date.now();

        const tools = request.tools?.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters || { type: "object", properties: {} }
        }));

        const body: any = {
            model: request.model,
            max_tokens: request.maxTokens || 1024,
            system: request.messages.find(m => m.role === 'system')?.content || '',
            messages: request.messages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }))
        };

        if (tools && tools.length > 0) {
            body.tools = tools;
        }

        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Anthropic Error: ${response.statusText} — ${err}`);
        }

        const data = await response.json();
        const latency = Date.now() - start;

        let content = '';
        let toolCalls: any[] | undefined;

        if (data.content) {
            for (const block of data.content) {
                if (block.type === 'text') {
                    content += block.text;
                } else if (block.type === 'tool_use') {
                    toolCalls = toolCalls || [];
                    toolCalls.push({
                        name: block.name,
                        params: block.input
                    });
                }
            }
        }

        return {
            content,
            toolCalls,
            usage: {
                prompt: data.usage?.input_tokens || 0,
                completion: data.usage?.output_tokens || 0
            },
            latency
        };
    }
}
