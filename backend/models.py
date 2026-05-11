from enum import Enum
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel


class ArtifactType(str, Enum):
    SPEC = "spec"
    DESIGN = "design"
    API_ENDPOINT = "api"
    UI_COMPONENT = "ui"
    TASK = "task"
    QUESTION = "question"


class ArtifactStatus(str, Enum):
    DRAFT = "draft"
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    BLOCKED = "blocked"
    DONE = "done"


class Role(str, Enum):
    DEV = "dev"
    DESIGNER = "designer"
    PM = "pm"
    BACKEND = "backend"
    FRONTEND = "frontend"


class OwnerRole(str, Enum):
    DESIGN = "design"
    DEV = "dev"
    PM = "pm"
    BACKEND = "backend"
    FRONTEND = "frontend"


class TeamCreate(BaseModel):
    name: str
    slug: str


class TeamMemberAdd(BaseModel):
    user_id: str
    role: str = "member"


class ArtifactCreate(BaseModel):
    id: str
    type: ArtifactType
    title: str
    content: str
    owner_role: OwnerRole
    status: ArtifactStatus = ArtifactStatus.DRAFT
    dependencies: List[str] = []
    created_by: str
    metadata: dict = {}
    team_id: str = ""


class ArtifactUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[ArtifactStatus] = None
    owner_role: Optional[OwnerRole] = None
    dependencies: Optional[List[str]] = None
    metadata: Optional[dict] = None


class MessageCreate(BaseModel):
    author: str
    role: Role
    content: str
    attachments: List[str] = []
    mentions: List[str] = []


class ThreadCreate(BaseModel):
    artifact_id: str


class SyncPointCreate(BaseModel):
    id: str
    source_tool: Literal["figma", "github", "linear", "slack", "custom"]
    source_id: str
    artifact_id: str
    direction: Literal["import", "export", "bidirectional"]


class CursorPosition(BaseModel):
    x: int
    y: int
    text_offset: int = 0


class WsMessage(BaseModel):
    type: str
    artifact_id: Optional[str] = None
    user_id: Optional[str] = None
    position: Optional[CursorPosition] = None
    content: Optional[str] = None
    message: Optional[dict] = None
