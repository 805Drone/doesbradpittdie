import re, urllib.request, collections
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
url = "https://www.themoviedb.org/movie/228150/images/backdrops"
req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
pairs = re.findall(r"/t/p/([A-Za-z0-9_]+)/([A-Za-z0-9]+\.(?:jpg|png))", html)
c = collections.Counter(p[0] for p in pairs)
print(c.most_common())
for size, path in pairs[:12]:
    print(size, path)
# look at the structure around a backdrop card
i = html.find('class="backdrop')
print(html[i-300:i+600] if i > 0 else "no backdrop class")
