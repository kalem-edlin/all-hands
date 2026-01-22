/**
 * Status Pane - Right area showing milestone, active agents, and log stream
 *
 * Layout:
 * ┌─ Status ─────────────────────┐
 * │ Milestone: tui-redesign      │  <- Current milestone
 * │ Branch: feat/tui-redesign    │  <- Current branch
 * │ ─────────────────────────────│
 * │  ┌────────┐  ┌────────┐      │  <- Agent grid
 * │  │ coord  │  │ planner│      │
 * │  │ ●      │  │ ●      │      │
 * │  └────────┘  └────────┘      │
 * │ ─────────────────────────────│
 * │ [12:34] Agent spawned        │  <- Log stream
 * │ [12:35] Prompt 03 started    │
 * │ [12:36] Loop iteration 4     │
 * └──────────────────────────────┘
 */

import blessed from 'blessed';

export interface AgentInfo {
  name: string;
  agentType: string;
  promptNumber?: string;
  isRunning: boolean;
}

export interface StatusPaneData {
  milestone?: string;
  branch?: string;
  agents: AgentInfo[];
  logEntries?: string[];
}

const ACTIONS_WIDTH = 24;
const HEADER_HEIGHT = 3;

export function createStatusPane(
  screen: blessed.Widgets.Screen,
  agents: AgentInfo[],
  selectedIndex?: number,
  milestone?: string,
  branch?: string,
  logEntries: string[] = []
): blessed.Widgets.BoxElement {
  const pane = blessed.box({
    parent: screen,
    top: HEADER_HEIGHT,
    left: '50%+12',
    width: '50%-12',
    height: `100%-${HEADER_HEIGHT}`,
    border: {
      type: 'line',
    },
    label: ' Status ',
    tags: true,
    style: {
      border: {
        fg: 'cyan',
      },
    },
  });

  let currentY = 0;

  // Milestone header
  const milestoneText = milestone || '{gray-fg}No milestone{/gray-fg}';
  blessed.text({
    parent: pane,
    top: currentY,
    left: 1,
    content: `{bold}Milestone:{/bold} ${milestoneText}`,
    tags: true,
  });
  currentY += 1;

  // Branch info
  if (branch) {
    blessed.text({
      parent: pane,
      top: currentY,
      left: 1,
      content: `{gray-fg}Branch: ${branch}{/gray-fg}`,
      tags: true,
    });
  }
  currentY += 2;

  // Separator
  blessed.text({
    parent: pane,
    top: currentY,
    left: 1,
    content: '{gray-fg}── Active Agents ──{/gray-fg}',
    tags: true,
  });
  currentY += 1;

  // Agent grid
  if (agents.length === 0) {
    blessed.text({
      parent: pane,
      top: currentY,
      left: 1,
      content: '{gray-fg}No active agents{/gray-fg}',
      tags: true,
    });
    currentY += 2;
  } else {
    const boxWidth = 12;
    const boxHeight = 4;
    const padding = 1;
    const boxesPerRow = 2;

    agents.forEach((agent, index) => {
      const row = Math.floor(index / boxesPerRow);
      const col = index % boxesPerRow;

      const top = currentY + row * (boxHeight + padding);
      const left = col * (boxWidth + padding) + 1;

      const isSelected = selectedIndex === index;
      const boxStyle = isSelected
        ? { border: { fg: 'yellow' }, fg: 'white' }
        : { border: { fg: 'gray' }, fg: 'white' };

      const agentBox = blessed.box({
        parent: pane,
        top,
        left,
        width: boxWidth,
        height: boxHeight,
        border: {
          type: 'line',
        },
        tags: true,
        style: boxStyle,
      });

      const displayName = truncate(agent.name, boxWidth - 4);
      blessed.text({
        parent: agentBox,
        top: 0,
        left: 0,
        width: boxWidth - 2,
        content: displayName,
        tags: true,
      });

      const statusLine = formatAgentStatus(agent);
      blessed.text({
        parent: agentBox,
        top: 1,
        left: 0,
        width: boxWidth - 2,
        content: statusLine,
        tags: true,
      });
    });

    // Calculate how many rows of agents
    const agentRows = Math.ceil(agents.length / boxesPerRow);
    currentY += agentRows * (boxHeight + padding) + 1;
  }

  // Log stream section (bottom half)
  blessed.text({
    parent: pane,
    top: currentY,
    left: 1,
    content: '{gray-fg}── Recent Activity ──{/gray-fg}',
    tags: true,
  });
  currentY += 1;

  // Show last N log entries that fit
  const maxLogLines = 8;
  const recentLogs = logEntries.slice(-maxLogLines);

  if (recentLogs.length === 0) {
    blessed.text({
      parent: pane,
      top: currentY,
      left: 1,
      content: '{gray-fg}No recent activity{/gray-fg}',
      tags: true,
    });
  } else {
    recentLogs.forEach((entry, i) => {
      // Truncate long entries
      const truncatedEntry = entry.length > 35 ? entry.substring(0, 32) + '...' : entry;
      blessed.text({
        parent: pane,
        top: currentY + i,
        left: 1,
        content: `{gray-fg}${truncatedEntry}{/gray-fg}`,
        tags: true,
      });
    });
  }

  // Help text at bottom
  blessed.text({
    parent: pane,
    bottom: 0,
    left: 1,
    content: '{gray-fg}Ctrl-L: Full Log{/gray-fg}',
    tags: true,
  });

  return pane;
}

function formatAgentStatus(agent: AgentInfo): string {
  const indicator = agent.isRunning
    ? '{green-fg}●{/green-fg}'
    : '{red-fg}●{/red-fg}';

  let info = indicator;
  if (agent.promptNumber) {
    info += ` #${agent.promptNumber}`;
  }

  return info;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 2) + '..';
}
