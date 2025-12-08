"""Perplexity API commands."""

import os
import re

import requests
from .base import BaseCommand
from .xai import XaiSearchCommand


class PerplexityResearchCommand(BaseCommand):
    """Deep research with citations using sonar-deep-research."""

    name = "research"
    description = "Deep research with citations, optional --grok-challenge to validate via X"

    @property
    def timeout_ms(self) -> int:
        # sonar-deep-research is slow, needs longer timeout
        return int(os.environ.get("PERPLEXITY_TIMEOUT_MS", "300000"))

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Research query")
        parser.add_argument("--grok-challenge", action="store_true", help="Challenge findings with Grok X search")

    def execute(self, query: str, grok_challenge: bool = False, **kwargs) -> dict:
        api_key = os.environ.get("PERPLEXITY_API_KEY")
        if not api_key:
            return self.error("auth_error", "PERPLEXITY_API_KEY not set")

        try:
            response, duration_ms = self.timed_execute(
                self._call_api, api_key, query
            )

            content = response["choices"][0]["message"]["content"]
            content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()
            citations = response.get("citations", [])

            research_data = {"content": content, "citations": citations}
            meta = {"model": "sonar-deep-research", "command": "perplexity research", "duration_ms": duration_ms}

            if not grok_challenge:
                return self.success(research_data, meta)

            # Chain to Grok challenger
            xai_cmd = XaiSearchCommand()
            challenge_result = xai_cmd.execute(query=query, results_to_challenge=content)

            result = {"research": research_data}
            if challenge_result.get("status") == "success":
                result["challenge"] = challenge_result["data"]
                meta["challenge_duration_ms"] = challenge_result.get("meta", {}).get("duration_ms")
            else:
                result["challenge"] = {"error": challenge_result.get("error", "Unknown error")}

            return self.success(result, meta)

        except requests.exceptions.Timeout:
            return self.error("timeout", f"Request timed out after {self.timeout_ms}ms")
        except requests.exceptions.RequestException as e:
            return self.error("api_error", str(e))
        except (KeyError, IndexError) as e:
            return self.error("parse_error", f"Unexpected response format: {e}")

    def _call_api(self, api_key: str, query: str) -> dict:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar-deep-research",
                "messages": [{"role": "user", "content": query}],
            },
            timeout=self.timeout_ms / 1000,
        )
        response.raise_for_status()
        return response.json()


# Auto-discovered by envoy.py
COMMANDS = {
    "research": PerplexityResearchCommand,
}
