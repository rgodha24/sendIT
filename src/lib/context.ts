import { z } from 'zod';

// Context types that can be gathered without requiring extra permissions or APIs
export const contextSchema = z.object({
  // Time context
  time: z.object({
    currentTime: z.string(), // ISO format
    dayOfWeek: z.string(), // Monday, Tuesday, etc.
    timeOfDay: z.enum(['early_morning', 'morning', 'afternoon', 'evening', 'late_night']),
    isWeekend: z.boolean(),
    isWorkHours: z.boolean(), // 9am-5pm weekdays
  }),

  // Financial context (inferred from question, not requiring API)
  financial: z.object({
    involvesMoney: z.boolean(),
    estimatedAmount: z.enum(['small', 'medium', 'large', 'unknown']).optional(),
    isImpulsePurchase: z.boolean().optional(),
  }),

  // Behavioral context
  behavioral: z.object({
    questionLength: z.number(), // Indicates deliberation level
    hasExclamation: z.boolean(), // Indicates excitement/emotion
    hasQuestion: z.boolean(), // Indicates uncertainty
    tone: z.enum(['casual', 'serious', 'emotional', 'analytical']),
    urgency: z.enum(['low', 'medium', 'high']),
  }),

  // Session context
  session: z.object({
    debateCount: z.number(), // How many debates in this session
    timestamp: z.string(),
  }),
});

export type DebateContext = z.infer<typeof contextSchema>;

/**
 * Analyzes the user's question to extract contextual insights
 */
export function analyzeQuestion(question: string): Pick<DebateContext, 'financial' | 'behavioral'> {
  const lowerQuestion = question.toLowerCase();

  // Financial analysis
  const moneyKeywords = ['buy', 'purchase', 'spend', 'cost', 'price', '$', 'dollar', 'expensive', 'cheap', 'afford', 'invest', 'subscription'];
  const involvesMoney = moneyKeywords.some(keyword => lowerQuestion.includes(keyword));

  let estimatedAmount: 'small' | 'medium' | 'large' | 'unknown' = 'unknown';
  if (involvesMoney) {
    // Try to extract amount
    const amountMatch = question.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount < 50) estimatedAmount = 'small';
      else if (amount < 500) estimatedAmount = 'medium';
      else estimatedAmount = 'large';
    } else {
      // Infer from keywords
      if (lowerQuestion.includes('cheap') || lowerQuestion.includes('coffee') || lowerQuestion.includes('snack')) {
        estimatedAmount = 'small';
      } else if (lowerQuestion.includes('expensive') || lowerQuestion.includes('invest') || lowerQuestion.includes('loan')) {
        estimatedAmount = 'large';
      }
    }
  }

  const impulseKeywords = ['now', 'right now', 'immediately', 'quick', 'really want', 'need'];
  const isImpulsePurchase = involvesMoney && impulseKeywords.some(keyword => lowerQuestion.includes(keyword));

  // Behavioral analysis
  const hasExclamation = question.includes('!');
  const hasQuestion = question.includes('?');

  let tone: 'casual' | 'serious' | 'emotional' | 'analytical' = 'casual';
  if (hasExclamation || lowerQuestion.includes('really') || lowerQuestion.includes('so')) {
    tone = 'emotional';
  } else if (question.length > 100 || lowerQuestion.includes('because') || lowerQuestion.includes('considering')) {
    tone = 'analytical';
  } else if (lowerQuestion.includes('should i') || lowerQuestion.includes('advice')) {
    tone = 'serious';
  }

  let urgency: 'low' | 'medium' | 'high' = 'low';
  const urgentKeywords = ['urgent', 'asap', 'now', 'immediately', 'today', 'tonight'];
  const mediumUrgentKeywords = ['soon', 'this week', 'need to'];
  if (urgentKeywords.some(keyword => lowerQuestion.includes(keyword))) {
    urgency = 'high';
  } else if (mediumUrgentKeywords.some(keyword => lowerQuestion.includes(keyword)) || isImpulsePurchase) {
    urgency = 'medium';
  }

  return {
    financial: {
      involvesMoney,
      estimatedAmount: involvesMoney ? estimatedAmount : undefined,
      isImpulsePurchase: involvesMoney ? isImpulsePurchase : undefined,
    },
    behavioral: {
      questionLength: question.length,
      hasExclamation,
      hasQuestion,
      tone,
      urgency,
    },
  };
}

/**
 * Gathers time-based context
 */
export function getTimeContext(): DebateContext['time'] {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday

  let timeOfDay: DebateContext['time']['timeOfDay'];
  if (hour >= 5 && hour < 8) {
    timeOfDay = 'early_morning';
  } else if (hour >= 8 && hour < 12) {
    timeOfDay = 'morning';
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'late_night';
  }

  const isWeekend = day === 0 || day === 6;
  const isWorkHours = !isWeekend && hour >= 9 && hour < 17;

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    currentTime: now.toISOString(),
    dayOfWeek: daysOfWeek[day],
    timeOfDay,
    isWeekend,
    isWorkHours,
  };
}

/**
 * Builds complete context for a debate
 */
export function buildDebateContext(question: string, debateCount: number = 0): DebateContext {
  const timeContext = getTimeContext();
  const { financial, behavioral } = analyzeQuestion(question);

  return {
    time: timeContext,
    financial,
    behavioral,
    session: {
      debateCount,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Formats context for inclusion in agent prompts
 */
export function formatContextForPrompt(context: DebateContext): string {
  const { time, financial, behavioral, session } = context;

  let contextStr = `<context>\n`;

  // Time context
  contextStr += `<time>\n`;
  contextStr += `  It's currently ${time.timeOfDay.replace('_', ' ')} on a ${time.dayOfWeek}`;
  if (time.isWeekend) {
    contextStr += ` (weekend)`;
  } else if (time.isWorkHours) {
    contextStr += ` (during work hours)`;
  }
  contextStr += `.\n`;
  contextStr += `</time>\n\n`;

  // Financial context
  if (financial.involvesMoney) {
    contextStr += `<financial>\n`;
    contextStr += `  This decision involves money`;
    if (financial.estimatedAmount && financial.estimatedAmount !== 'unknown') {
      contextStr += ` (${financial.estimatedAmount} amount)`;
    }
    if (financial.isImpulsePurchase) {
      contextStr += `. The language suggests this may be an impulse decision`;
    }
    contextStr += `.\n`;
    contextStr += `</financial>\n\n`;
  }

  // Behavioral context
  contextStr += `<behavioral>\n`;
  contextStr += `  The user's tone is ${behavioral.tone}`;
  if (behavioral.urgency !== 'low') {
    contextStr += ` with ${behavioral.urgency} urgency`;
  }
  if (behavioral.hasExclamation) {
    contextStr += `. They seem excited or emphatic`;
  }
  if (behavioral.hasQuestion) {
    contextStr += `. They're expressing uncertainty`;
  }
  contextStr += `.\n`;
  contextStr += `</behavioral>\n\n`;

  // Session context
  if (session.debateCount > 0) {
    contextStr += `<session>\n`;
    contextStr += `  This is the user's ${getOrdinal(session.debateCount + 1)} debate in this session.\n`;
    contextStr += `</session>\n`;
  }

  contextStr += `</context>\n`;

  return contextStr;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
