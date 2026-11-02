import hashlib
import json
import logging
import math
import os
import re
import threading
from collections import Counter, OrderedDict
from pathlib import Path

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_ROLES_PATH = BASE_DIR / "roles.json"
DEFAULT_CONFIG_PATH = BASE_DIR / "scoring_config.json"
EXPERIENCE_PATTERN = re.compile(
    r"(?:(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+"
    r"(?:professional\s+)?experience|experience\s*[:,-]?\s*"
    r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?))",
    re.IGNORECASE,
)
TOKEN_PATTERN = re.compile(r"[a-z][a-z0-9+#.-]{1,}")
MAX_EMBEDDING_TEXT_CHARS = 20000
STOP_WORDS = {
    "and", "are", "for", "from", "have", "into", "its", "our", "the", "their",
    "this", "through", "using", "with", "you", "your",
}


def detect_skill_counts(text, skill_aliases):
    normalized_text = text.casefold()
    counts = {}
    for name, aliases in skill_aliases.items():
        alternatives = "|".join(
            re.escape(alias.casefold())
            for alias in sorted(aliases, key=len, reverse=True)
        )
        count = len(re.findall(
            r"(?<!\w)(?:" + alternatives + r")(?!\w)",
            normalized_text,
        ))
        if count:
            counts[name] = count
    return counts


def _validate_catalog(roles):
    if not isinstance(roles, list) or not 10 <= len(roles) <= 100:
        raise ValueError("The role catalog must contain between 10 and 100 roles.")
    titles = set()
    for role in roles:
        if not isinstance(role, dict) or not {
            "title", "description", "required_skills", "nice_to_have_skills",
            "typical_keywords", "expected_experience_level", "experience_years",
        } <= role.keys():
            raise ValueError("Each role must include its title, description, skills, keywords, and experience level.")
        title = role["title"]
        if (
            not isinstance(title, str) or not title.strip() or len(title) > 100
            or title.casefold() in titles
            or not isinstance(role["description"], str) or not role["description"].strip()
            or not isinstance(role["required_skills"], dict) or not role["required_skills"]
            or any(
                not isinstance(skill, str) or not skill.strip()
                or not isinstance(weight, (int, float)) or isinstance(weight, bool) or weight <= 0
                for skill, weight in role["required_skills"].items()
            )
            or not isinstance(role["nice_to_have_skills"], list)
            or any(not isinstance(skill, str) or not skill.strip() for skill in role["nice_to_have_skills"])
            or not isinstance(role["typical_keywords"], list)
            or any(not isinstance(keyword, str) or not keyword.strip() for keyword in role["typical_keywords"])
            or not isinstance(role["expected_experience_level"], str)
        ):
            raise ValueError("The role catalog contains an invalid role or duplicate title.")
        experience = role["experience_years"]
        if (
            not isinstance(experience, dict)
            or not isinstance(experience.get("min"), (int, float))
            or not isinstance(experience.get("max"), (int, float))
            or experience["min"] < 0
            or experience["max"] < experience["min"]
        ):
            raise ValueError(f"{title} must define valid minimum and maximum experience years.")
        titles.add(title.casefold())
    return roles


def _validate_config(config):
    if not isinstance(config, dict) or not isinstance(config.get("weights"), dict):
        raise ValueError("Scoring config must define component weights.")
    weights = config["weights"]
    required = {"semantic_similarity", "skill_match", "experience_fit"}
    if (
        set(weights) != required
        or any(not isinstance(value, (int, float)) or value < 0 for value in weights.values())
        or sum(weights.values()) <= 0
    ):
        raise ValueError("Scoring weights must be non-negative and include semantic, skill, and experience.")
    for key in ("required_skill_weight", "nice_to_have_skill_weight"):
        if not isinstance(config.get(key), (int, float)) or config[key] < 0:
            raise ValueError(f"Scoring config must include a non-negative {key}.")
    if config["required_skill_weight"] + config["nice_to_have_skill_weight"] <= 0:
        raise ValueError("Required and nice-to-have skill weights cannot both be zero.")
    if not isinstance(config.get("cache_size"), int) or config["cache_size"] < 1:
        raise ValueError("Cache size must be a positive integer.")
    return config


