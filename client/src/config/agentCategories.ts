import type { Agent } from 'librechat-data-provider';

// Define agent categories
export const AGENT_CATEGORIES = [
  'all',
  'finance',
  'basic',
  'data_analysis',
  'marketing',
  'development',
  'support',
] as const;

export type AgentCategory = typeof AGENT_CATEGORIES[number];

// Agent ID to Category mapping
// To find agent IDs:
// 1. Open browser console when AgentCards component loads
// 2. Look for "🤖 Available Agent IDs for category mapping:" log
// 3. Copy the agent IDs and assign them to categories below
export const AGENT_CATEGORY_MAP: Record<string, AgentCategory> = {
  // Example mappings - replace with your actual agent IDs:
  // 'agent-finance-001': 'finance',
  // 'agent-data-analyst': 'data_analysis',
  // 'agent-marketing-bot': 'marketing',
  // 'agent-dev-helper': 'development',
  // 'agent-support-bot': 'support',
  'agent_3UJGLGdOmUF81ZD64gjv0': 'data_analysis'
  
  // Add your agent ID mappings here:
};

// Function to get agent category by agent ID with fallback to keyword detection
export const getAgentCategory = (agent: Agent): AgentCategory => {
  if (!agent.id) {
    return 'basic';
  }
  
  // First priority: Check explicit agent ID mapping
  const mappedCategory = AGENT_CATEGORY_MAP[agent.id];
  if (mappedCategory) {
    return mappedCategory;
  }
  
  // Fallback: Use keyword-based detection for unmapped agents
  const name = agent.name?.toLowerCase() || '';
  const description = agent.description?.toLowerCase() || '';
  const content = `${name} ${description}`;

  // Finance related keywords
  if (content.includes('finance') || content.includes('financial') || content.includes('재무') ||
      content.includes('accounting') || content.includes('budget') || content.includes('investment')) {
    return 'finance';
  }

  // Data analysis related keywords
  if (content.includes('data') || content.includes('analysis') || content.includes('데이터') ||
      content.includes('분석') || content.includes('analytics') || content.includes('chart') ||
      content.includes('report') || content.includes('statistics')) {
    return 'data_analysis';
  }

  // Marketing related keywords
  if (content.includes('marketing') || content.includes('마케팅') || content.includes('campaign') ||
      content.includes('social') || content.includes('content') || content.includes('brand')) {
    return 'marketing';
  }

  // Development related keywords
  if (content.includes('code') || content.includes('develop') || content.includes('개발') ||
      content.includes('programming') || content.includes('software') || content.includes('api')) {
    return 'development';
  }

  // Support related keywords
  if (content.includes('support') || content.includes('help') || content.includes('지원') ||
      content.includes('customer') || content.includes('service') || content.includes('assist')) {
    return 'support';
  }

  // Default to basic category
  return 'basic';
};