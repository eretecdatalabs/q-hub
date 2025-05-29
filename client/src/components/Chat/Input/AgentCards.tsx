import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Agent } from 'librechat-data-provider';
import { useAgentsMapContext } from '~/Providers/AgentsMapContext';
import useSelectAgent from '~/hooks/Agents/useSelectAgent';
import { UserIcon } from '~/components/svg';
import { AGENT_CATEGORIES, getAgentCategory, type AgentCategory } from '~/config/agentCategories';

const AgentCards = () => {
  const { t } = useTranslation();
  const agentsMap = useAgentsMapContext() || {};
  const { onSelect } = useSelectAgent();
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory>('basic');

  const agents = useMemo(() => Object.values(agentsMap) as Agent[], [agentsMap]);

  // Helper: Log agent IDs to console for easy mapping setup
  // Remove this in production
  React.useEffect(() => {
    if (agents.length > 0) {
      console.log('🤖 Available Agent IDs for category mapping:');
      agents.forEach(agent => {
        console.log(`  '${agent.id}': '${getAgentCategory(agent)}', // ${agent.name || 'Unnamed Agent'}`);
      });
      console.log('Copy these IDs to AGENT_CATEGORY_MAP to customize categories');
    }
  }, [agents]);

  const filteredAgents = useMemo(() => {
    let filtered;
    if (selectedCategory === 'all') {
      filtered = agents;
    } else {
      filtered = agents.filter(agent => getAgentCategory(agent) === selectedCategory);
    }
    
    // Sort alphabetically by agent name
    return filtered.sort((a, b) => {
      const nameA = (a.name || 'Unnamed Agent').toLowerCase();
      const nameB = (b.name || 'Unnamed Agent').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [agents, selectedCategory]);

  // Get categories that have at least one agent
  const availableCategories = useMemo(() => {
    const categoriesWithAgents = new Set<AgentCategory>();
    
    // Always include 'all' if there are any agents
    if (agents.length > 0) {
      categoriesWithAgents.add('all');
    }
    
    // Add categories that have agents
    agents.forEach(agent => {
      const category = getAgentCategory(agent);
      categoriesWithAgents.add(category);
    });
    
    // Filter AGENT_CATEGORIES to only include those with agents
    return AGENT_CATEGORIES.filter(category => categoriesWithAgents.has(category));
  }, [agents]);

  const handleAgentSelect = (agent: Agent) => {
    if (agent.id) {
      onSelect(agent.id);
    }
  };

  if (!agents.length) {
    return null;
  }

  return (
    <div className="mt-6 mb-4">
      <h3 className="mb-4 text-center text-lg font-semibold text-text-primary">
        {t('com_agents_choose_agent')}
      </h3>
      
      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap justify-center gap-2 px-4">
        {availableCategories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              selectedCategory === category
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            {t(`com_agents_category_${category}`)}
          </button>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="flex flex-wrap justify-center gap-4 px-4">
        {filteredAgents.map((agent) => {
          const avatarUrl = agent?.avatar?.filepath;
          
          return (
            <button
              key={agent.id}
              onClick={() => handleAgentSelect(agent)}
              className="group relative flex h-40 w-64 cursor-pointer flex-col gap-3 rounded-2xl border border-border-medium bg-surface-primary px-4 py-4 text-start shadow-[0_2px_4px_0_rgba(0,0,0,0.05),0_8px_16px_0_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:border-border-heavy hover:bg-surface-secondary hover:shadow-[0_4px_8px_0_rgba(0,0,0,0.1),0_16px_32px_0_rgba(0,0,0,0.15)] focus:outline-none focus:ring-2 focus:ring-border-xheavy focus:ring-offset-2"
            >
              {/* Header with avatar and name */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={agent.name || 'Agent'}
                      className="h-10 w-10 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`h-6 w-6 text-text-secondary ${avatarUrl ? 'hidden' : ''}`}>
                    <UserIcon />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="truncate font-semibold text-base text-text-primary group-hover:text-text-primary">
                    {agent.name || 'Unnamed Agent'}
                  </h4>
                </div>
              </div>

              {/* Description */}
              <div className="flex-1 min-h-0">
                <p className="line-clamp-3 text-sm text-text-secondary group-hover:text-text-primary overflow-hidden">
                  {agent.description || ''}
                </p>
              </div>

              {/* Category Badge */}
              <div className="flex justify-end">
                <span className="rounded-full bg-surface-tertiary px-2 py-1 text-xs text-text-secondary">
                  {t(`com_agents_category_${getAgentCategory(agent)}`)}
                </span>
              </div>

              {/* Hover indicator */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </button>
          );
        })}
      </div>

      {/* No agents message */}
      {filteredAgents.length === 0 && selectedCategory !== 'all' && (
        <div className="text-center py-8">
          <p className="text-text-secondary">
            {t('com_ui_no_data')} {t(`com_agents_category_${selectedCategory}`).toLowerCase()}
          </p>
        </div>
      )}
    </div>
  );
};

export default AgentCards;
