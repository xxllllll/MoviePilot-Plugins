from typing import Any, Dict, List, Tuple

from app import schemas
from app.core.event import Event, eventmanager
from app.db.subscribe_oper import SubscribeOper
from app.log import logger
from app.plugins import _PluginBase
from app.schemas.types import EventType

from .helpers import clean_text
from .rules import SAMPLE_RULES, evaluate_rules, parse_rules


class SubscribeCustomizer(_PluginBase):
    """按规则自动调整订阅参数。"""

    plugin_name = "订阅参数定制"
    plugin_desc = "按可视化规则自动定制媒体订阅参数。"
    plugin_icon = "setting.png"
    plugin_version = "1.0.0"
    plugin_author = "xxllllll"
    author_url = "https://github.com/jxxghp/MoviePilot-Plugins"
    plugin_config_prefix = "subscribecustomizer_"
    plugin_order = 35
    auth_level = 1

    def __init__(self):
        super().__init__()
        self._enabled = False
        self._config: Dict[str, Any] = self._default_config()
        self._rules: List[Dict[str, Any]] = []
        self._warnings: List[str] = []

    def init_plugin(self, config: dict = None):
        """加载插件配置与规则。"""
        self._config = self._normalize_config(config or {})
        self._enabled = bool(self._config.get("enabled"))
        try:
            self._rules, self._warnings = parse_rules(self._config.get("rules"))
        except Exception as err:
            self._rules, self._warnings = [], [f"规则解析失败：{err}"]
            logger.error(f"订阅参数定制规则解析失败：{err}")
        logger.info(f"订阅参数定制已加载：启用={self._enabled}，有效规则={len(self._rules)}")

    def get_state(self) -> bool:
        return bool(self._enabled)

    @staticmethod
    def get_command() -> List[Dict[str, Any]]:
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        return [
            {"path": "/status", "endpoint": self.status, "methods": ["GET"], "auth": "bear", "summary": "获取订阅参数定制状态"},
            {"path": "/sites", "endpoint": self.sites, "methods": ["GET"], "auth": "bear", "summary": "获取站点选项"},
            {"path": "/validate_rules", "endpoint": self.validate_rules, "methods": ["GET"], "auth": "bear", "summary": "校验当前规则"},
            {"path": "/preview/{subscribe_id}", "endpoint": self.preview, "methods": ["GET"], "auth": "bear", "summary": "预览单个订阅"},
            {"path": "/apply/{subscribe_id}", "endpoint": self.apply, "methods": ["POST"], "auth": "bear", "summary": "应用到单个订阅"},
        ]

    @staticmethod
    def get_render_mode() -> Tuple[str, str]:
        return "vue", "dist/assets"

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        return [], self._current_config()

    def get_page(self) -> List[dict]:
        return []

    def stop_service(self):
        pass

    def status(self) -> schemas.Response:
        return schemas.Response(success=True, data={
            "enabled": self._enabled,
            "config": self._current_config(),
            "rules": self._rules,
            "warnings": self._warnings,
            "sites": self._site_options(),
            "sample_rules": SAMPLE_RULES,
        })

    def sites(self) -> schemas.Response:
        return schemas.Response(success=True, data=self._site_options())

    def validate_rules(self) -> schemas.Response:
        rules, warnings = parse_rules(self._config.get("rules"))
        return schemas.Response(success=True, data={
            "enabled_count": len(rules),
            "rules": rules,
            "warnings": warnings,
        })

    def preview(self, subscribe_id: int) -> schemas.Response:
        subscribe = self._get_subscribe(subscribe_id)
        if not subscribe:
            return schemas.Response(success=False, message="订阅不存在")
        result = self._evaluate(subscribe, None)
        return schemas.Response(success=True, data=result)

    def apply(self, subscribe_id: int) -> schemas.Response:
        subscribe = self._get_subscribe(subscribe_id)
        if not subscribe:
            return schemas.Response(success=False, message="订阅不存在")
        result = self._evaluate(subscribe, None)
        payload = result.get("payload") or {}
        if payload:
            SubscribeOper().update(subscribe_id, payload)
            logger.info(f"订阅参数定制手动应用成功：订阅={subscribe_id}，字段={sorted(payload)}")
        result["applied"] = bool(payload)
        return schemas.Response(success=True, data=result)

    @eventmanager.register(EventType.SubscribeAdded)
    def on_subscribe_added(self, event: Event):
        """新增订阅后自动应用规则。"""
        if not self.get_state() or not event or not event.event_data:
            return
        try:
            self._handle_subscribe_added(event.event_data)
        except Exception as err:
            logger.error(f"订阅参数定制处理新增订阅失败：{err}")

    @staticmethod
    def _default_config() -> Dict[str, Any]:
        return {"enabled": False, "rules": []}

    @classmethod
    def _normalize_config(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        rules = config.get("rules") if isinstance(config.get("rules"), list) else []
        return {"enabled": bool(config.get("enabled")), "rules": rules}

    def _current_config(self) -> Dict[str, Any]:
        return {"enabled": bool(self._enabled), "rules": list(self._config.get("rules") or [])}

    def _handle_subscribe_added(self, event_data: Dict[str, Any]) -> None:
        subscribe_id = event_data.get("subscribe_id")
        if not subscribe_id:
            logger.warning("订阅参数定制收到新增订阅事件，但缺少 subscribe_id")
            return
        subscribe = self._get_subscribe(int(subscribe_id))
        if not subscribe:
            logger.warning(f"订阅参数定制未找到订阅：{subscribe_id}")
            return
        result = self._evaluate(subscribe, event_data.get("mediainfo") or {})
        payload = result.get("payload") or {}
        if not payload:
            logger.info(f"订阅参数定制未产生更新：订阅={subscribe_id}")
            return
        SubscribeOper().update(int(subscribe_id), payload)
        matched = [item.get("name") for item in result.get("matched_rules") or []]
        logger.info(f"订阅参数定制已更新订阅：订阅={subscribe_id}，规则={matched}，字段={sorted(payload)}")

    @staticmethod
    def _get_subscribe(subscribe_id: int):
        try:
            return SubscribeOper().get(subscribe_id)
        except Exception as err:
            logger.error(f"订阅参数定制查询订阅失败：{subscribe_id}，{err}")
            return None

    def _evaluate(self, subscribe: Any, media: Any) -> Dict[str, Any]:
        result = evaluate_rules(self._rules, subscribe, media, self._resolve_site_names)
        result["enabled"] = self._enabled
        result["warnings"] = [*self._warnings, *(result.get("warnings") or [])]
        return result

    def _resolve_site_names(self, names: List[str]) -> Tuple[List[int], List[str]]:
        name_to_id = {site["name"]: site["id"] for site in self._site_options()}
        site_ids, missing = [], []
        for name in names:
            if name in name_to_id:
                site_ids.append(name_to_id[name])
            else:
                missing.append(name)
        return site_ids, missing

    @staticmethod
    def _site_options() -> List[Dict[str, Any]]:
        try:
            from app.helper.sites import SitesHelper
            sites = SitesHelper().get_indexers() or []
        except Exception as err:
            logger.warning(f"订阅参数定制获取站点列表失败：{err}")
            return []
        return [item for item in (_site_option(site) for site in sites) if item]


def _site_option(site: Any) -> Dict[str, Any] | None:
    if not isinstance(site, dict):
        return None
    name = clean_text(site.get("name"))
    try:
        site_id = int(site.get("id"))
    except (TypeError, ValueError):
        return None
    return {"id": site_id, "name": name} if name else None
