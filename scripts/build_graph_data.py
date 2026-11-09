"""从复核过滤版的正式 data/ontology 生成静态图谱；不读取审计或原文。"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = [f"data/{name}.json" for name in
         ("entities", "relations", "attributes", "aliases", "evidence", "documents", "metadata")]
FILES += ["ontology/ontology.json"]
CENTRAL_ID = "ENT_1db4e49631614750"


def build(source, output):
    if source.is_file():
        with zipfile.ZipFile(source) as archive:
            raw = {name: archive.read(next(n for n in archive.namelist() if n.endswith('/' + name)))
                   for name in FILES}
    else:
        raw = {name: (source / name).read_bytes() for name in FILES}
    data = {Path(name).stem: json.loads(value) for name, value in raw.items()}
    entities, relations, attributes = (data[name] for name in ("entities", "relations", "attributes"))
    assert (len(entities), len(relations), len(attributes)) == (828, 1479, 658), "正式数据数量不符"
    by_id = {n["id"]: n for n in entities}
    evidence = {e["id"]: e for e in data["evidence"]}
    documents = {d["id"]: d for d in data["documents"]}
    assert len(by_id) == len(entities) and CENTRAL_ID in by_id
    assert len({e['id'] for e in relations + attributes}) == 2137
    classes = {c["id"]: c for c in data["ontology"]["classes"]}
    predicates = {p["id"]: p for p in data["ontology"]["relations"]}
    attribute_defs = data["ontology"]["attributes"]
    attr_ids = {a["id"] for a in attribute_defs}
    degree = collections.Counter()
    relation_ids = {r['id'] for r in relations}
    neighbors = {CENTRAL_ID}
    for statement in relations + attributes:
        assert statement["review_status"] == "accepted" and statement["display_eligible"] is True
        assert statement["subject_id"] in by_id
        if statement['id'] in relation_ids:
            assert statement["object_kind"] == "entity" and statement["object"] in by_id
            assert statement["predicate"] in predicates
            degree.update({statement["subject_id"], statement["object"]})
            if CENTRAL_ID in (statement["subject_id"], statement["object"]):
                neighbors.update((statement["subject_id"], statement["object"]))
        else:
            assert statement["object_kind"] == "literal" and statement["predicate"] in attr_ids
    for record in entities + relations + attributes + data["aliases"]:
        assert set(record.get("evidence_ids", [])).issubset(evidence), record["id"]
    for alias in data["aliases"]:
        assert alias["entity_id"] in by_id
    for ev in evidence.values():
        assert ev["document_id"] in documents
        if ev["source_kind"] == "docx":
            assert not ev["quote"], "不允许回填已过滤正文"
    default_ids = sorted(n for n in neighbors if by_id[n]["type"] == "Person")
    assert len(default_ids) == 53 and len(neighbors) == 354
    alias_index = collections.defaultdict(set)
    for alias in data["aliases"]:
        alias_index[alias["entity_id"]].add(alias["alias"])
    nodes = []
    for n in entities:
        assert n["type"] in classes
        own_aliases = [a if isinstance(a, str) else a["alias"] for a in n.get("aliases", [])]
        nodes.append({**n, "label": n["name"], "degree": degree[n["id"]],
                      "searchAliases": sorted(set(own_aliases) | alias_index[n["id"]])})
    used = collections.Counter(r["predicate"] for r in relations)
    assert len(used) == 61
    graph = {
        "schemaVersion": 1, "canonicalNodeId": CENTRAL_ID, "defaultNodeIds": default_ids,
        "metadata": data["metadata"],
        "sourceHashes": {name: hashlib.sha256(raw[name]).hexdigest() for name in sorted(raw)},
        "stats": {"entities": len(nodes), "relations": len(relations), "attributes": len(attributes),
                  "evidence": len(evidence), "aliases": len(data["aliases"]),
                  "nodeTypeCounts": dict(collections.Counter(n["type"] for n in nodes)),
                  "relationCounts": dict(sorted(used.items()))},
        "classes": data["ontology"]["classes"],
        "predicates": [p for p in data["ontology"]["relations"] if p["id"] in used],
        "attributeDefinitions": attribute_defs,
        "nodes": nodes,
        "edges": [{**r, "source": r["subject_id"], "target": r["object"]} for r in relations],
        "attributes": attributes, "aliases": data["aliases"],
        "evidence": data["evidence"], "documents": data["documents"],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(graph, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({**graph["stats"], "defaultNodes": len(default_ids), "oneHopNodes": len(neighbors),
                      "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "source")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/data/graph-data.json")
    args = parser.parse_args()
    build(args.source, args.output)
