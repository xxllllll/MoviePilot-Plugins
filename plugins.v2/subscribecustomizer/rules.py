import re
from typing import Any, Callable, Dict, List, Tuple

try:
    from .helpers import (
        build_changes, build_context, clean_list, clean_text, has_token,
        int_list, is_empty, normalize_token, safe_int,
    )
except ImportError:
    from helpers import (  # type: ignore
        build_changes, build_context, clean_list, clean_text, has_token,
        int_list, is_empty, normalize_token, safe_int,
    )

MATCH_MULTI_FIELDS = {
    "category_any": "category",
    "genre_any": "genre",
    "country_any": "country",
    "language_any": "language",
}
SET_FIELDS = {
    "quality", "resolution", "effect", "include", "exclude", "sites", "site_names",
    "filter", "filter_groups", "downloader", "save_path", "search_imdbid", "custom_words", "media_category",
}
TEXT_SET_FIELDS = {
    "quality", "resolution", "effect", "include", "exclude", "filter", "downloader", "save_path",
    "custom_words", "media_category",
}
LIST_SET_FIELDS = {"sites", "filter_groups", "site_names"}
SAMPLE_RULES = [
    {
        "name": "韩剧固定 1080p",
        "enabled": False,
        "priority": 10,
        "match": {"type": "电视剧", "country_any": ["KR", "韩国"]},
        "set": {"resolution": "1080p"},
    },
    {
        "name": "综艺真人秀只订阅观众正片",
        "enabled": False,
        "priority": 20,
        "match": {"type": "电视剧", "genre_any": ["综艺", "真人秀"]},
        "set": {"site_names": ["观众"], "include": "正片"},
    },
]


def parse_rules(raw_rules: Any) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings: List[str] = []
    if raw_rules in (None, ""):
        return [], warnings
    if not isinstance(raw_rules, list):
        return [], ["rules 必须是数组"]
    rules: List[Dict[str, Any]] = []
    for index, raw_rule in enumerate(raw_rules):
        rule, rule_warnings = normalize_rule(raw_rule, index)
        warnings.extend(rule_warnings)
        if rule and rule["enabled"]:
            rules.append(rule)
    return sorted(rules, key=lambda item: item["priority"]), warnings


def normalize_rule(raw_rule: Any, index: int) -> Tuple[Dict[str, Any] | None, List[str]]:
    if not isinstance(raw_rule, dict):
        return None, [f"第 {index + 1} 条规则不是对象"]
    name = clean_text(raw_rule.get("name")) or f"规则 {index + 1}"
    match = _normalize_match(raw_rule.get("match") or {}, name)
    set_data = _normalize_set(raw_rule.get("set") or {})
    warnings = match.pop("__warnings__", [])
    if not set_data and raw_rule.get("enabled"):
        warnings.append(f"{name} 没有可写入动作，已跳过")
        return None, warnings
    if warnings:
        return None, warnings
    return {
        "name": name,
        "enabled": bool(raw_rule.get("enabled")),
        "priority": safe_int(raw_rule.get("priority"), index + 1),
        "match": match,
        "set": set_data,
    }, warnings


def evaluate_rules(
    rules: List[Dict[str, Any]],
    subscribe: Any,
    media: Any,
    site_resolver: Callable[[List[str]], Tuple[List[int], List[str]]],
) -> Dict[str, Any]:
    context = build_context(subscribe, media)
    payload: Dict[str, Any] = {}
    matched: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    warnings: List[str] = []
    for rule in rules:
        ok, reason = match_rule(rule, context)
        if not ok:
            skipped.append({"name": rule["name"], "reason": reason})
            continue
        action, action_warnings, fatal = action_payload(rule["set"], site_resolver)
        warnings.extend(action_warnings)
        if fatal:
            skipped.append({"name": rule["name"], "reason": "; ".join(action_warnings)})
            continue
        payload.update(action)
        matched.append({"name": rule["name"], "priority": rule["priority"], "fields": sorted(action)})
    changes = build_changes(subscribe, payload)
    return {"payload": {k: v["new"] for k, v in changes.items()}, "changes": changes,
            "matched_rules": matched, "skipped_rules": skipped, "warnings": warnings}


