from typing import Any, Dict, List


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_token(value: Any) -> str:
    return clean_text(value).casefold()


def as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def clean_list(value: Any) -> List[str]:
    return [item for item in (clean_text(v) for v in as_list(value)) if item]


def get_value(source: Any, key: str, default: Any = None) -> Any:
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def object_dict(source: Any) -> Dict[str, Any]:
    if not source:
        return {}
    if isinstance(source, dict):
        return source
    if hasattr(source, "to_dict"):
        return source.to_dict()
    return vars(source) if hasattr(source, "__dict__") else {}


def names_from_items(items: Any) -> List[str]:
    values: List[str] = []
    for item in as_list(items):
        values.extend(_item_names(item))
    return values


def build_context(subscribe: Any, media: Any = None) -> Dict[str, Any]:
    sub = object_dict(subscribe)
    med = object_dict(media)
    return {
        "title": " ".join(_title_values(sub, med)),
        "type": clean_list([sub.get("type"), med.get("type")]),
        "username": clean_text(sub.get("username")),
        "category": clean_list([sub.get("media_category"), med.get("category")]),
        "genre": names_from_items(med.get("genres")),
        "country": _country_values(med),
        "language": _language_values(med),
    }


def build_changes(subscribe: Any, payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    changes: Dict[str, Dict[str, Any]] = {}
    for key, new_value in payload.items():
        old_value = get_value(subscribe, key)
        if old_value != new_value:
            changes[key] = {"old": old_value, "new": new_value}
    return changes


def has_token(values: List[Any], expected: List[Any]) -> bool:
    value_set = {normalize_token(value) for value in values if normalize_token(value)}
    expected_set = {normalize_token(value) for value in expected if normalize_token(value)}
    return bool(value_set & expected_set)


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return not clean_list(value)
    return False


def safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def int_list(value: Any) -> List[int]:
    result: List[int] = []
    for item in as_list(value):
        try:
            result.append(int(item))
        except (TypeError, ValueError):
            continue
    return result


def _item_names(item: Any) -> List[str]:
    if not isinstance(item, dict):
        text = clean_text(item)
        return [text] if text else []
    values: List[str] = []
    for key in ("name", "id", "iso_3166_1", "iso_639_1", "english_name"):
        text = clean_text(item.get(key))
        if text:
            values.append(text)
    return values


def _title_values(sub: Dict[str, Any], med: Dict[str, Any]) -> List[str]:
    keys = ("name", "keyword", "title", "original_title", "en_title", "original_name")
    seen, values = set(), []
    for source in (sub, med):
        for key in keys:
            text = clean_text(source.get(key))
            if text and text not in seen:
                seen.add(text)
                values.append(text)
    return values


def _country_values(media: Dict[str, Any]) -> List[str]:
    values = names_from_items(media.get("origin_country"))
    values.extend(names_from_items(media.get("production_countries")))
    values.extend(names_from_items(media.get("countries")))
    return values


def _language_values(media: Dict[str, Any]) -> List[str]:
    values = clean_list([media.get("original_language")])
    values.extend(names_from_items(media.get("languages")))
    values.extend(names_from_items(media.get("spoken_languages")))
    return values
