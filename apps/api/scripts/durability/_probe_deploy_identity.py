import re
import urllib.request

url = "https://site-secure-umber.vercel.app/"
html = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")
m = re.search(r"/assets/index-[A-Za-z0-9_-]+\.js", html)
print("asset", m.group(0) if m else None)
js_url = "https://site-secure-umber.vercel.app" + m.group(0)
js = urllib.request.urlopen(js_url, timeout=60).read().decode("utf-8", "replace")
versions = sorted(set(re.findall(r"0\.1\.[0-9]+-beta", js)))
print("versions", versions)
for v in versions:
    idx = js.find(v)
    print("ctx", v, repr(js[max(0, idx - 40) : idx + 60]))
print("has_015", "0.1.5-beta" in js)
print("has_014", "0.1.4-beta" in js)
print("service_role", "service_role" in js.lower())
urls = sorted(set(re.findall(r"https://[a-zA-Z0-9._:/-]+", js)))
for u in urls:
    if any(x in u for x in ["supabase", "api", "vercel", "localhost", "127.0.0.1", "railway", "render", "fly"]):
        print("url", u[:160])
locals_ = sorted(set(re.findall(r"https?://(?:localhost|127\.0\.0\.1)[^\s\"']*", js)))
print("local_urls", locals_[:30])
print("bundle_bytes", len(js))
print("tagged_candidate", "dde129b / 0.1.5-beta")
print("identity_match", "0.1.5-beta" in js and "0.1.2-beta" not in versions)
