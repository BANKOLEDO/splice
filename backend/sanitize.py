import re

HTML_TAG_RE = re.compile(r'<[^>]*>')

def sanitize_text(text: str, max_length: int = 10000) -> str:
    if not text:
        return ""
    # Strip to max length to prevent DoS with giant payloads
    text = text[:max_length]
    # Remove HTML tags
    text = HTML_TAG_RE.sub('', text)
    # Normalize whitespace (prevent vertical tab, form feed tricks)
    text = ' '.join(text.split())
    # Remove null bytes
    text = text.replace('\x00', '')
    return text.strip()