def match_rule(rule: Dict[str, Any], context: Dict[str, Any]) -> Tuple[bool, str]:
    match = rule.get("match") or {}
    if not match:
        return True, "matched"
    checks = [_match_type(match, context), _match_title(match, context), _match_username(match, context)]
    for field, context_key in MATCH_MULTI_FIELDS.items():
        checks.append(_match_multi(field, context_key, match, context))
    failed = [reason for ok, reason in checks if not ok]
    return (not failed, failed[0] if failed else "matched")


def action_payload(
    set_data: Dict[str, Any],
    site_resolver: Callable[[List[str]], Tuple[List[int], List[str]]],
) -> Tuple[Dict[str, Any], List[str], bool]:
    payload: Dict[str, Any] = {}
    for key, value in set_data.items():
        if key == "site_names":
            continue
        if key in TEXT_SET_FIELDS:
            payload[key] = clean_text(value)
        elif key == "search_imdbid":
            payload[key] = 1 if bool(value) else 0
        elif key == "filter_groups":
            payload[key] = clean_list(value)
        elif key == "sites":
            payload[key] = int_list(value)
    if set_data.get("site_names"):
        site_ids, missing = site_resolver(clean_list(set_data.get("site_names")))
        if missing:
            return {}, [f"站点名未解析：{', '.join(missing)}"], True
        payload["sites"] = site_ids
    return payload, [], False


def _normalize_match(match: Dict[str, Any], name: str) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {"__warnings__": []}
    if not isinstance(match, dict):
        normalized["__warnings__"].append(f"{name} 的 match 必须是对象")
        return normalized
    for key in ("type", "title_regex", "username"):
        text = clean_text(match.get(key))
        if text:
            normalized[key] = text
    if "title_regex" in normalized:
        _validate_regex(normalized["title_regex"], name, normalized)
    for key in MATCH_MULTI_FIELDS:
        values = clean_list(match.get(key))
        if values:
            normalized[key] = values
    return normalized


def _normalize_set(set_data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(set_data, dict):
        return {}
    normalized: Dict[str, Any] = {}
    for key, value in set_data.items():
        if key not in SET_FIELDS or is_empty(value):
            continue
        normalized[key] = clean_list(value) if key in LIST_SET_FIELDS else value
    return normalized


def _validate_regex(pattern: str, name: str, normalized: Dict[str, Any]) -> None:
    try:
        re.compile(pattern)
    except re.error as err:
        normalized["__warnings__"].append(f"{name} 的 title_regex 无效：{err}")


def _match_type(match: Dict[str, Any], context: Dict[str, Any]) -> Tuple[bool, str]:
    expected = match.get("type")
    if not expected:
        return True, ""
    values = context.get("type") or []
    if not values:
        return False, "type 缺失"
    return (has_token(values, [expected]), f"type 不匹配：{expected}")


def _match_title(match: Dict[str, Any], context: Dict[str, Any]) -> Tuple[bool, str]:
    pattern = match.get("title_regex")
    if not pattern:
        return True, ""
    title = clean_text(context.get("title"))
    if not title:
        return False, "title 缺失"
    return (bool(re.search(pattern, title, re.IGNORECASE)), f"title_regex 不匹配：{pattern}")


def _match_username(match: Dict[str, Any], context: Dict[str, Any]) -> Tuple[bool, str]:
    expected = match.get("username")
    if not expected:
        return True, ""
    username = clean_text(context.get("username"))
    if not username:
        return False, "username 缺失"
    return (normalize_token(username) == normalize_token(expected), f"username 不匹配：{expected}")


def _match_multi(field: str, context_key: str, match: Dict[str, Any], context: Dict[str, Any]) -> Tuple[bool, str]:
    expected = match.get(field) or []
    if not expected:
        return True, ""
    values = context.get(context_key) or []
    if not values:
        return False, f"{context_key} 缺失"
    return (has_token(values, expected), f"{field} 不匹配")
