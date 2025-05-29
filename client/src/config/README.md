# Agent Categories Configuration

This directory contains configuration for managing agent categories in the AgentCards component.

## How to Manage Agent Categories by ID

### Step 1: Find Agent IDs

1. Open your browser's developer console (F12)
2. Navigate to the chat page where AgentCards are displayed
3. Look for the console log message: "🤖 Available Agent IDs for category mapping:"
4. Copy the agent IDs that are logged

### Step 2: Configure Categories

Edit `agentCategories.ts` and update the `AGENT_CATEGORY_MAP` object:

```typescript
export const AGENT_CATEGORY_MAP: Record<string, AgentCategory> = {
  'your-agent-id-1': 'finance',
  'your-agent-id-2': 'data_analysis',
  'your-agent-id-3': 'marketing',
  // Add more mappings as needed
};
```

### Step 3: Available Categories

The following categories are available:
- `all` - Shows all agents (special category for the "All" tab)
- `finance` - Financial and accounting related agents
- `basic` - General purpose agents
- `data_analysis` - Data analysis and reporting agents
- `marketing` - Marketing and content creation agents
- `development` - Programming and development agents
- `support` - Customer support and help agents

### Step 4: Add New Categories

To add new categories:

1. Add the category to the `AGENT_CATEGORIES` array in `agentCategories.ts`
2. Add translations in both `locales/en/translation.json` and `locales/ko/translation.json`:
   ```json
   "com_agents_category_your_new_category": "Your New Category"
   ```

### Fallback System

If an agent ID is not explicitly mapped, the system will:
1. Analyze the agent's name and description for keywords
2. Automatically assign it to the most appropriate category
3. Default to 'basic' category if no keywords match

### Example Configuration

```typescript
export const AGENT_CATEGORY_MAP: Record<string, AgentCategory> = {
  // Finance agents
  'agent-financial-advisor': 'finance',
  'agent-budget-planner': 'finance',
  
  // Data analysis agents
  'agent-data-scientist': 'data_analysis',
  'agent-report-generator': 'data_analysis',
  
  // Marketing agents
  'agent-content-creator': 'marketing',
  'agent-social-media': 'marketing',
  
  // Development agents
  'agent-code-reviewer': 'development',
  'agent-api-helper': 'development',
  
  // Support agents
  'agent-customer-service': 'support',
  'agent-help-desk': 'support',
};
```

This approach gives you precise control over which agents appear in which categories, while maintaining a fallback system for new or unmapped agents.