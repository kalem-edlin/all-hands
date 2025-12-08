"""xAI Grok API commands - X search for technology research."""

import os
from typing import Optional

import requests
from .base import BaseCommand


SYSTEM_PROMPT = """You are a technology research assistant. Search X (Twitter) for posts about the given technology, tool, or concept.

Find and synthesize:
- Developer opinions and experiences
- Comparisons with alternatives
- Common issues or gotchas
- Recent developments or announcements
- Community sentiment

Return a structured summary with key findings and notable posts."""

CHALLENGER_PROMPT = """You are a critical research challenger. Given research findings, search X to:

1. CHALLENGE: Find contradicting opinions, failed implementations, known issues
2. ALTERNATIVES: Surface newer/better tools the research may have missed
3. TRENDS: Identify emerging patterns that could affect the recommendations
4. SENTIMENT: Gauge real developer satisfaction vs marketing claims
5. DISCUSSIONS: Find where the best practitioners are discussing this topic

Be skeptical. Surface what the research missed or got wrong. Focus on recent posts (last 6 months)."""


class XaiSearchCommand(BaseCommand):
    """Search X for technology insights using Grok with X Search tool."""

    name = "search"
    description = "Search X for technology opinions, alternatives, and community insights"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Technology/topic to research on X")
        parser.add_argument("--context", help="Previous research findings to build upon")
        parser.add_argument("--results-to-challenge", help="Research results to challenge (enables challenger mode)")

    def execute(self, query: str, context: Optional[str] = None, results_to_challenge: Optional[str] = None, **kwargs) -> dict:
        api_key = os.environ.get("X_AI_API_KEY")
        if not api_key:
            return self.error("auth_error", "X_AI_API_KEY not set")

        # Determine mode and build prompt
        if results_to_challenge:
            system_prompt = CHALLENGER_PROMPT
            user_prompt = f"""Original query: {query}

Research findings to challenge:
{results_to_challenge}

Search X to challenge these findings."""
        elif context:
            system_prompt = SYSTEM_PROMPT
            user_prompt = f"""Previous research findings:
{context}

Now search X for additional insights about: {query}

Focus on opinions, alternatives, and community discussions that complement the existing findings."""
        else:
            system_prompt = SYSTEM_PROMPT
            user_prompt = f"Search X for developer opinions, experiences, and alternatives regarding: {query}"

        try:
            response, duration_ms = self.timed_execute(
                self._call_api, api_key, user_prompt, system_prompt
            )

            content = response["choices"][0]["message"]["content"]
            citations = response.get("citations", [])
            usage = response.get("usage", {})
            tool_usage = response.get("server_side_tool_usage", {})

            return self.success(
                {
                    "content": content,
                    "citations": citations,
                },
                {
                    "model": "grok-4-1-fast",
                    "command": "xai search",
                    "duration_ms": duration_ms,
                    "input_tokens": usage.get("prompt_tokens"),
                    "output_tokens": usage.get("completion_tokens"),
                    "reasoning_tokens": usage.get("reasoning_tokens"),
                    "x_search_calls": tool_usage.get("SERVER_SIDE_TOOL_X_SEARCH", 0),
                },
            )

        except requests.exceptions.Timeout:
            return self.error("timeout", f"Request timed out after {self.timeout_ms}ms")
        except requests.exceptions.RequestException as e:
            return self.error("api_error", str(e))
        except (KeyError, IndexError) as e:
            return self.error("parse_error", f"Unexpected response format: {e}")

    def _call_api(self, api_key: str, user_prompt: str, system_prompt: str) -> dict:
        response = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "grok-4-1-fast",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=self.timeout_ms / 1000,
        )
        response.raise_for_status()
        return response.json()


COMMANDS = {
    "search": XaiSearchCommand,
}
