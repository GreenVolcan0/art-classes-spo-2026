import os

filters = ["fast-api"]#["default", "fast-api", "react"]

templates = {
    "default": {
        "ex-dirs": [".git", ".venv", "venv", "__pycache__"],
        "ex-files": [".env", "code.txt", "load.py"],
        "in-types": []
    },
    "python": {
        "ex-dirs": ["__pycache__", ".pytest_cache", ".mypy_cache"],
        "ex-files": ["__init__.py"],
        "in-types": [".py"]
    },
    "fast-api": {
        "inherits": "python",
        "ex-dirs": [],
        "ex-files": [],
        "in-types": [".py", ".json", ".yml", ".yaml", ".ini", ".toml", ".conf"]
    },
    "js": {
        "ex-dirs": ["node_modules","dist","build",".next"],
        "ex-files": ["package-lock.json","yarn.lock","pnpm-lock.yaml"],
        "in-types": [".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json"]
    },
    "react": {
        "inherits": "js",
        "ex-dirs": [],
        "ex-files": [],
        "in-types": [".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json"]
    }
}

EXCLUDE_DIRS = {}
EXCLUDE_FILES = {}
INCLUDE_TYPES = []


def merge_filters(base, override):
    result = {
        "ex-dirs": set(base.get("ex-dirs", [])),
        "ex-files": set(base.get("ex-files", [])),
        "in-types": set(base.get("in-types", []))
    }

    for key in ("ex-dirs", "ex-files", "in-types"):
        result[key].update(override.get(key, []))

    return result


def get_template(name, visited=None):
    if name not in templates:
        raise ValueError(f"Неизвестный шаблон: {name}")

    if visited is None:
        visited = set()

    if name in visited:
        raise ValueError(f"Обнаружен цикл наследования шаблонов: {name}")

    visited = visited | {name}
    template = templates[name]

    parent_name = template.get("inherits")

    if parent_name:
        parent = get_template(parent_name, visited)
    else:
        parent = {
            "ex-dirs": set(),
            "ex-files": set(),
            "in-types": set()
        }

    return merge_filters(parent, template)


def get_filters(filter_names):
    result = {"ex-dirs": set(), "ex-files": set(), "in-types": set()}
    for name in filter_names:
        result = merge_filters(result, get_template(name))

    result["ex-dirs"].update(EXCLUDE_DIRS)
    result["ex-files"].update(EXCLUDE_FILES)
    result["in-types"].update(INCLUDE_TYPES)

    return result


def make_tree(directory, ex_dirs, ex_files, inc_types):
    result = []
    directory = os.path.abspath(directory)
    for root, dirs, files in os.walk(directory):
        dirs[:] = sorted(d for d in dirs if d not in ex_dirs)

        for file in sorted(files):
            if inc_types and not any(file.endswith(ext) for ext in inc_types):
                continue

            if file in ex_files:
                continue

            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, directory)

            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except (OSError, UnicodeError) as e:
                content = f"# Ошибка чтения файла: {e}"

            result.append(
                f"{directory}\\{rel_path}\n\n"
                f"{content}\n"
            )

    return "\n".join(result)


def main():
    active = get_filters(filters)

    text = make_tree("./", active["ex-dirs"], active["ex-files"], active["in-types"])

    with open("code.txt", "w", encoding="utf-8") as f:
        f.write(text)

if __name__ == "__main__":
    main()