#!/usr/bin/env python3
"""Throwaway enrichment generator for the Minha Cozinha experiment.

Reads four external spreadsheets (kept locally in ./source-xlsx, gitignored,
because they contain PII) and, for the 10 sample kitchens, emits one PII-free
JSON per kitchen into src/data-source-static/data/enrichment/<CS>.json.

Each datum is emitted as { "value": <v|null>, "source": "<provenance>" } so the
app can show where every field came from. Personal data (CPF, representative
names, personal phones) is never read into the output.

Run:  SOURCE_XLSX_DIR=./source-xlsx GENERATED_AT=2025-11-04T00:00:00Z \
      python3 scripts/minha-cozinha-enrichment/generate.py

Requires: openpyxl.
"""
from __future__ import annotations

import csv
import glob
import json
import os
import re
import unicodedata

import openpyxl

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CSV_PATH = os.path.join(
    REPO, "src", "data-source-static", "data", "cozinhas_com_geolocalizacao_all.csv"
)
OUT_DIR = os.path.join(REPO, "src", "data-source-static", "data", "enrichment")
SRC_DIR = os.environ.get(
    "SOURCE_XLSX_DIR", os.path.join(os.path.dirname(__file__), "source-xlsx")
)
GENERATED_AT = os.environ.get("GENERATED_AT", "unknown")

CODES = [
    "CS015497", "CS018836", "CS016009", "CS020860", "CS016512",
    "CS016720", "CS015938", "CS014824", "CS014558", "CS015374",
]

SRC_BANCO = "Banco de Cozinhas Solidárias (03/11/2025)"
SRC_FORM = "Mapeamento de Cozinhas (Formulário, 2024) — autodeclarado"
SRC_PAA = "CONAB/PAA 2025 (Programa de Aquisição de Alimentos — Cozinhas)"
SRC_CAF = "CAF-PJ — Cadastro Nacional da Agricultura Familiar (pessoa jurídica)"


def norm(s):
    if s is None:
        return ""
    s = str(s).strip().casefold()
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def toks(s):
    return set(re.findall(r"[a-z0-9]+", norm(s)))


def digits(s):
    return re.sub(r"\D", "", str(s or ""))


def sourced(value, source, note=None):
    out = {"value": value, "source": source}
    if note:
        out["note"] = note
    return out


def find_xlsx(token):
    hits = glob.glob(os.path.join(SRC_DIR, f"*{token}*"))
    if not hits:
        raise SystemExit(
            f"Missing source spreadsheet matching *{token}* in {SRC_DIR}. "
            "Drop the four .xlsx files there (see README)."
        )
    return hits[0]


def rows(path, sheet):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    data = [list(r) for r in wb[sheet].iter_rows(values_only=True)]
    wb.close()
    return data


def header_index(data, needle, limit=12):
    for i, r in enumerate(data[:limit]):
        if any(norm(c) == norm(needle) for c in r):
            return i
    return 0


def col_map(header):
    return {norm(c): i for i, c in enumerate(header) if c is not None}


def to_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def as_text(v):
    """Uniform display string: integral floats -> '4', else stripped text; None stays None."""
    if v is None or v == "":
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def load_targets():
    targets = {}
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            if row and row[0] in CODES:
                targets[row[0]] = {"nome": row[1], "municipio": row[5], "uf": row[6]}
    return targets


def build_banco(path):
    data = rows(path, "Sheet1")
    cm = col_map(data[0])
    ci = {
        "situacao": cm.get("situacao"),
        "func": cm.get("a cozinha esta em funcionamento atualmente?"),
        "ref": cm.get("quantidade refeicoes produzidas por dia"),
        "cnpj": cm.get("cnpj"),
    }
    by_code = {}
    for r in data[1:]:
        code = str(r[0]).strip()
        if code in CODES:
            by_code[code] = r
    return data[0], ci, by_code


def build_form(path):
    data = rows(path, "2466 Cozinhas Solidárias")
    hdr = data[0]
    cm = col_map(hdr)

    def col(prefix):
        for k, i in cm.items():
            if k.startswith(norm(prefix)):
                return i
        return None

    ci = {
        "nome": 1,
        "mun": col("municipio"),
        "onde": col("onde/como sao adquiridos"),
        "gasto": col("se sim, qual o valor medio"),
        "trab": col("quantas pessoas trabalham"),
    }
    return data[1:], ci


def match_form(nome, municipio, form_rows, ci):
    tn = toks(nome)
    best, best_score = None, 0
    for r in form_rows:
        if norm(r[ci["mun"]]) != norm(municipio):
            continue
        score = len(tn & toks(r[ci["nome"]]))
        if score > best_score:
            best_score, best = score, r
    return best if best_score >= 2 else None


def build_paa(path):
    ur = rows(path, "UNIDADES RECEBEDORAS")
    uh = header_index(ur, "Municipio Consumidor")
    ucm = col_map(ur[uh])
    ur_body = ur[uh + 1:]
    mun_i = ucm.get("municipio consumidor")
    cnpj_i = ucm.get("cnpj consumidor")

    prod = rows(path, "PRODUTOS")
    ph = header_index(prod, "MUNICÍPIO")
    pcm = col_map(prod[ph])
    prod_body = prod[ph + 1:]
    pmun_i = pcm.get("municipio")
    pprd_i = pcm.get("produto")
    pkg_i = pcm.get("quantidade (kg)")
    return {
        "ur": ur_body, "ur_mun": mun_i, "ur_cnpj": cnpj_i,
        "prod": prod_body, "p_mun": pmun_i, "p_prd": pprd_i, "p_kg": pkg_i,
    }


