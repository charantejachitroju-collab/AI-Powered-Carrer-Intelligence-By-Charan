#!/usr/bin/env python3
"""Check that every learning-resource URL in roadmaps.json responds with HTTP 200."""

import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


CATALOG = Path(__file__).with_name("roadmaps.json")


def main():
    roles = json.loads(CATALOG.read_text(encoding="utf-8"))
    broken = []
    checked = 0
    for role in roles:
        for stage in role["stages"]:
            for resource in stage["resources"]:
                url = resource["url"]
                checked += 1
                try:
                    request = Request(url, headers={"User-Agent": "CareerInfinity-roadmap-link-check/1.0"})
                    with urlopen(request, timeout=20) as response:
                        if response.status != 200:
                            broken.append((resource["id"], url, response.status))
                except (HTTPError, URLError, TimeoutError, OSError) as error:
                    status = getattr(error, "code", "unreachable")
                    broken.append((resource["id"], url, status))

    print(f"Checked {checked} resource URLs.")
    if broken:
        print("Broken or non-200 links:")
        for resource_id, url, status in broken:
            print(f"- {resource_id}: HTTP {status} — {url}")
        return 1
    print("All resource URLs returned HTTP 200.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
