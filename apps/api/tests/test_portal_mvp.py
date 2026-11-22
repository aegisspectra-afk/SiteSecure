"""Portal MVP — site scope, quote open, service-call photo routes (unit level)."""

from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.errors import ApiError
from app.main import app
from app.portal_access import document_visible, portal_allowed_site_ids, portal_quote_openable


class _Resp:
  status_code = 200

  def __init__(self, data: list[dict]):
    self._data = data

  def json(self):
    return self._data


class _SiteGrantService:
  def __init__(self, grant_site_ids: list[str], customer_site_ids: list[str]):
    self.grant_site_ids = grant_site_ids
    self.customer_site_ids = customer_site_ids

  def get(self, table: str, *, params: dict | None = None, **_kwargs):
    params = params or {}
    if table == "customer_portal_site_grants":
      return _Resp([{"site_id": sid} for sid in self.grant_site_ids])
    if table == "sites":
      return _Resp([{"id": sid} for sid in self.customer_site_ids])
    return _Resp([])


def test_portal_allowed_site_ids_customer_scope():
  grant = {"scope": "customer", "id": "a1", "workspace_id": "w1", "customer_id": "c1"}
  svc = _SiteGrantService([], ["s1", "s2"])
  assert portal_allowed_site_ids(svc, grant) == {"s1", "s2"}


def test_portal_allowed_site_ids_sites_scope_intersection():
  grant = {"scope": "sites", "id": "a1", "workspace_id": "w1", "customer_id": "c1"}
  svc = _SiteGrantService(["s1"], ["s1", "s2"])
  assert portal_allowed_site_ids(svc, grant) == {"s1"}


def test_document_visible_service_call_entity():
  ids = {
    "customer_id": "c1",
    "site_ids": {"s1"},
    "job_ids": set(),
    "quote_ids": set(),
    "warranty_ids": set(),
    "project_ids": set(),
    "system_ids": set(),
    "service_call_ids": {"sc1"},
  }
  ok = {
    "visibility": "customer",
    "kind": "photo",
    "storage_bucket": "photos",
    "entity_type": "service_call",
    "entity_id": "sc1",
  }
  assert document_visible(ok, **ids) is True
  assert document_visible({**ok, "entity_id": "sc2"}, **ids) is False


def test_portal_quote_openable_statuses():
  assert portal_quote_openable({"status": "sent"}) is True
  assert portal_quote_openable({"status": "viewed"}) is True
  assert portal_quote_openable({"status": "draft"}) is False
  assert portal_quote_openable({"status": "approved"}) is False


def test_portal_service_call_photo_routes_registered():
  api = TestClient(app)
  fake = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  res = api.post(
    f"/api/v1/portal/access/{fake}/service-calls/{fake}/photos/upload",
    json={"mime_type": "image/jpeg", "byte_size": 1024},
  )
  assert res.status_code in {401, 404}, res.text


def test_portal_quote_open_route_registered():
  api = TestClient(app)
  fake = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  res = api.post(f"/api/v1/portal/access/{fake}/quotes/{fake}/open")
  assert res.status_code in {401, 404}, res.text


def test_portal_create_service_call_rejects_foreign_site_scope():
  from app.routers import customer_portal as cp

  grant = {
    "id": "acc",
    "scope": "sites",
    "workspace_id": "w1",
    "customer_id": "c1",
    "capabilities": ["portal.service.view"],
  }
  svc = _SiteGrantService(["s1"], ["s1", "s2"])
  with pytest.raises(ApiError) as exc:
    cp._portal_assert_site_allowed(svc, grant, "s2")
  assert exc.value.status_code == 404