def estimate_years_of_experience(text):
    matches = [
        float(first or second)
        for first, second in EXPERIENCE_PATTERN.findall(text)
    ]
    return max(matches) if matches else None


def _token_counts(text):
    return Counter(
        token for token in TOKEN_PATTERN.findall(text.casefold())
        if token not in STOP_WORDS
    )


def _cosine(left, right):
    dot = sum(value * right.get(key, 0) for key, value in left.items())
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


class RoleMatcher:
    def __init__(self, roles_path=DEFAULT_ROLES_PATH, config_path=DEFAULT_CONFIG_PATH):
        try:
            with open(roles_path, encoding="utf-8") as file:
                self.roles = _validate_catalog(json.load(file))
            with open(config_path, encoding="utf-8") as file:
                self.config = _validate_config(json.load(file))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Unable to load role-matching data: {error}") from error
        self.model = None
        self.role_embeddings = {}
        self.semantic_model_available = False
        self.cache = OrderedDict()
        self.cache_lock = threading.Lock()
        self.catalog_hash = hashlib.sha256(
            json.dumps([self.roles, self.config], sort_keys=True).encode("utf-8")
        ).hexdigest()

    def initialize_embeddings(self):
        model_name = os.environ.get(
            "ROLE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.model = None
        self.role_embeddings = {}
        self.semantic_model_available = False
        try:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer(model_name)
            descriptions = [
                self._role_embedding_text(role)
                for role in self.roles
            ]
            embeddings = model.encode(descriptions, normalize_embeddings=True)
        except (ImportError, OSError, RuntimeError, ValueError) as error:
            logger.warning(
                "Sentence-transformer model %s is unavailable; using logged lexical fallback: %s",
                model_name,
                error,
            )
            with self.cache_lock:
                self.cache.clear()
            return
        self.model = model
        self.role_embeddings = {
            role["title"]: embedding.tolist()
            for role, embedding in zip(self.roles, embeddings)
        }
        self.semantic_model_available = True
        with self.cache_lock:
            self.cache.clear()
        logger.info("Precomputed embeddings for %d job roles.", len(self.roles))

    @staticmethod
    def _role_embedding_text(role):
        return " ".join((
            role["title"],
            role["description"],
            " ".join(role["required_skills"]),
            " ".join(role["nice_to_have_skills"]),
            " ".join(role["typical_keywords"]),
            role["expected_experience_level"],
        ))

    def _semantic_scores(self, text):
        semantic_text = text[:MAX_EMBEDDING_TEXT_CHARS]
        if self.semantic_model_available:
            resume_embedding = self.model.encode(
                [semantic_text],
                normalize_embeddings=True,
            )[0].tolist()
            return {
                role["title"]: max(
                    0.0,
                    min(1.0, sum(
                        left * right
                        for left, right in zip(resume_embedding, self.role_embeddings[role["title"]])
                    )),
                )
                for role in self.roles
            }
        resume_counts = _token_counts(semantic_text)
        return {
            role["title"]: _cosine(
                resume_counts,
                _token_counts(self._role_embedding_text(role)),
            )
            for role in self.roles
        }

    def match(self, text, skill_aliases, top_n=5, resume_hash=None):
        cache_key = f"{self.catalog_hash}:{resume_hash or hashlib.sha256(text.encode()).hexdigest()}:{top_n}"
        with self.cache_lock:
            cached = self.cache.get(cache_key)
            if cached is not None:
                self.cache.move_to_end(cache_key)
                return json.loads(json.dumps(cached))

        skill_counts = detect_skill_counts(text, skill_aliases)
        detected_skills = list(skill_counts)
        detected_set = {skill.casefold() for skill in detected_skills}
        years = estimate_years_of_experience(text)
        semantic_scores = self._semantic_scores(text)
        role_matches = []
        configured_weights = self.config["weights"]
        active_components = {
            "semantic_similarity": configured_weights["semantic_similarity"],
            "skill_match": configured_weights["skill_match"],
            "experience_fit": configured_weights["experience_fit"],
        }
        active_weight = sum(active_components.values())
        for role in self.roles:
            required = role["required_skills"]
            nice = role["nice_to_have_skills"]
            matched_required = [
                skill for skill in required if skill.casefold() in detected_set
            ]
            missing_required = [
                skill for skill in required if skill.casefold() not in detected_set
            ]
            matched_nice = [skill for skill in nice if skill.casefold() in detected_set]
            required_score = sum(required[skill] for skill in matched_required) / sum(required.values())
            nice_score = len(matched_nice) / len(nice) if nice else 0
            skill_weights_total = (
                self.config["required_skill_weight"] +
                (self.config["nice_to_have_skill_weight"] if nice else 0)
            )
            skill_score = (
                required_score * self.config["required_skill_weight"]
                + nice_score * (
                    self.config["nice_to_have_skill_weight"] if nice else 0
                )
            ) / skill_weights_total
            experience = role["experience_years"]
            if years is None:
                experience_score = 60.0
            elif years < experience["min"]:
                experience_score = max(40.0, 100 - 15 * (experience["min"] - years))
            elif years > experience["max"]:
                experience_score = max(45.0, 100 - 10 * (years - experience["max"]))
            else:
                experience_score = 100.0

            semantic_score = semantic_scores[role["title"]]
            raw_score = (
                semantic_score * active_components["semantic_similarity"]
                + skill_score * active_components["skill_match"]
                + (experience_score / 100) * active_components["experience_fit"]
            ) / active_weight * 100
            top_learning = sorted(
                missing_required,
                key=lambda skill: (-required[skill], skill.casefold()),
            )[:3]
            if not top_learning:
                top_learning = [skill for skill in nice if skill.casefold() not in detected_set][:3]
            max_required_weight = max(required.values())
            skill_profile = [
                {
                    "name": skill,
                    "resume_score": min(100, 40 + skill_counts.get(skill, 0) * 15),
                    "role_priority": round(required[skill] / max_required_weight * 100),
                }
                for skill in sorted(required, key=lambda item: (-required[item], item.casefold()))[:6]
            ]
            reason = (
                f"Your resume mentions {len(matched_required)} of {len(required)} weighted "
                f"core skills for this role."
            )
            if matched_required:
                reason += f" Strong signals include {', '.join(matched_required[:3])}."
            role_matches.append({
                "role": role["title"],
                "description": role["description"],
                "match_score": round(max(0, min(100, raw_score))),
                "score_breakdown": {
                    "semantic_similarity": round(semantic_score * 100),
                    "skill_match": round(skill_score * 100),
                    "experience_fit": round(experience_score),
                    "semantic_model_available": self.semantic_model_available,
                },
                "matched_skills": matched_required + matched_nice,
                "missing_skills": missing_required,
                "why_this_role_fits": reason,
                "skills_to_learn": top_learning,
                "skill_profile": skill_profile,
                "expected_experience_level": role["expected_experience_level"],
                "_sort_skills": len(matched_required),
            })
        role_matches.sort(
            key=lambda item: (-item["match_score"], -item["_sort_skills"], item["role"].casefold())
        )
        for role in role_matches:
            del role["_sort_skills"]
        highlights = ", ".join(detected_skills[:6]) if detected_skills else "few recognized role skills"
        summary = (
            f"The resume highlights {highlights}."
            if years is None
            else f"The resume highlights {highlights} and states about {years:g} years of experience."
        )
        result = {
            "roles": role_matches[:top_n],
            "detected_skills": detected_skills,
            "years_of_experience": years,
            "candidate_summary": summary,
            "semantic_model_available": self.semantic_model_available,
        }
        with self.cache_lock:
            self.cache[cache_key] = result
            self.cache.move_to_end(cache_key)
            while len(self.cache) > self.config["cache_size"]:
                self.cache.popitem(last=False)
        return json.loads(json.dumps(result))
