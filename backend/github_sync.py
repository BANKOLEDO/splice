import os
import json
import re
from typing import List, Optional, Tuple
from github import Github, GithubException
from github.Issue import Issue
from github.Repository import Repository


class GitHubSync:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.environ.get("GITHUB_TOKEN", "")
        self.client = Github(self.token) if self.token else None

    def is_configured(self) -> bool:
        return self.client is not None and bool(self.token)

    @staticmethod
    def parse_repo_full(repo_full: str) -> Tuple[str, str]:
        parts = repo_full.split("/")
        if len(parts) >= 2:
            return parts[-2], parts[-1]
        raise ValueError(f"Invalid repo format: {repo_full}. Use 'owner/repo'")

    def map_github_state(self, state: str) -> str:
        mapping = {
            "open": "needs_review",
            "closed": "done",
            "merged": "done",
        }
        return mapping.get(state, "draft")

    def map_assignees_to_role(self, assignees) -> str:
        if not assignees:
            return "dev"
        return "dev"

    def issue_to_artifact_dict(self, issue: Issue) -> dict:
        labels = [l.name for l in issue.labels]
        artifact_type = "task"
        if any("spec" in l.lower() for l in labels):
            artifact_type = "spec"
        elif any("bug" in l.lower() for l in labels):
            artifact_type = "question"
        elif any("api" in l.lower() for l in labels):
            artifact_type = "api"
        elif any("ui" in l.lower() or "design" in l.lower() for l in labels):
            artifact_type = "ui"

        owner_role = self.map_assignees_to_role(issue.assignees)
        status = self.map_github_state(issue.state)

        return {
            "id": f"github_{issue.id}",
            "type": artifact_type,
            "title": issue.title,
            "content": issue.body or "",
            "owner_role": owner_role,
            "status": status,
            "dependencies": [],
            "created_by": issue.user.login if issue.user else "github",
            "metadata": {
                "github_url": issue.html_url,
                "github_issue_number": issue.number,
                "github_repo": issue.repository.full_name,
                "labels": labels,
            },
        }

    def sync_issue_to_artifact(self, repo_full: str, issue_number: int) -> dict:
        if not self.is_configured():
            raise RuntimeError("GitHub token not configured")

        repo = self.client.get_repo(repo_full)
        issue = repo.get_issue(issue_number)
        return self.issue_to_artifact_dict(issue)

    def sync_all_open_issues(self, repo_full: str) -> List[dict]:
        if not self.is_configured():
            raise RuntimeError("GitHub token not configured")

        repo = self.client.get_repo(repo_full)
        issues = repo.get_issues(state="open")
        return [self.issue_to_artifact_dict(i) for i in issues if not i.pull_request]

    def push_comment_to_github(self, repo_full: str, issue_number: int, body: str):
        if not self.is_configured():
            raise RuntimeError("GitHub token not configured")

        repo = self.client.get_repo(repo_full)
        issue = repo.get_issue(issue_number)
        issue.create_comment(body)

    def create_issue_from_artifact(self, repo_full: str, artifact: dict) -> dict:
        if not self.is_configured():
            raise RuntimeError("GitHub token not configured")

        repo = self.client.get_repo(repo_full)
        labels = [artifact.get("type", "task")]
        issue = repo.create_issue(
            title=artifact["title"],
            body=f"{artifact['content']}\n\n---\n_Synced from Splice artifact `{artifact['id']}`_",
            labels=labels,
        )
        return {
            "id": f"github_{issue.id}",
            "github_url": issue.html_url,
            "github_number": issue.number,
        }


github_sync = GitHubSync()
