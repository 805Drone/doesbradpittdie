import json
f = json.load(open('data/films.json', encoding='utf-8'))
for i in range(0, len(f), 28):
    print('---BATCH---')
    for x in f[i:i + 28]:
        kind = 'TV' if x['type'] == 'tv' else 'film'
        ep = f", episode: {x['episode']}" if x.get('episode') else ''
        print(f"{x['slug']} = {x['title']} ({x['year']}, {kind}{ep})")
