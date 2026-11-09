"""验证正式源快照、可重复构建、数据引用与离线素材。"""
import hashlib
import json
from pathlib import Path
import tempfile
from build_graph_data import build, ROOT


def validate():
    target = ROOT / 'assets/data/graph-data.json'
    original = target.read_bytes()
    data = json.loads(original)
    with tempfile.TemporaryDirectory() as tmp:
        first, second = Path(tmp) / 'first.json', Path(tmp) / 'second.json'
        build(ROOT / 'source', first)
        build(ROOT / 'source', second)
        assert first.read_bytes() == second.read_bytes() == original, '构建结果不一致或静态数据已过时'
    for name, expected in data['sourceHashes'].items():
        assert hashlib.sha256((ROOT / 'source' / name).read_bytes()).hexdigest() == expected
    for relative in ['index.html', 'app.js', 'styles.css', '启动网站.bat', '停止网站.bat',
                     'assets/visuals/museum-background.png', 'assets/visuals/favicon.svg']:
        assert (ROOT / relative).is_file(), f'缺少文件：{relative}'
    source_files = sorted(p.relative_to(ROOT / 'source').as_posix() for p in (ROOT / 'source').rglob('*') if p.is_file())
    assert source_files == sorted(data['sourceHashes']), '源快照应仅包含正式输入文件'
    nodes = {n['id']: n for n in data['nodes']}
    aliases = [a for a in data['aliases'] if a['alias'] == '弘一']
    assert aliases and all(a['entity_id'] == data['canonicalNodeId'] for a in aliases)
    duplicates = {}
    for n in nodes.values():
        duplicates.setdefault(n['name'], []).append(n['id'])
    assert any(len(ids) > 1 for ids in duplicates.values()), '同名实体不应按名称合并'
    assert len(data['predicates']) == 61 and all(p['id'] != 'CREATED' for p in data['predicates'])
    assert all(not e['quote'] for e in data['evidence'] if e['source_kind'] == 'docx')
    result = {'passed': True, 'repeatableBuild': True,
              'graphSHA256': hashlib.sha256(original).hexdigest(),
              'sourceFiles': len(source_files), 'entities': len(nodes),
              'relations': len(data['edges']), 'attributes': len(data['attributes']),
              'evidence': len(data['evidence']), 'defaultNodes': len(data['defaultNodeIds'])}
    (ROOT / 'qa').mkdir(exist_ok=True)
    (ROOT / 'qa/data-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    validate()
