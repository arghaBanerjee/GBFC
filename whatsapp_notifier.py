import os
from typing import Any, Dict, List, Optional

import requests
from local_env import load_local_env

load_local_env()

GREEN_API_INSTANCE_ID = os.environ.get("GREEN_API_INSTANCE_ID", "").strip()
GREEN_API_TOKEN = os.environ.get("GREEN_API_TOKEN", "").strip()
WHATSAPP_GROUP_ID = os.environ.get("WHATSAPP_GROUP_ID", "").strip()
WHATSAPP_GROUP_NAME = os.environ.get("WHATSAPP_GROUP_NAME", "").strip()
GREEN_API_BASE_URL = f"https://api.green-api.com/waInstance{GREEN_API_INSTANCE_ID}" if GREEN_API_INSTANCE_ID else ""


def whatsapp_is_configured() -> bool:
    return bool(GREEN_API_INSTANCE_ID and GREEN_API_TOKEN and (WHATSAPP_GROUP_ID or WHATSAPP_GROUP_NAME))


def _build_url(method_name: str) -> str:
    if not GREEN_API_BASE_URL or not GREEN_API_TOKEN:
        return ""
    return f"{GREEN_API_BASE_URL}/{method_name}/{GREEN_API_TOKEN}"


def _request(method: str, endpoint: str, *, json_payload: Optional[Dict[str, Any]] = None, timeout: int = 10) -> Dict[str, Any]:
    url = _build_url(endpoint)
    if not url:
        return {"success": False, "error": "WhatsApp service is not configured"}

    try:
        response = requests.request(method, url, json=json_payload, timeout=timeout)
        response.raise_for_status()
        data = response.json() if response.content else {}
        return {"success": True, "data": data}
    except requests.exceptions.RequestException as exc:
        return {"success": False, "error": str(exc)}


def resolve_group_chat_id() -> Dict[str, Any]:
    if WHATSAPP_GROUP_ID:
        return {"success": True, "chat_id": WHATSAPP_GROUP_ID, "source": "group_id"}
    if not WHATSAPP_GROUP_NAME:
        return {"success": False, "error": "WhatsApp group is not configured"}

    matches_response = find_group_chat_id(WHATSAPP_GROUP_NAME)
    if not matches_response.get("success"):
        return matches_response

    matches = matches_response.get("data") or []
    if not matches:
        return {"success": False, "error": f'WhatsApp group "{WHATSAPP_GROUP_NAME}" was not found'}
    if len(matches) > 1:
        return {"success": False, "error": f'Multiple WhatsApp groups matched "{WHATSAPP_GROUP_NAME}"'}

    return {
        "success": True,
        "chat_id": matches[0].get("id"),
        "group_name": matches[0].get("name"),
        "source": "group_name",
    }


def send_group_message(message: str) -> Dict[str, Any]:
    if not whatsapp_is_configured():
        return {"success": False, "error": "WhatsApp service is not configured"}
    target_group = resolve_group_chat_id()
    if not target_group.get("success"):
        return target_group
    return _request("POST", "sendMessage", json_payload={"chatId": target_group.get("chat_id"), "message": message})


def get_instance_state() -> Dict[str, Any]:
    return _request("GET", "getStateInstance", timeout=5)


def keep_whatsapp_instance_alive() -> Dict[str, Any]:
    return get_instance_state()


def get_chats() -> Dict[str, Any]:
    return _request("GET", "getChats")


def find_group_chat_id(group_name: str) -> Dict[str, Any]:
    chats_response = get_chats()
    if not chats_response.get("success"):
        return chats_response

    chats: List[Dict[str, Any]] = chats_response.get("data") or []
    normalized_group_name = group_name.strip().lower()
    matches = [
        {"id": chat.get("id"), "name": chat.get("name")}
        for chat in chats
        if (chat.get("name") or "").strip().lower() == normalized_group_name
    ]
    return {"success": True, "data": matches}


def format_match_message(name: str, date: str, time: Optional[str], location: Optional[str]) -> str:
    time_line = f"🕐 {time}\n" if time else ""
    location_line = f"📍 {location}\n" if location else ""
    return (
        f"⚽ *NEW MATCH*\n\n"
        f"{name}\n"
        f"📅 {date}\n"
        f"{time_line}"
        f"{location_line}\n"
        f"Check the app for full details."
    )


def format_practice_message(date: str, time: Optional[str], location: Optional[str]) -> str:
    time_line = f"🕐 {time}\n" if time else ""
    location_line = f"📍 {location}\n" if location else ""
    return (
        f"🏃 *NEW PRACTICE SESSION*\n\n"
        f"📅 {date}\n"
        f"{time_line}"
        f"{location_line}\n"
        f"Please update your availability in the app."
    )


def format_forum_post_message(author_name: str, content: str) -> str:
    trimmed_content = content.strip()
    preview = trimmed_content[:180] + ("..." if len(trimmed_content) > 180 else "")
    return (
        f"💬 *NEW FORUM POST*\n\n"
        f"By {author_name}\n\n"
        f"{preview}\n\n"
        f"Open the app to join the conversation."
    )


def format_payment_request_message(date: str, time: Optional[str], location: Optional[str]) -> str:
    time_line = f"🕐 {time}\n" if time else ""
    location_line = f"📍 {location}\n" if location else ""
    return (
        f"💷 *PRACTICE PAYMENT REQUEST*\n\n"
        f"📅 {date}\n"
        f"{time_line}"
        f"{location_line}\n"
        f"Available players should confirm payment in the app."
    )
