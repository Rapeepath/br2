"""Downloads the gallery photos listed in data/<id>.json → public/images/gallery/.

  python research_notes/หุ่นยนต์ฮิวแมนนอยด์/tools/fetch_gallery.py           (skips files already there)
  python research_notes/หุ่นยนต์ฮิวแมนนอยด์/tools/fetch_gallery.py --force

For every `gallery` item it fetches a 1920px Commons thumbnail of `original` (or the frame `seek` seconds into a
video, which is also the poster of a `video` item), applies `crop` ([left, top, right, bottom] as fractions, used
only to trim a date stamp off CC0 photos), then saves two JPEGs without metadata (Pillow, quality 82):
  <src>       long side 1600 px
  <srcSmall>  640 px wide
Commons rate-limits bursts (HTTP 429), so files are fetched one at a time with a pause and retries.
"""
import io, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PUBLIC = os.path.join(ROOT, 'public')
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'ServoCatalogue/1.0 (static brochure build; https://commons.wikimedia.org/wiki/Commons:Reuse)'
FORCE = '--force' in sys.argv


def get(url, binary=True):
    for attempt in range(1, 8):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
                return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                ra = e.headers.get('Retry-After')
                wait = max(5 * attempt, int(ra) if ra and ra.isdigit() else 0)
                print(f'    HTTP {e.code}, waiting {wait}s', flush=True)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f'    {e}, retrying', flush=True)
            time.sleep(5 * attempt)
    raise RuntimeError(f'gave up on {url}')


def thumb_url(item):
    title = 'File:' + urllib.parse.unquote(item['page'].split('/wiki/File:', 1)[1])
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'formatversion': 2, 'titles': title,
                                'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': 1920})
    info = get(f'{API}?{q}', binary=False)['query']['pages'][0]['imageinfo'][0]
    if info['url'].split('?')[0] != item['original']:
        raise SystemExit(f"{item['src']}: original {item['original']} does not match Commons ({info['url']})")
    url = info['thumburl'].split('?')[0]
    if item.get('seek') is not None:
        url = re.sub(r'/(\d+)px--?', lambda m: f"/{m.group(1)}px-seek%3D{item['seek']}-", url, count=1)
    return url


def save(im, dest, size):
    im = im.copy()
    im.thumbnail(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, 'JPEG', quality=82, optimize=True, progressive=True)  # no exif/icc passed → stripped
    return im.size


def main():
    for name in sorted(os.listdir(DATA)):
        if not name.endswith('.json') or name == 'market.json':
            continue
        model = json.load(open(os.path.join(DATA, name), encoding='utf-8'))
        for item in model.get('gallery') or []:
            big, small = (os.path.join(PUBLIC, item[k]) for k in ('src', 'srcSmall'))
            if not FORCE and os.path.exists(big) and os.path.exists(small):
                continue
            url = thumb_url(item)
            print(f"  ↓ {item['src']}  ←  {url[:110]}…", flush=True)
            im = Image.open(io.BytesIO(get(url))).convert('RGB')
            if item.get('crop'):
                l, t, r, b = item['crop']
                w, h = im.size
                im = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))
            s1 = save(im, big, (1600, 1600))
            s2 = save(im, small, (640, 10_000))
            print(f'    {s1[0]}x{s1[1]}, small {s2[0]}x{s2[1]}', flush=True)
            time.sleep(3)


if __name__ == '__main__':
    main()
