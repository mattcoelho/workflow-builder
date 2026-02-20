from dataclasses import dataclass, field, asdict
from typing import Optional
import uuid
from datetime import datetime, timezone


def _new_id():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Annotation:
    verdict: str  # "correct" | "incorrect" | "partial"
    notes: str = ""
    timestamp: str = field(default_factory=_now)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        return cls(**d)


@dataclass
class Trace:
    user_message: str
    system_prompt: str
    model: str
    temperature: float
    raw_response: dict
    parsed_workflow: Optional[dict]
    parse_success: bool
    latency_ms: int
    error: Optional[str] = None
    id: str = field(default_factory=_new_id)
    timestamp: str = field(default_factory=_now)
    annotations: list = field(default_factory=list)

    def to_dict(self):
        d = asdict(self)
        return d

    @classmethod
    def from_dict(cls, d):
        annotations = [Annotation.from_dict(a) for a in d.get('annotations', [])]
        d = {**d, 'annotations': annotations}
        return cls(**d)


@dataclass
class GoldenExample:
    user_message: str
    expected_workflow: dict
    tags: list = field(default_factory=list)
    notes: str = ""
    id: str = field(default_factory=_new_id)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        return cls(**d)


@dataclass
class EvalResult:
    trace_id: str
    grader_name: str
    passed: bool
    score: float
    details: dict
    golden_id: Optional[str] = None
    timestamp: str = field(default_factory=_now)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        return cls(**d)
