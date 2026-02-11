import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

export interface TaskOutput {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
}

export interface LLMResponse {
  tasks: TaskOutput[];
}

export class LLMService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes('Dummy') || apiKey.includes('your_') || apiKey.includes('Replace')) {
      console.error('❌ GEMINI_API_KEY is not configured properly!');
      console.error('');
      console.error('Please update backend/.env file with your actual Gemini API key:');
      console.error('1. Go to https://ai.google.dev/');
      console.error('2. Get your API key');
      console.error('3. Replace the dummy value in backend/.env');
      console.error('   GEMINI_API_KEY=your_actual_api_key_here');
      console.error('');
      throw new Error('GEMINI_API_KEY is not configured. Please update backend/.env file.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Extracts tasks from a meeting transcript using Gemini AI
   */
  async extractTasksFromTranscript(transcript: string): Promise<LLMResponse> {
    try {
      const prompt = this.buildPrompt(transcript);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      const parsedResponse = this.parseResponse(text);

      // Ensure all tasks have valid UUIDs
      const tasksWithIds = parsedResponse.tasks.map(task => ({
        ...task,
        id: task.id || uuidv4(), // Generate UUID if missing
      }));

      return { tasks: tasksWithIds };
    } catch (error) {
      console.error('Error in LLM service:', error);
      throw new Error(`Failed to extract tasks from transcript: ${error}`);
    }
  }

  /**
   * Builds a comprehensive prompt for Gemini to extract structured tasks
   */
  private buildPrompt(transcript: string): string {
    return `You are a task extraction AI for InsightBoard, a productivity SaaS platform.

Your job is to analyze a meeting transcript and extract actionable tasks with their dependencies.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON (no markdown, no code blocks, no explanations)
2. Each task MUST have a unique UUID v4 format ID
3. Dependencies MUST reference IDs of tasks that exist in the output
4. NEVER reference non-existent task IDs
5. Priority must be one of: "high", "medium", "low"

OUTPUT FORMAT (JSON only):
{
  "tasks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "description": "Clear, actionable task description",
      "priority": "high",
      "dependencies": []
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "description": "Another task that depends on the first",
      "priority": "medium",
      "dependencies": ["550e8400-e29b-41d4-a716-446655440000"]
    }
  ]
}

IMPORTANT RULES:
- Extract 5-15 meaningful tasks (not too granular, not too broad)
- Dependencies array contains IDs of tasks that must be completed BEFORE this task
- Only include dependencies that are actually in the tasks list
- Use proper UUID v4 format for all IDs
- Ensure logical dependency ordering (no circular dependencies)
- Return ONLY the JSON object, nothing else

MEETING TRANSCRIPT:
${transcript}

Now extract the tasks as JSON:`;
  }

  /**
   * Parses the LLM response and validates JSON structure
   */
  private parseResponse(responseText: string): LLMResponse {
    try {
      // Remove markdown code blocks if present
      let cleanedText = responseText.trim();

      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleanedText);

      // Validate structure
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error('Invalid response format: tasks array is required');
      }

      // Validate each task
      parsed.tasks.forEach((task: any, index: number) => {
        if (!task.description) {
          throw new Error(`Task ${index} is missing description`);
        }
        if (!task.priority || !['high', 'medium', 'low'].includes(task.priority)) {
          task.priority = 'medium'; // Default to medium if invalid
        }
        if (!Array.isArray(task.dependencies)) {
          task.dependencies = [];
        }
      });

      return parsed as LLMResponse;
    } catch (error) {
      console.error('Failed to parse LLM response:', responseText);
      throw new Error(`Failed to parse LLM response: ${error}`);
    }
  }
}

export default new LLMService();