def build_caf(path):
    data = rows(path, "relatorio")
    hidx = header_index(data, "MUNICIPIO")
    cm = col_map(data[hidx])
    return {
        "body": data[hidx + 1:],
        "mun": cm.get("municipio"),
        "raz": cm.get("razao_social_entidade"),
    }


def cell(r, i):
    return r[i] if (i is not None and i < len(r) and r[i] not in (None, "")) else None


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = load_targets()

    banco_hdr, bci, banco = build_banco(find_xlsx("Banco"))
    form_rows, fci = build_form(find_xlsx("Mapeamento"))
    paa = build_paa(find_xlsx("CONAB"))
    caf = build_caf(find_xlsx("CAF"))

    for code in CODES:
        t = targets[code]
        municipio, nome = t["municipio"], t["nome"]
        mn = norm(municipio)

        # --- Angle C: status (Banco, join by CS) ---
        b = banco.get(code)
        if b:
            ref = to_float(cell(b, bci["ref"]))
            status = {
                "situacao": sourced(cell(b, bci["situacao"]), f"{SRC_BANCO} — coluna 'Situação'"),
                "emFuncionamento": sourced(cell(b, bci["func"]), f"{SRC_BANCO} — coluna 'A cozinha está em funcionamento atualmente?'"),
                "refeicoesPorDia": sourced(int(ref) if ref is not None else None, f"{SRC_BANCO} — coluna 'Quantidade refeições produzidas por dia'"),
            }
            cnpj = digits(cell(b, bci["cnpj"]))
        else:
            miss = f"Não consta no {SRC_BANCO}"
            status = {
                "situacao": sourced(None, miss),
                "emFuncionamento": sourced(None, miss),
                "refeicoesPorDia": sourced(None, miss),
            }
            cnpj = ""

        # --- Angle A: sourcing (Form, fuzzy join) ---
        fm = match_form(nome, municipio, form_rows, fci)
        if fm:
            note = "autodeclarado (2024)"
            sourcing = {
                "comoAdquire": sourced(as_text(cell(fm, fci["onde"])), f"{SRC_FORM} — 'Onde/como são adquiridos os alimentos'", note),
                "gastoMensalTexto": sourced(as_text(cell(fm, fci["gasto"])), f"{SRC_FORM} — 'valor médio mensal com alimentos'", note),
                "trabalhadores": sourced(as_text(cell(fm, fci["trab"])), f"{SRC_FORM} — 'Quantas pessoas trabalham na Cozinha'", note),
            }
        else:
            sourcing = None

        # --- Angle A/B: supply network by município (PAA + CAF) ---
        ur_in = [r for r in paa["ur"] if norm(cell(r, paa["ur_mun"])) == mn]
        is_receiver = bool(cnpj) and any(
            digits(cell(r, paa["ur_cnpj"])) == cnpj for r in paa["ur"]
        )
        prod_agg = {}
        for r in paa["prod"]:
            if norm(cell(r, paa["p_mun"])) == mn:
                p = str(cell(r, paa["p_prd"]) or "—")
                prod_agg[p] = prod_agg.get(p, 0.0) + (to_float(cell(r, paa["p_kg"])) or 0.0)
        paa_products = [
            {"produto": p, "kg": round(kg)}
            for p, kg in sorted(prod_agg.items(), key=lambda kv: -kv[1])[:5]
        ]
        caf_in = [r for r in caf["body"] if norm(cell(r, caf["mun"])) == mn]
        caf_examples = []
        for r in caf_in[:3]:
            raz = cell(r, caf["raz"])
            if raz:
                caf_examples.append(str(raz))

        supply = {
            "municipio": municipio,
            "paaReceivingUnits": sourced(len(ur_in), f"{SRC_PAA} — aba 'UNIDADES RECEBEDORAS', contagem por 'Município Consumidor'"),
            "isPaaReceiver": sourced(is_receiver, f"{SRC_PAA} — 'UNIDADES RECEBEDORAS', cruzamento por CNPJ da cozinha"),
            "paaProducts": sourced(paa_products, f"{SRC_PAA} — aba 'PRODUTOS', soma de kg por produto no município"),
            "cafOrganizations": sourced(len(caf_in), f"{SRC_CAF} — contagem de organizações no município"),
            "cafExamples": sourced(caf_examples, f"{SRC_CAF} — razão social das organizações no município"),
        }

        out = {
            "cozinhaId": code,
            "generatedAt": GENERATED_AT,
            "status": status,
            "sourcing": sourcing,
            "supplyNetwork": supply,
        }
        path = os.path.join(OUT_DIR, f"{code}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"wrote {code} ({municipio}): banco={'y' if b else 'n'} form={'y' if fm else 'n'} "
              f"paaUnits={len(ur_in)} caf={len(caf_in)} receiver={is_receiver}")


if __name__ == "__main__":
    main()
