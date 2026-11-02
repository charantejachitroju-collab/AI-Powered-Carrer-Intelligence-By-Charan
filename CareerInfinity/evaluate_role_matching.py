import argparse
import json
from pathlib import Path

from app import ROLE_MATCHER, SKILL_ALIASES


def main():
    parser = argparse.ArgumentParser(description="Evaluate role ranking on labeled synthetic resumes.")
    parser.add_argument(
        "--skip-semantic",
        action="store_true",
        help="Use the lexical fallback without loading the sentence-transformer model.",
    )
    arguments = parser.parse_args()
    if not arguments.skip_semantic:
        ROLE_MATCHER.initialize_embeddings()

    sample_path = Path(__file__).with_name("evaluation_samples.json")
    samples = json.loads(sample_path.read_text(encoding="utf-8"))
    top_one = 0
    top_three = 0
    for sample in samples:
        result = ROLE_MATCHER.match(
            sample["resume"],
            SKILL_ALIASES,
            top_n=3,
        )
        ranked_titles = [role["role"] for role in result["roles"]]
        expected = sample["expected_role"]
        top_one += bool(ranked_titles and ranked_titles[0] == expected)
        top_three += expected in ranked_titles
        print(f"{expected}: {', '.join(ranked_titles)}")

    count = len(samples)
    if count < 15 or count > 20:
        raise ValueError(f"Expected 15-20 labeled resumes; found {count}.")
    print(f"Samples: {count}")
    print(f"Semantic embeddings available: {ROLE_MATCHER.semantic_model_available}")
    print(f"Top-1 accuracy: {top_one / count:.1%} ({top_one}/{count})")
    print(f"Top-3 accuracy: {top_three / count:.1%} ({top_three}/{count})")


if __name__ == "__main__":
    main()
