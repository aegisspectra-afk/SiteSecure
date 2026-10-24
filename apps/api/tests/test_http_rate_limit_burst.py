from app.main import http_rate_limit_burst


def test_production_http_burst_stays_tight():
    assert http_rate_limit_burst("production") == 120
    assert http_rate_limit_burst("staging") == 120


def test_development_http_burst_allows_local_ui_walk():
    assert http_rate_limit_burst("development") == 1200
    assert http_rate_limit_burst("development") > http_rate_limit_burst("production")
