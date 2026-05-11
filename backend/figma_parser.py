import re
import json
from typing import List, Optional, Dict
from dataclasses import dataclass
from enum import Enum


class DesignTokenType(str, Enum):
    COLOR = "color"
    SPACING = "spacing"
    FONT = "font"
    SHADOW = "shadow"
    BORDER_RADIUS = "border_radius"
    OPACITY = "opacity"


@dataclass
class DesignToken:
    name: str
    value: str
    type: DesignTokenType
    source: str = ""


@dataclass
class FigmaNode:
    id: str
    name: str
    type: str
    children: List["FigmaNode"]
    properties: Dict


class FigmaExtractor:

    FIGMA_FILE_REGEX = re.compile(
        r"https://(?:www\.)?figma\.com/file/([a-zA-Z0-9]+)/([^?]+)(?:\?.*)?(?:node-id=([\d:]+))?"
    )

    FIGMA_PROTO_REGEX = re.compile(
        r"https://(?:www\.)?figma\.com/proto/([a-zA-Z0-9]+)/([^?]+)(?:\?.*)?(?:node-id=([\d:]+))?"
    )

    @staticmethod
    def parse_figma_url(url: str) -> Optional[Dict[str, str]]:
        match = FigmaExtractor.FIGMA_FILE_REGEX.match(url)
        if not match:
            match = FigmaExtractor.FIGMA_PROTO_REGEX.match(url)
        if match:
            return {
                "file_key": match.group(1),
                "file_name": match.group(2),
                "node_id": match.group(3) if match.lastindex >= 3 else None,
            }
        return None

    @staticmethod
    def extract_css_from_tokens(tokens: List[DesignToken]) -> str:
        css = ":root {\n"
        for token in tokens:
            css_name = token.name.replace("_", "-").lower()
            css += f"  --{css_name}: {token.value};\n"
        css += "}"
        return css

    @staticmethod
    def extract_scss_from_tokens(tokens: List[DesignToken]) -> str:
        lines = []
        for token in tokens:
            var_name = f"${token.name}"
            lines.append(f"{var_name}: {token.value};")
        return "\n".join(lines)

    @staticmethod
    def group_tokens_by_type(tokens: List[DesignToken]) -> Dict[str, List[DesignToken]]:
        groups = {}
        for token in tokens:
            t = token.type.value
            if t not in groups:
                groups[t] = []
            groups[t].append(token)
        return groups

    @staticmethod
    def tokens_to_json_schema(tokens: List[DesignToken]) -> dict:
        grouped = FigmaExtractor.group_tokens_by_type(tokens)
        schema = {}
        for token_type, token_list in grouped.items():
            schema[token_type] = {}
            for t in token_list:
                schema[token_type][t.name] = t.value
        return schema


figma = FigmaExtractor()
