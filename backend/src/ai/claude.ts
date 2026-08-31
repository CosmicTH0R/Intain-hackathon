import Anthropic from '@anthropic-ai/sdk';
import prisma from '../prisma/client';

const MODEL = 'claude-3-5-haiku-20241022';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface AICallResult {
  recommendationId: string;
  responseText: string;
  suggestedAction: string | null;
}

/**
 * Calls Claude and persists the result to AIRecommendation table.
 * NEVER modifies any loan data directly — returns text only.
 */
export async function callClaude(
  prompt: string,
  endpoint: string,
  exceptionId?: string,
  loanId?: string
): Promise<AICallResult> {
  const timestamp = new Date();
  let responseText = '';
  let suggestedAction: string | null = null;

  // Check if API key is available
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your-key')) {
    responseText = `[MOCK AI RESPONSE — set ANTHROPIC_API_KEY in .env for real responses]\n\nFor endpoint "${endpoint}":\nThis is a simulated AI response for demonstration. The AI would analyze the loan record and provide detailed validation insights here. In production, Claude would explain the specific rule violation, suggest corrections based on the data pattern, and classify the severity with reasoning.`;
    suggestedAction = 'Review the flagged fields and compare with servicer data for discrepancies.';
  } else {
    try {
      const message = await getClient().messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: `You are a loan data quality analyst assistant. You help reviewers understand validation failures in loan records and suggest corrections. Be concise, specific, and cite exact field names and values. Never make up data — work only with what is provided.`,
      });

      responseText = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n');

      // Extract suggested action from response (first line after "Suggested Action:" if present)
      const actionMatch = responseText.match(/suggested action[:\-]\s*(.+)/i);
      suggestedAction = actionMatch ? actionMatch[1].trim() : null;
    } catch (err) {
      responseText = `AI call failed: ${(err as Error).message}. Please check your ANTHROPIC_API_KEY.`;
    }
  }

  // ALWAYS persist to AIRecommendation — never skip logging
  const rec = await prisma.aIRecommendation.create({
    data: {
      exceptionId: exceptionId || null,
      loanId: loanId || null,
      endpoint,
      prompt,
      model: MODEL,
      responseText,
      suggestedAction,
      timestamp,
      status: 'pending',
    },
  });

  return { recommendationId: rec.id, responseText, suggestedAction };
}

/**
 * Update the status of an AI recommendation (accepted/rejected/edited).
 */
export async function updateRecommendationStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'edited',
  editedResponse?: string
): Promise<void> {
  await prisma.aIRecommendation.update({
    where: { id },
    data: {
      status,
      ...(editedResponse && { responseText: editedResponse }),
    },
  });
}
